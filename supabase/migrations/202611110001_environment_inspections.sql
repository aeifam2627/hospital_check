-- Environmental inspection forms supplied on 2026-11-11.
-- Existing counts stay nonnegative integers; measured values retain two decimal places.
begin;

alter table public.inspection_variants add column input_kind text not null default 'count'
  check (input_kind in ('count','temperature','humidity'));
alter table public.variant_standards
  add column comparison_mode text not null default 'exact' check (comparison_mode in ('exact','range')),
  add column standard_min numeric,
  add column standard_max numeric,
  add constraint valid_standard_range check (comparison_mode <> 'range' or
    ((standard_min is not null or standard_max is not null) and (standard_min is null or standard_max is null or standard_min <= standard_max)));
alter table public.inspection_results drop constraint inspection_results_actual_qty_check;
alter table public.inspection_results alter column actual_qty type numeric using actual_qty::numeric;
alter table public.inspection_results
  add column comparison_mode_snapshot text not null default 'exact' check (comparison_mode_snapshot in ('exact','range')),
  add column standard_min_snapshot numeric,
  add column standard_max_snapshot numeric,
  add column input_kind_snapshot text not null default 'count' check (input_kind_snapshot in ('count','temperature','humidity'));

-- Snapshot the range used on the work date, so later master-data changes do not rewrite history.
create or replace function public.validate_inspection_value()
returns trigger language plpgsql set search_path=public as $$
declare v_kind text; v_standard variant_standards%rowtype;
begin
  select v.input_kind into v_kind from inspection_variants v where v.id=new.variant_id;
  select s.* into v_standard from variant_standards s join inspection_submissions sub on sub.id=new.submission_id
    where s.variant_id=new.variant_id and s.effective_from<=sub.work_date
      and (s.effective_to is null or s.effective_to>=sub.work_date) order by s.effective_from desc limit 1;
  if not found then raise exception 'ไม่พบเกณฑ์สำหรับวันที่ตรวจ' using errcode='P0001'; end if;
  new.input_kind_snapshot:=v_kind;
  new.comparison_mode_snapshot:=v_standard.comparison_mode;
  new.standard_min_snapshot:=v_standard.standard_min;
  new.standard_max_snapshot:=v_standard.standard_max;
  if new.actual_qty is not null then
    if new.actual_qty::text in ('NaN','Infinity','-Infinity')
      or (v_kind='count' and (new.actual_qty<0 or new.actual_qty>99999 or new.actual_qty<>trunc(new.actual_qty)))
      or (v_kind='temperature' and (new.actual_qty < -273.15 or new.actual_qty>999 or new.actual_qty<>round(new.actual_qty,2)))
      or (v_kind='humidity' and (new.actual_qty<0 or new.actual_qty>100 or new.actual_qty<>round(new.actual_qty,2))) then
      raise exception 'ค่าที่กรอกไม่ถูกต้องสำหรับรายการตรวจ' using errcode='P0001';
    end if;
  end if;
  return new;
end $$;
create trigger validate_inspection_value_before_insert before insert on public.inspection_results
  for each row execute function public.validate_inspection_value();

create or replace function public.inspection_result_outside_standard(r public.inspection_results)
returns boolean language sql immutable set search_path=public as $$
  select case when r.actual_qty is null then true
    when r.comparison_mode_snapshot='range' then
      (r.standard_min_snapshot is not null and r.actual_qty<r.standard_min_snapshot)
      or (r.standard_max_snapshot is not null and r.actual_qty>r.standard_max_snapshot)
    else r.actual_qty is distinct from r.standard_qty_snapshot end;
$$;
revoke all on function public.validate_inspection_value(),public.inspection_result_outside_standard(public.inspection_results) from public,anon,authenticated;
grant execute on function public.inspection_result_outside_standard(public.inspection_results) to service_role;


