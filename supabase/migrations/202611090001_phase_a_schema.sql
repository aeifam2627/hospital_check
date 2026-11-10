create extension if not exists pgcrypto;

create type public.inspection_schedule_mode as enum ('daily', 'shift');
create type public.inspection_source as enum ('web_form', 'excel_import');

create table public.inspection_types (
  id uuid primary key default gen_random_uuid(), slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title_th text not null, schedule_mode public.inspection_schedule_mode not null,
  sort_order integer not null default 0, is_active boolean not null default true,
  discord_channel_id text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.inspection_groups (
  id uuid primary key default gen_random_uuid(), inspection_type_id uuid not null references public.inspection_types(id),
  name text not null, sort_order integer not null default 0, unique (inspection_type_id, name)
);
create table public.inspection_items (
  id uuid primary key default gen_random_uuid(), inspection_type_id uuid not null references public.inspection_types(id),
  group_id uuid references public.inspection_groups(id), name text not null, sort_order integer not null default 0,
  active_from date not null default current_date, active_to date, check (active_to is null or active_to >= active_from)
);
create index inspection_items_active_idx on public.inspection_items (inspection_type_id, active_from, active_to);
create table public.inspection_variants (
  id uuid primary key default gen_random_uuid(), item_id uuid not null references public.inspection_items(id),
  variant_label text, unit text not null, sort_order integer not null default 0,
  active_from date not null default current_date, active_to date, check (active_to is null or active_to >= active_from)
);
create index inspection_variants_active_idx on public.inspection_variants (item_id, active_from, active_to);
create table public.variant_standards (
  id uuid primary key default gen_random_uuid(), variant_id uuid not null references public.inspection_variants(id),
  standard_qty integer not null check (standard_qty >= 0), effective_from date not null,
  effective_to date, check (effective_to is null or effective_to >= effective_from), unique (variant_id, effective_from)
);
create index variant_standards_effective_idx on public.variant_standards (variant_id, effective_from, effective_to);
create table public.inspectors (
  id uuid primary key default gen_random_uuid(), display_name text not null unique,
  is_active boolean not null default true, sort_order integer not null default 0
);
create table public.inspection_schedules (
  id uuid primary key default gen_random_uuid(), inspection_type_id uuid not null references public.inspection_types(id),
  shift_code text not null check (shift_code in ('daily','night','morning','afternoon')),
  required boolean not null default false, effective_from date not null, effective_to date,
  cutoff_local_time time, cutoff_day_offset integer not null default 0, timezone text not null default 'Asia/Bangkok',
  check (effective_to is null or effective_to >= effective_from), unique (inspection_type_id, shift_code, effective_from)
);
create table public.inspection_submissions (
  id uuid primary key default gen_random_uuid(), inspection_type_id uuid not null references public.inspection_types(id),
  work_date date not null, shift_code text not null check (shift_code in ('daily','night','morning','afternoon')),
  inspector_name text not null check (char_length(inspector_name) between 1 and 120), notes text check (char_length(notes) <= 500),
  source public.inspection_source not null default 'web_form', submitted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  revision_number integer not null default 0 check (revision_number >= 0), idempotency_key uuid not null unique,
  unique (inspection_type_id, work_date, shift_code)
);
create index inspection_submissions_date_idx on public.inspection_submissions (work_date desc, inspection_type_id);
create table public.inspection_results (
  id uuid primary key default gen_random_uuid(), submission_id uuid not null references public.inspection_submissions(id) on delete cascade,
  variant_id uuid not null references public.inspection_variants(id), actual_qty integer check (actual_qty >= 0),
  standard_qty_snapshot integer not null check (standard_qty_snapshot >= 0), item_name_snapshot text not null,
  variant_label_snapshot text, unit_snapshot text not null, unique (submission_id, variant_id)
);
create table public.submission_revisions (
  id uuid primary key default gen_random_uuid(), submission_id uuid not null references public.inspection_submissions(id) on delete cascade,
  revision_no integer not null, previous_payload jsonb not null, revised_at timestamptz not null default now(),
  inspector_name text not null, reason text, unique (submission_id, revision_no)
);
create table public.audit_events (
  id uuid primary key default gen_random_uuid(), kind text not null, reference_id uuid,
  created_at timestamptz not null default now(), actor_name text, payload jsonb not null default '{}'::jsonb
);

alter table public.inspection_types enable row level security;
alter table public.inspection_groups enable row level security;
alter table public.inspection_items enable row level security;
alter table public.inspection_variants enable row level security;
alter table public.variant_standards enable row level security;
alter table public.inspectors enable row level security;
alter table public.inspection_schedules enable row level security;
alter table public.inspection_submissions enable row level security;
alter table public.inspection_results enable row level security;
alter table public.submission_revisions enable row level security;
alter table public.audit_events enable row level security;

revoke all on all tables in schema public from anon, authenticated;

create or replace function public.list_inspection_types_for_date(p_work_date date)
returns table (id uuid, slug text, title_th text, schedule_mode public.inspection_schedule_mode, status text, completed_slots integer, total_slots integer)
language sql stable security definer set search_path = public as $$
  with slots as (
    select t.id,
      case when t.schedule_mode = 'daily' then 1
        else greatest(1, count(s.id))::integer end as total_slots
    from inspection_types t
    left join inspection_schedules s on s.inspection_type_id = t.id
      and s.effective_from <= p_work_date and (s.effective_to is null or s.effective_to >= p_work_date)
    where t.is_active
    group by t.id, t.schedule_mode
  ), completed as (
    select inspection_type_id, count(*)::integer completed_slots from inspection_submissions
    where work_date = p_work_date group by inspection_type_id
  )
  select t.id, t.slug, t.title_th, t.schedule_mode,
    case when coalesce(c.completed_slots,0) >= s.total_slots then 'complete'
      when coalesce(c.completed_slots,0) > 0 then 'incomplete' else 'pending' end,
    coalesce(c.completed_slots,0), s.total_slots
  from inspection_types t join slots s on s.id=t.id left join completed c on c.inspection_type_id=t.id
  where t.is_active order by t.sort_order, t.title_th;
$$;

create or replace function public.get_inspection_form(p_type_slug text, p_work_date date, p_shift_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_type inspection_types%rowtype; v_shift text; v_submission jsonb; v_groups jsonb;
begin
  select * into v_type from inspection_types where slug=p_type_slug and is_active;
  if not found then return null; end if;
  v_shift := case when v_type.schedule_mode='daily' then 'daily' else p_shift_code end;
  if v_shift not in ('daily','night','morning','afternoon') then raise exception 'invalid shift' using errcode='P0001'; end if;

  select jsonb_build_object('id',s.id,'revision_number',s.revision_number,'inspector_name',s.inspector_name,'notes',s.notes,
    'results',coalesce((select jsonb_agg(jsonb_build_object('variant_id',r.variant_id,'actual_qty',r.actual_qty)) from inspection_results r where r.submission_id=s.id),'[]'::jsonb))
  into v_submission from inspection_submissions s where s.inspection_type_id=v_type.id and s.work_date=p_work_date and s.shift_code=v_shift;

  select coalesce(jsonb_agg(group_json order by group_sort),'[]'::jsonb) into v_groups from (
    select g.id, coalesce(g.name,'') group_name, coalesce(g.sort_order,0) group_sort,
      jsonb_build_object('id',g.id,'name',g.name,'items',coalesce(jsonb_agg(item_json order by item_sort) filter (where item_json is not null),'[]'::jsonb)) group_json
    from (select id,name,sort_order from inspection_groups where inspection_type_id=v_type.id union all select null::uuid,null::text,-1) g
    left join lateral (
      select i.sort_order item_sort, jsonb_build_object('id',i.id,'name',i.name,'variants',
        coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'variant_label',v.variant_label,'unit',v.unit,'standard_qty',std.standard_qty) order by v.sort_order)
          from inspection_variants v join lateral (select standard_qty from variant_standards vs where vs.variant_id=v.id and vs.effective_from<=p_work_date and (vs.effective_to is null or vs.effective_to>=p_work_date) order by vs.effective_from desc limit 1) std on true
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

  select count(*) into v_expected_count from inspection_variants v join inspection_items i on i.id=v.item_id
    join variant_standards s on s.variant_id=v.id and s.effective_from<=(p_payload->>'work_date')::date and (s.effective_to is null or s.effective_to>=(p_payload->>'work_date')::date)
    where i.inspection_type_id=v_type.id and i.active_from<=(p_payload->>'work_date')::date and (i.active_to is null or i.active_to>=(p_payload->>'work_date')::date)
      and v.active_from<=(p_payload->>'work_date')::date and (v.active_to is null or v.active_to>=(p_payload->>'work_date')::date);
  if jsonb_array_length(p_payload->'results')<>v_expected_count then raise exception 'กรุณากรอกจำนวนให้ครบทุกช่อง' using errcode='P0001'; end if;

  for v_result in select value from jsonb_array_elements(p_payload->'results') loop
    insert into inspection_results(submission_id,variant_id,actual_qty,standard_qty_snapshot,item_name_snapshot,variant_label_snapshot,unit_snapshot)
    select v_submission_id,v.id,(v_result->>'actual_qty')::integer,s.standard_qty,i.name,v.variant_label,v.unit
    from inspection_variants v join inspection_items i on i.id=v.item_id join lateral (
      select standard_qty from variant_standards s where s.variant_id=v.id and s.effective_from<=(p_payload->>'work_date')::date and (s.effective_to is null or s.effective_to>=(p_payload->>'work_date')::date) order by s.effective_from desc limit 1
    ) s on true where v.id=(v_result->>'variant_id')::uuid and i.inspection_type_id=v_type.id;
    if not found then raise exception 'พบรายการที่ไม่อยู่ในแบบฟอร์ม' using errcode='P0001'; end if;
  end loop;
  insert into audit_events(kind,reference_id,actor_name,payload) values(case when v_updated then 'submission.revised' else 'submission.created' end,v_submission_id,p_payload->>'inspector_name',jsonb_build_object('work_date',p_payload->>'work_date','shift_code',v_shift));
  return jsonb_build_object('id',v_submission_id,'revision_number',case when v_updated then v_expected+1 else 0 end,'updated',v_updated);
end;
$$;

revoke all on function public.list_inspection_types_for_date(date) from public, anon, authenticated;
revoke all on function public.get_inspection_form(text,date,text) from public, anon, authenticated;
revoke all on function public.save_inspection_submission(jsonb) from public, anon, authenticated;
grant execute on function public.list_inspection_types_for_date(date) to service_role;
grant execute on function public.get_inspection_form(text,date,text) to service_role;
grant execute on function public.save_inspection_submission(jsonb) to service_role;
