alter table public.inspection_results add column if not exists group_name_snapshot text;
update public.inspection_results r set group_name_snapshot=g.name
from public.inspection_variants v join public.inspection_items i on i.id=v.item_id left join public.inspection_groups g on g.id=i.group_id
where r.variant_id=v.id and r.group_name_snapshot is null;

create or replace function public.set_result_group_snapshot()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.group_name_snapshot is null then
    select g.name into new.group_name_snapshot from inspection_variants v join inspection_items i on i.id=v.item_id left join inspection_groups g on g.id=i.group_id where v.id=new.variant_id;
  end if;
  return new;
end $$;
create trigger set_result_group_snapshot_before_insert before insert on public.inspection_results for each row execute function public.set_result_group_snapshot();

create table public.notification_schedules (
  id uuid primary key default gen_random_uuid(),
  inspection_type_id uuid not null references public.inspection_types(id),
  shift_code text check (shift_code is null or shift_code in ('daily','night','morning','afternoon')),
  notification_kind text not null check (notification_kind in ('shift_summary','daily_summary')),
  send_local_time time not null, day_offset integer not null default 0, enabled boolean not null default false,
  channel_id_override text, timezone text not null default 'Asia/Bangkok',
  unique nulls not distinct (inspection_type_id, shift_code, notification_kind)
);
create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(), notification_kind text not null,
  reference_id uuid, target_channel_id text not null, payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  attempts integer not null default 0 check (attempts >= 0), next_retry_at timestamptz not null default now(),
  sent_at timestamptz, discord_message_id text, dedupe_key text not null unique,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index notification_outbox_pending_idx on public.notification_outbox(status,next_retry_at) where status in ('pending','failed');
create table public.notification_logs (
  id uuid primary key default gen_random_uuid(), outbox_id uuid not null references public.notification_outbox(id) on delete cascade,
  attempted_at timestamptz not null default now(), result text not null, error_text text
);

alter table public.notification_schedules enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.notification_logs enable row level security;
revoke all on public.notification_schedules, public.notification_outbox, public.notification_logs from anon, authenticated;

create or replace function public.queue_submission_notification()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_submission inspection_submissions%rowtype; v_type inspection_types%rowtype; v_payload jsonb; v_differences jsonb;
begin
  select * into v_submission from inspection_submissions where id=new.submission_id;
  if v_submission.source <> 'web_form' then return new; end if;
  select * into v_type from inspection_types where id=v_submission.inspection_type_id;
  if v_type.discord_channel_id is null or v_type.discord_channel_id='' then return new; end if;
  select coalesce(jsonb_agg(jsonb_build_object('item',item_name_snapshot,'variant',variant_label_snapshot,'standard',standard_qty_snapshot,'actual',actual_qty,'unit',unit_snapshot) order by item_name_snapshot) filter(where actual_qty is distinct from standard_qty_snapshot),'[]'::jsonb)
    into v_differences from inspection_results where submission_id=v_submission.id;
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

create constraint trigger queue_submission_notification_after_results
after insert or update on public.inspection_results deferrable initially deferred
for each row execute function public.queue_submission_notification();

create or replace function public.get_dashboard(p_work_date date)
returns jsonb language sql stable security definer set search_path=public as $$
with active_types as (
  select t.*,
    case when t.schedule_mode='daily' then 1 else coalesce((select count(*) filter(where s.required) from inspection_schedules s where s.inspection_type_id=t.id and s.effective_from<=p_work_date and (s.effective_to is null or s.effective_to>=p_work_date)),0) end::integer expected_slots
  from inspection_types t where t.is_active
), submissions as (
  select s.*, count(r.id)::integer completed_fields,
    count(r.id) filter(where r.actual_qty is distinct from r.standard_qty_snapshot)::integer difference_count
  from inspection_submissions s left join inspection_results r on r.submission_id=s.id
  where s.work_date=p_work_date group by s.id
), cards as (
  select t.id,t.sort_order,jsonb_build_object(
    'id',t.id,'slug',t.slug,'title_th',t.title_th,'schedule_mode',t.schedule_mode,
    'expected_slots',t.expected_slots,'submitted_slots',count(s.id)::integer,
    'required_submitted_slots',(case when t.schedule_mode='daily' then count(s.id) else count(s.id) filter(where exists(select 1 from inspection_schedules rs where rs.inspection_type_id=t.id and rs.shift_code=s.shift_code and rs.required and rs.effective_from<=p_work_date and (rs.effective_to is null or rs.effective_to>=p_work_date))) end)::integer,
    'is_complete',case when t.expected_slots=0 then null else (case when t.schedule_mode='daily' then count(s.id) else count(s.id) filter(where exists(select 1 from inspection_schedules rs where rs.inspection_type_id=t.id and rs.shift_code=s.shift_code and rs.required and rs.effective_from<=p_work_date and (rs.effective_to is null or rs.effective_to>=p_work_date))) end)>=t.expected_slots end,
    'latest_submitted_at',max(s.submitted_at),'latest_inspector',(array_agg(s.inspector_name order by s.submitted_at desc) filter(where s.id is not null))[1],
    'difference_count',coalesce(sum(s.difference_count),0)::integer,
    'submissions',coalesce(jsonb_agg(jsonb_build_object('id',s.id,'shift_code',s.shift_code,'inspector_name',s.inspector_name,'submitted_at',s.submitted_at,'completed_fields',s.completed_fields,'difference_count',s.difference_count,'revision_number',s.revision_number) order by s.submitted_at desc) filter(where s.id is not null),'[]'::jsonb),
    'differences',coalesce((select jsonb_agg(jsonb_build_object('submission_id',ss.id,'shift_code',ss.shift_code,'item',r.item_name_snapshot,'variant',r.variant_label_snapshot,'standard_qty',r.standard_qty_snapshot,'actual_qty',r.actual_qty,'unit',r.unit_snapshot) order by r.item_name_snapshot)
      from submissions ss join inspection_results r on r.submission_id=ss.id where ss.inspection_type_id=t.id and r.actual_qty is distinct from r.standard_qty_snapshot),'[]'::jsonb)
  ) card
  from active_types t left join submissions s on s.inspection_type_id=t.id group by t.id,t.slug,t.title_th,t.schedule_mode,t.expected_slots,t.sort_order
)
select jsonb_build_object(
  'work_date',p_work_date,
  'kpi',jsonb_build_object('expected_slots',coalesce(sum((card->>'expected_slots')::integer),0)::integer,'submitted_slots',coalesce(sum((card->>'required_submitted_slots')::integer),0)::integer,'missing_slots',coalesce(sum(greatest((card->>'expected_slots')::integer-(card->>'required_submitted_slots')::integer,0)),0)::integer,'difference_count',coalesce(sum((card->>'difference_count')::integer),0)::integer),
  'types',coalesce(jsonb_agg(card order by sort_order),'[]'::jsonb)
) from cards;
$$;