create or replace function public.get_inspection_form(p_type_slug text, p_work_date date, p_shift_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_type inspection_types%rowtype; v_shift text; v_submission jsonb; v_groups jsonb;
begin
  select * into v_type from inspection_types where slug=p_type_slug and is_active;
  if not found then return null; end if;
  v_shift := case when v_type.schedule_mode='daily' then 'daily' else p_shift_code end;
  if v_shift not in ('daily','night','morning','afternoon') then raise exception 'invalid shift' using errcode='P0001'; end if;
  if v_type.slug in ('refrigerator-temperature','room-environment') and not exists(
    select 1 from inspection_schedules where inspection_type_id=v_type.id and shift_code=v_shift
      and effective_from<=p_work_date and (effective_to is null or effective_to>=p_work_date)
  ) then raise exception 'ไม่มีรอบตรวจนี้สำหรับวันที่เลือก' using errcode='P0001'; end if;


  select jsonb_build_object('id',s.id,'revision_number',s.revision_number,'inspector_name',s.inspector_name,'notes',s.notes,
    'results',coalesce((select jsonb_agg(jsonb_build_object('variant_id',r.variant_id,'actual_qty',r.actual_qty)) from inspection_results r where r.submission_id=s.id),'[]'::jsonb))
  into v_submission from inspection_submissions s where s.inspection_type_id=v_type.id and s.work_date=p_work_date and s.shift_code=v_shift;

  select coalesce(jsonb_agg(group_json order by group_sort),'[]'::jsonb) into v_groups from (
    select g.id, coalesce(g.name,'') group_name, coalesce(g.sort_order,0) group_sort,
      jsonb_build_object('id',g.id,'name',g.name,'items',coalesce(jsonb_agg(item_json order by item_sort) filter (where item_json is not null),'[]'::jsonb)) group_json
    from (select id,name,sort_order from inspection_groups where inspection_type_id=v_type.id union all select null::uuid,null::text,-1) g
    left join lateral (
      select i.sort_order item_sort, jsonb_build_object('id',i.id,'name',i.name,'variants',
        coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'variant_label',v.variant_label,'unit',v.unit,'standard_qty',std.standard_qty,'input_kind',v.input_kind,'comparison_mode',std.comparison_mode,'standard_min',std.standard_min,'standard_max',std.standard_max) order by v.sort_order)
          from inspection_variants v join lateral (select standard_qty,comparison_mode,standard_min,standard_max from variant_standards vs where vs.variant_id=v.id and vs.effective_from<=p_work_date and (vs.effective_to is null or vs.effective_to>=p_work_date) order by vs.effective_from desc limit 1) std on true
          where v.item_id=i.id and v.active_from<=p_work_date and (v.active_to is null or v.active_to>=p_work_date)),'[]'::jsonb)) item_json
      from inspection_items i where i.inspection_type_id=v_type.id and i.group_id is not distinct from g.id
        and i.active_from<=p_work_date and (i.active_to is null or i.active_to>=p_work_date)
        and exists (select 1 from inspection_variants vx join variant_standards sx on sx.variant_id=vx.id where vx.item_id=i.id and sx.effective_from<=p_work_date and (sx.effective_to is null or sx.effective_to>=p_work_date))
    ) items on true group by g.id,g.name,g.sort_order
  ) grouped where jsonb_array_length(group_json->'items')>0;

  return jsonb_build_object('type',jsonb_build_object('id',v_type.id,'slug',v_type.slug,'title_th',v_type.title_th,'schedule_mode',v_type.schedule_mode),
    'work_date',p_work_date,'shift_code',v_shift,'schedules',coalesce((select jsonb_agg(jsonb_build_object('shift_code',shift_code,'required',required) order by id) from inspection_schedules where inspection_type_id=v_type.id and effective_from<=p_work_date and (effective_to is null or effective_to>=p_work_date)),'[]'::jsonb),
    'groups',v_groups,'existing_submission',v_submission);
end;
$$;

