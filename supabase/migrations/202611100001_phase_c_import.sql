alter table public.inspection_submissions
  add column if not exists import_status text not null default 'complete' check (import_status in ('complete','partial')),
  add column if not exists legacy_source_key text;
create unique index if not exists inspection_submissions_legacy_source_key_uidx on public.inspection_submissions(legacy_source_key) where legacy_source_key is not null;

create table public.import_batches (
  id uuid primary key default gen_random_uuid(), source_file text not null, imported_at timestamptz not null default now(),
  status text not null check(status in ('dry_run','committed','partial','failed')),
  source_checksum text not null, row_count integer not null default 0, warnings jsonb not null default '[]'::jsonb,
  report jsonb not null default '{}'::jsonb, unique(source_checksum)
);
create table public.import_row_evidence (
  id uuid primary key default gen_random_uuid(), batch_id uuid not null references public.import_batches(id) on delete cascade,
  sheet_name text not null, source_cell text not null, raw_value text, parsed_value jsonb,
  parse_status text not null check(parse_status in ('parsed','blank','ambiguous','skipped')),
  warning text, unique(batch_id,sheet_name,source_cell)
);
alter table public.import_batches enable row level security;
alter table public.import_row_evidence enable row level security;
revoke all on public.import_batches,public.import_row_evidence from anon,authenticated;

create or replace function public.import_legacy_submission(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_type inspection_types%rowtype; v_existing inspection_submissions%rowtype; v_id uuid; v_result jsonb; v_inserted integer:=0;
begin
  select * into v_type from inspection_types where slug=p_payload->>'type_slug';
  if not found then raise exception 'unknown inspection type' using errcode='P0001'; end if;
  select * into v_existing from inspection_submissions where inspection_type_id=v_type.id and work_date=(p_payload->>'work_date')::date and shift_code=p_payload->>'shift_code' for update;
  if found and v_existing.source='web_form' then return jsonb_build_object('status','skipped_web_priority','id',v_existing.id); end if;
  if found then
    if v_existing.legacy_source_key=p_payload->>'legacy_source_key' then return jsonb_build_object('status','already_imported','id',v_existing.id); end if;
    return jsonb_build_object('status','conflict_existing_import','id',v_existing.id);
  end if;
  insert into inspection_submissions(inspection_type_id,work_date,shift_code,inspector_name,notes,source,submitted_at,idempotency_key,import_status,legacy_source_key)
  values(v_type.id,(p_payload->>'work_date')::date,p_payload->>'shift_code',coalesce(nullif(p_payload->>'inspector_name',''),'ไม่พบชื่อในต้นฉบับ'),nullif(p_payload->>'notes',''),'excel_import',null,gen_random_uuid(),coalesce(p_payload->>'import_status','partial'),p_payload->>'legacy_source_key') returning id into v_id;
  for v_result in select value from jsonb_array_elements(p_payload->'results') loop
    insert into inspection_results(submission_id,variant_id,actual_qty,standard_qty_snapshot,item_name_snapshot,variant_label_snapshot,unit_snapshot)
    select v_id,v.id,(v_result->>'actual_qty')::integer,s.standard_qty,i.name,v.variant_label,v.unit
    from inspection_variants v join inspection_items i on i.id=v.item_id join lateral(
      select standard_qty from variant_standards s where s.variant_id=v.id and s.effective_from<=(p_payload->>'work_date')::date and (s.effective_to is null or s.effective_to>=(p_payload->>'work_date')::date) order by s.effective_from desc limit 1
    )s on true where v.id=(v_result->>'variant_id')::uuid and i.inspection_type_id=v_type.id;
    if found then v_inserted:=v_inserted+1; else raise exception 'variant not active for import date' using errcode='P0001'; end if;
  end loop;
  insert into audit_events(kind,reference_id,actor_name,payload) values('legacy_import.created',v_id,p_payload->>'inspector_name',jsonb_build_object('legacy_source_key',p_payload->>'legacy_source_key','result_count',v_inserted));
  return jsonb_build_object('status','imported','id',v_id,'result_count',v_inserted);
end $$;
revoke all on function public.import_legacy_submission(jsonb) from public,anon,authenticated;
grant execute on function public.import_legacy_submission(jsonb) to service_role;

create table public.api_rate_limits (
  bucket_key text primary key, window_started_at timestamptz not null default now(), request_count integer not null default 0
);
alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from anon,authenticated;
create or replace function public.consume_api_rate_limit(p_bucket_key text,p_window_seconds integer,p_max_requests integer)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_allowed boolean;
begin
  insert into api_rate_limits(bucket_key,window_started_at,request_count) values(p_bucket_key,now(),1)
  on conflict(bucket_key) do update set
    window_started_at=case when api_rate_limits.window_started_at<=now()-make_interval(secs=>p_window_seconds) then now() else api_rate_limits.window_started_at end,
    request_count=case when api_rate_limits.window_started_at<=now()-make_interval(secs=>p_window_seconds) then 1 else api_rate_limits.request_count+1 end
  returning request_count<=p_max_requests into v_allowed;
  return v_allowed;
end $$;
revoke all on function public.consume_api_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_api_rate_limit(text,integer,integer) to service_role;

create or replace function public.get_dashboard(p_work_date date)
returns jsonb language sql stable security definer set search_path=public as $$
with active_types as (
  select t.*,
    case when t.schedule_mode='daily' then 1 else coalesce((select count(*) filter(where s.required) from inspection_schedules s where s.inspection_type_id=t.id and s.effective_from<=p_work_date and (s.effective_to is null or s.effective_to>=p_work_date)),0) end::integer expected_slots
  from inspection_types t where t.is_active
), submissions as (
  select s.*,count(r.id)::integer completed_fields,count(r.id) filter(where r.actual_qty is distinct from r.standard_qty_snapshot)::integer difference_count
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
    'differences',coalesce((select jsonb_agg(jsonb_build_object('submission_id',ss.id,'shift_code',ss.shift_code,'item',r.item_name_snapshot,'variant',r.variant_label_snapshot,'standard_qty',r.standard_qty_snapshot,'actual_qty',r.actual_qty,'unit',r.unit_snapshot) order by r.item_name_snapshot) from submissions ss join inspection_results r on r.submission_id=ss.id where ss.inspection_type_id=t.id and r.actual_qty is distinct from r.standard_qty_snapshot),'[]'::jsonb)
  )card from active_types t left join submissions s on s.inspection_type_id=t.id group by t.id,t.slug,t.title_th,t.schedule_mode,t.expected_slots,t.sort_order
)
select jsonb_build_object('work_date',p_work_date,'kpi',jsonb_build_object(
  'expected_slots',coalesce(sum((card->>'expected_slots')::integer),0)::integer,
  'submitted_slots',coalesce(sum((card->>'required_submitted_slots')::integer),0)::integer,
  'missing_slots',coalesce(sum(greatest((card->>'expected_slots')::integer-(card->>'required_submitted_slots')::integer,0)),0)::integer,
  'difference_count',coalesce(sum((card->>'difference_count')::integer),0)::integer),
  'types',coalesce(jsonb_agg(card order by sort_order),'[]'::jsonb)) from cards;
$$;