create or replace function public.get_inspection_history(p_from date,p_to date,p_type_slug text default null,p_limit integer default 50,p_offset integer default 0)
returns jsonb language sql stable security definer set search_path=public as $$
with filtered as (
  select s.*,t.slug,t.title_th,t.schedule_mode,
    count(r.id)::integer completed_fields,count(r.id) filter(where r.actual_qty is distinct from r.standard_qty_snapshot)::integer difference_count
  from inspection_submissions s join inspection_types t on t.id=s.inspection_type_id left join inspection_results r on r.submission_id=s.id
  where s.work_date between p_from and p_to and (p_type_slug is null or t.slug=p_type_slug)
  group by s.id,t.slug,t.title_th,t.schedule_mode
), page as (
  select f.*,coalesce((select jsonb_agg(jsonb_build_object('item',r.item_name_snapshot,'variant',r.variant_label_snapshot,'standard_qty',r.standard_qty_snapshot,'actual_qty',r.actual_qty,'unit',r.unit_snapshot) order by r.item_name_snapshot) from inspection_results r where r.submission_id=f.id and r.actual_qty is distinct from r.standard_qty_snapshot),'[]'::jsonb) differences
  from filtered f order by work_date desc,submitted_at desc limit least(greatest(p_limit,1),100) offset greatest(p_offset,0)
)
select jsonb_build_object('total',(select count(*) from filtered),'items',coalesce(jsonb_agg(jsonb_build_object(
  'id',id,'type_slug',slug,'title_th',title_th,'schedule_mode',schedule_mode,'work_date',work_date,'shift_code',shift_code,
  'inspector_name',inspector_name,'notes',notes,'submitted_at',submitted_at,'revision_number',revision_number,
  'completed_fields',completed_fields,'difference_count',difference_count,'differences',differences
) order by work_date desc,submitted_at desc),'[]'::jsonb)) from page;
$$;

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
      'submission',(select to_jsonb(x) from (select s.id,s.inspector_name,s.submitted_at,s.notes,count(r.id)::integer completed_count,count(r.id) filter(where r.actual_qty is distinct from r.standard_qty_snapshot)::integer difference_count from inspection_submissions s left join inspection_results r on r.submission_id=s.id where s.inspection_type_id=v_schedule.inspection_type_id and s.work_date=v_work_date and (v_schedule.shift_code is null or s.shift_code=v_schedule.shift_code) group by s.id order by s.submitted_at desc limit 1)x));
    insert into notification_outbox(notification_kind,reference_id,target_channel_id,payload,dedupe_key)
    values(v_schedule.notification_kind,null,v_channel,v_payload,'summary:'||v_schedule.notification_kind||':'||v_schedule.id::text||':'||v_work_date::text||':'||coalesce(v_schedule.shift_code,'daily'));
    v_count:=v_count+1;
  end loop;
  return v_count;
end $$;

create or replace function public.claim_notification_outbox(p_limit integer default 10)
returns setof public.notification_outbox language plpgsql security definer set search_path=public as $$
begin
  update notification_outbox set status='failed',next_retry_at=now(),updated_at=now()
  where status='processing' and updated_at<now()-interval '10 minutes' and attempts<8;
  return query
  with claimed as (
    select id from notification_outbox where status in ('pending','failed') and next_retry_at<=now() and attempts<8
    order by next_retry_at,created_at for update skip locked limit least(greatest(p_limit,1),25)
  )
  update notification_outbox o set status='processing',attempts=o.attempts+1,updated_at=now()
  from claimed where o.id=claimed.id returning o.*;
end $$;

revoke all on function public.get_dashboard(date), public.get_inspection_history(date,date,text,integer,integer), public.enqueue_due_notification_summaries(timestamptz),public.claim_notification_outbox(integer) from public,anon,authenticated;
grant execute on function public.get_dashboard(date), public.get_inspection_history(date,date,text,integer,integer), public.enqueue_due_notification_summaries(timestamptz),public.claim_notification_outbox(integer) to service_role;