create or replace function public.save_inspection_submission(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_type inspection_types%rowtype; v_existing inspection_submissions%rowtype; v_submission_id uuid; v_shift text;
  v_expected integer; v_result jsonb; v_expected_count integer; v_updated boolean := false;
begin
  select * into v_type from inspection_types where slug=p_payload->>'type_slug' and is_active for share;
  if not found then raise exception 'ไม่พบประเภทการตรวจ' using errcode='P0001'; end if;
  v_shift := case when v_type.schedule_mode='daily' then 'daily' else p_payload->>'shift_code' end;

  if v_type.slug in ('refrigerator-temperature','room-environment') and not exists(
    select 1 from inspection_schedules where inspection_type_id=v_type.id and shift_code=v_shift
      and effective_from<=(p_payload->>'work_date')::date and (effective_to is null or effective_to>=(p_payload->>'work_date')::date)
  ) then raise exception 'ไม่มีรอบตรวจนี้สำหรับวันที่เลือก' using errcode='P0001'; end if;
  v_expected := (p_payload->>'revision_expected')::integer;
  select * into v_existing from inspection_submissions where inspection_type_id=v_type.id and work_date=(p_payload->>'work_date')::date and shift_code=v_shift for update;
  if found then
    if v_existing.idempotency_key=(p_payload->>'idempotency_key')::uuid then return jsonb_build_object('id',v_existing.id,'revision_number',v_existing.revision_number,'updated',true); end if;
    if v_existing.revision_number<>v_expected then raise exception 'revision conflict' using errcode='P0002'; end if;
    insert into submission_revisions(submission_id,revision_no,previous_payload,inspector_name)
    values(v_existing.id,v_existing.revision_number,jsonb_build_object('submission',to_jsonb(v_existing),'results',(select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from inspection_results r where r.submission_id=v_existing.id)),p_payload->>'inspector_name');
    update inspection_submissions set inspector_name=p_payload->>'inspector_name',notes=nullif(p_payload->>'notes',''),submitted_at=now(),updated_at=now(),revision_number=revision_number+1,idempotency_key=(p_payload->>'idempotency_key')::uuid where id=v_existing.id returning id into v_submission_id;
    delete from inspection_results where submission_id=v_submission_id; v_updated:=true;
  else
    if v_expected<>0 then raise exception 'revision conflict' using errcode='P0002'; end if;
    insert into inspection_submissions(inspection_type_id,work_date,shift_code,inspector_name,notes,submitted_at,idempotency_key)
    values(v_type.id,(p_payload->>'work_date')::date,v_shift,p_payload->>'inspector_name',nullif(p_payload->>'notes',''),now(),(p_payload->>'idempotency_key')::uuid) returning id into v_submission_id;
  end if;

  select count(distinct v.id) into v_expected_count from inspection_variants v join inspection_items i on i.id=v.item_id
    join variant_standards s on s.variant_id=v.id and s.effective_from<=(p_payload->>'work_date')::date and (s.effective_to is null or s.effective_to>=(p_payload->>'work_date')::date)
    where i.inspection_type_id=v_type.id and i.active_from<=(p_payload->>'work_date')::date and (i.active_to is null or i.active_to>=(p_payload->>'work_date')::date)
      and v.active_from<=(p_payload->>'work_date')::date and (v.active_to is null or v.active_to>=(p_payload->>'work_date')::date);
  if jsonb_array_length(p_payload->'results')<>v_expected_count then raise exception 'กรุณากรอกจำนวนให้ครบทุกช่อง' using errcode='P0001'; end if;

  if exists(select 1 from jsonb_array_elements(p_payload->'results') r where jsonb_typeof(r->'actual_qty') is distinct from 'number') then
    raise exception 'กรุณากรอกค่าตัวเลขให้ครบทุกช่อง' using errcode='P0001';
  end if;
  for v_result in select value from jsonb_array_elements(p_payload->'results') loop
    insert into inspection_results(submission_id,variant_id,actual_qty,standard_qty_snapshot,item_name_snapshot,variant_label_snapshot,unit_snapshot)
    select v_submission_id,v.id,(v_result->>'actual_qty')::numeric,s.standard_qty,i.name,v.variant_label,v.unit
    from inspection_variants v join inspection_items i on i.id=v.item_id join lateral (
      select standard_qty from variant_standards s where s.variant_id=v.id and s.effective_from<=(p_payload->>'work_date')::date and (s.effective_to is null or s.effective_to>=(p_payload->>'work_date')::date) order by s.effective_from desc limit 1
    ) s on true where v.id=(v_result->>'variant_id')::uuid and i.inspection_type_id=v_type.id
      and i.active_from<=(p_payload->>'work_date')::date and (i.active_to is null or i.active_to>=(p_payload->>'work_date')::date)
      and v.active_from<=(p_payload->>'work_date')::date and (v.active_to is null or v.active_to>=(p_payload->>'work_date')::date);
    if not found then raise exception 'พบรายการที่ไม่อยู่ในแบบฟอร์ม' using errcode='P0001'; end if;
  end loop;
  insert into audit_events(kind,reference_id,actor_name,payload) values(case when v_updated then 'submission.revised' else 'submission.created' end,v_submission_id,p_payload->>'inspector_name',jsonb_build_object('work_date',p_payload->>'work_date','shift_code',v_shift));
  return jsonb_build_object('id',v_submission_id,'revision_number',case when v_updated then v_expected+1 else 0 end,'updated',v_updated);
end;
$$;

create or replace function public.get_dashboard(p_work_date date)
returns jsonb language sql stable security definer set search_path=public as $$
with active_types as (
  select t.*,
    case when t.schedule_mode='daily' then 1 else coalesce((select count(*) filter(where s.required) from inspection_schedules s where s.inspection_type_id=t.id and s.effective_from<=p_work_date and (s.effective_to is null or s.effective_to>=p_work_date)),0) end::integer expected_slots
  from inspection_types t where t.is_active
), submissions as (
  select s.*,count(r.id)::integer completed_fields,count(r.id) filter(where public.inspection_result_outside_standard(r))::integer difference_count
  from inspection_submissions s left join inspection_results r on r.submission_id=s.id where s.work_date=p_work_date group by s.id
), cards as (
  select t.id,t.sort_order,jsonb_build_object(
    'id',t.id,'slug',t.slug,'title_th',t.title_th,'schedule_mode',t.schedule_mode,'expected_slots',t.expected_slots,
    'submitted_slots',count(s.id) filter(where s.import_status='complete')::integer,'partial_slots',count(s.id) filter(where s.import_status='partial')::integer,
    'required_submitted_slots',(case when t.schedule_mode='daily' then count(s.id) filter(where s.import_status='complete') else count(s.id) filter(where s.import_status='complete' and exists(select 1 from inspection_schedules rs where rs.inspection_type_id=t.id and rs.shift_code=s.shift_code and rs.required and rs.effective_from<=p_work_date and (rs.effective_to is null or rs.effective_to>=p_work_date))) end)::integer,
    'is_complete',case when t.expected_slots=0 then null else (case when t.schedule_mode='daily' then count(s.id) filter(where s.import_status='complete') else count(s.id) filter(where s.import_status='complete' and exists(select 1 from inspection_schedules rs where rs.inspection_type_id=t.id and rs.shift_code=s.shift_code and rs.required and rs.effective_from<=p_work_date and (rs.effective_to is null or rs.effective_to>=p_work_date))) end)>=t.expected_slots end,
    'latest_submitted_at',max(s.submitted_at),'latest_inspector',(array_agg(s.inspector_name order by coalesce(s.submitted_at,s.created_at) desc) filter(where s.id is not null))[1],
    'difference_count',coalesce(sum(s.difference_count),0)::integer,
    'submissions',coalesce(jsonb_agg(jsonb_build_object('id',s.id,'shift_code',s.shift_code,'inspector_name',s.inspector_name,'submitted_at',s.submitted_at,'completed_fields',s.completed_fields,'difference_count',s.difference_count,'revision_number',s.revision_number,'import_status',s.import_status) order by coalesce(s.submitted_at,s.created_at) desc) filter(where s.id is not null),'[]'::jsonb),
    'differences',coalesce((select jsonb_agg(jsonb_build_object('submission_id',ss.id,'shift_code',ss.shift_code,'item',r.item_name_snapshot,'variant',r.variant_label_snapshot,'standard_qty',r.standard_qty_snapshot,'comparison_mode',r.comparison_mode_snapshot,'standard_min',r.standard_min_snapshot,'standard_max',r.standard_max_snapshot,'actual_qty',r.actual_qty,'unit',r.unit_snapshot) order by r.item_name_snapshot) from submissions ss join inspection_results r on r.submission_id=ss.id where ss.inspection_type_id=t.id and public.inspection_result_outside_standard(r)),'[]'::jsonb)
  )card from active_types t left join submissions s on s.inspection_type_id=t.id group by t.id,t.slug,t.title_th,t.schedule_mode,t.expected_slots,t.sort_order
)
select jsonb_build_object('work_date',p_work_date,'kpi',jsonb_build_object(
  'expected_slots',coalesce(sum((card->>'expected_slots')::integer),0)::integer,
  'submitted_slots',coalesce(sum((card->>'required_submitted_slots')::integer),0)::integer,
  'missing_slots',coalesce(sum(greatest((card->>'expected_slots')::integer-(card->>'required_submitted_slots')::integer,0)),0)::integer,
  'difference_count',coalesce(sum((card->>'difference_count')::integer),0)::integer),
  'types',coalesce(jsonb_agg(card order by sort_order),'[]'::jsonb)) from cards;
$$;

create or replace function public.get_inspection_history(p_from date,p_to date,p_type_slug text default null,p_limit integer default 50,p_offset integer default 0)
returns jsonb language sql stable security definer set search_path=public as $$
with filtered as (
  select s.*,t.slug,t.title_th,t.schedule_mode,
    count(r.id)::integer completed_fields,count(r.id) filter(where public.inspection_result_outside_standard(r))::integer difference_count
  from inspection_submissions s join inspection_types t on t.id=s.inspection_type_id left join inspection_results r on r.submission_id=s.id
  where s.work_date between p_from and p_to and (p_type_slug is null or t.slug=p_type_slug)
  group by s.id,t.slug,t.title_th,t.schedule_mode
), page as (
  select f.*,coalesce((select jsonb_agg(jsonb_build_object('item',r.item_name_snapshot,'variant',r.variant_label_snapshot,'standard_qty',r.standard_qty_snapshot,'comparison_mode',r.comparison_mode_snapshot,'standard_min',r.standard_min_snapshot,'standard_max',r.standard_max_snapshot,'actual_qty',r.actual_qty,'unit',r.unit_snapshot) order by r.item_name_snapshot) from inspection_results r where r.submission_id=f.id and public.inspection_result_outside_standard(r)),'[]'::jsonb) differences
  from filtered f order by work_date desc,submitted_at desc limit least(greatest(p_limit,1),100) offset greatest(p_offset,0)
)
select jsonb_build_object('total',(select count(*) from filtered),'items',coalesce(jsonb_agg(jsonb_build_object(
  'id',id,'type_slug',slug,'title_th',title_th,'schedule_mode',schedule_mode,'work_date',work_date,'shift_code',shift_code,
  'inspector_name',inspector_name,'notes',notes,'submitted_at',submitted_at,'revision_number',revision_number,
  'completed_fields',completed_fields,'difference_count',difference_count,'differences',differences
) order by work_date desc,submitted_at desc),'[]'::jsonb)) from page;
$$;

create or replace function public.queue_submission_notification()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_submission inspection_submissions%rowtype; v_type inspection_types%rowtype; v_payload jsonb; v_differences jsonb;
begin
  select * into v_submission from inspection_submissions where id=new.submission_id;
  if v_submission.source <> 'web_form' then return new; end if;
  select * into v_type from inspection_types where id=v_submission.inspection_type_id;
  if v_type.discord_channel_id is null or v_type.discord_channel_id='' then return new; end if;
  select coalesce(jsonb_agg(jsonb_build_object('item',item_name_snapshot,'variant',variant_label_snapshot,'standard',standard_qty_snapshot,'comparison_mode',comparison_mode_snapshot,'standard_min',standard_min_snapshot,'standard_max',standard_max_snapshot,'actual',actual_qty,'unit',unit_snapshot) order by item_name_snapshot) filter(where public.inspection_result_outside_standard(r)),'[]'::jsonb)
    into v_differences from inspection_results r where submission_id=v_submission.id;
  v_payload:=jsonb_build_object(
    'kind','submission','submission_id',v_submission.id,'type_slug',v_type.slug,'title_th',v_type.title_th,
    'work_date',v_submission.work_date,'shift_code',v_submission.shift_code,'schedule_mode',v_type.schedule_mode,
    'inspector_name',v_submission.inspector_name,'notes',v_submission.notes,'submitted_at',v_submission.submitted_at,
    'revision_number',v_submission.revision_number,
    'completed_count',(select count(*) from inspection_results where submission_id=v_submission.id),
    'difference_count',jsonb_array_length(v_differences),'differences',v_differences,
    'detail_path','/history?submission='||v_submission.id::text
  );
  insert into notification_outbox(notification_kind,reference_id,target_channel_id,payload,dedupe_key)
  values('submission',v_submission.id,v_type.discord_channel_id,v_payload,'submission:'||v_submission.id::text||':rev:'||v_submission.revision_number::text)
  on conflict(dedupe_key) do update set payload=excluded.payload,updated_at=now()
    where notification_outbox.status <> 'sent';
  return new;
end $$;

create or replace function public.enqueue_due_notification_summaries(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path=public as $$
declare v_schedule notification_schedules%rowtype; v_type inspection_types%rowtype; v_work_date date; v_count integer:=0; v_channel text; v_payload jsonb;
begin
  for v_schedule in select * from notification_schedules where enabled loop
    if ((p_now at time zone v_schedule.timezone)::time < v_schedule.send_local_time) then continue; end if;
    v_work_date:=((p_now at time zone v_schedule.timezone)::date - v_schedule.day_offset);
    if exists(select 1 from notification_outbox where dedupe_key='summary:'||v_schedule.notification_kind||':'||v_schedule.id::text||':'||v_work_date::text||':'||coalesce(v_schedule.shift_code,'daily')) then continue; end if;
    select * into v_type from inspection_types where id=v_schedule.inspection_type_id;
    v_channel:=coalesce(v_schedule.channel_id_override,v_type.discord_channel_id);
    if v_channel is null then continue; end if;
    v_payload:=jsonb_build_object('kind','summary','work_date',v_work_date,'shift_code',v_schedule.shift_code,'type_slug',v_type.slug,'title_th',v_type.title_th,
      'submission',(select to_jsonb(x) from (select s.id,s.inspector_name,s.submitted_at,s.notes,count(r.id)::integer completed_count,count(r.id) filter(where public.inspection_result_outside_standard(r))::integer difference_count from inspection_submissions s left join inspection_results r on r.submission_id=s.id where s.inspection_type_id=v_schedule.inspection_type_id and s.work_date=v_work_date and (v_schedule.shift_code is null or s.shift_code=v_schedule.shift_code) group by s.id order by s.submitted_at desc limit 1)x));
    insert into notification_outbox(notification_kind,reference_id,target_channel_id,payload,dedupe_key)
    values(v_schedule.notification_kind,null,v_channel,v_payload,'summary:'||v_schedule.notification_kind||':'||v_schedule.id::text||':'||v_work_date::text||':'||coalesce(v_schedule.shift_code,'daily'));
    v_count:=v_count+1;
  end loop;
  return v_count;
end $$;

-- Google Form sources (public view only; never submit to the source forms):
-- https://docs.google.com/forms/d/e/1FAIpQLSew5NvqvD7tn00FdrZp3uiG3GxxREpadkK-sYJu4NNXVBWxgQ/viewform
-- https://docs.google.com/forms/d/e/1FAIpQLSfobJpSc58N8PqPQcav_CSa9CYVxVECYy17i3bBNsnShiBVjA/viewform
insert into public.inspection_types(slug,title_th,schedule_mode,sort_order) values
  ('refrigerator-temperature','อุณหภูมิตู้เย็น','shift',40),
  ('room-environment','อุณหภูมิห้องและความชื้น','shift',50)
on conflict(slug) do nothing;
insert into public.inspection_schedules(inspection_type_id,shift_code,required,effective_from)
select t.id,s.code,true,'2026-11-11'::date from public.inspection_types t cross join (values('morning'),('afternoon')) s(code)
where t.slug in ('refrigerator-temperature','room-environment')
on conflict(inspection_type_id,shift_code,effective_from) do nothing;

do $$
declare row record; v_type uuid; v_item uuid; v_variant uuid;
begin
  for row in select * from (values
    ('refrigerator-temperature','อุณหภูมิตู้เย็น','temperature','°C',2::numeric,8::numeric,1),
    ('room-environment','อุณหภูมิห้อง','temperature','°C',null::numeric,24::numeric,1),
    ('room-environment','ความชื้นห้อง','humidity','%',null::numeric,60::numeric,2)
  ) x(slug,name,kind,unit,minimum,maximum,position) loop
    select id into v_type from inspection_types where slug=row.slug;
    select id into v_item from inspection_items where inspection_type_id=v_type and name=row.name limit 1;
    if v_item is null then
      insert into inspection_items(inspection_type_id,name,sort_order,active_from)
        values(v_type,row.name,row.position,'2026-11-11') returning id into v_item;
    end if;
    select id into v_variant from inspection_variants where item_id=v_item and variant_label is null limit 1;
    if v_variant is null then
      insert into inspection_variants(item_id,unit,input_kind,sort_order,active_from)
        values(v_item,row.unit,row.kind,1,'2026-11-11') returning id into v_variant;
    end if;
    insert into variant_standards(variant_id,standard_qty,comparison_mode,standard_min,standard_max,effective_from)
      values(v_variant,row.maximum::integer,'range',row.minimum,row.maximum,'2026-11-11') on conflict(variant_id,effective_from) do nothing;
    v_item:=null; v_variant:=null;
  end loop;
end $$;

commit;
