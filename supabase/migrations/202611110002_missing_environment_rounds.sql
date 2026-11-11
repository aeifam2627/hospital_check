-- Run after 202611110001_environment_inspections.sql.
-- The existing two-minute scheduler also checks missing environmental rounds.
begin;

alter table public.inspection_schedules
  add column if not exists start_local_time time,
  add column if not exists missing_alerts_enabled_from timestamptz;

-- Midnight belongs to the preceding work date: 24:00 = 00:00 on the next day.
update public.inspection_schedules s set
  start_local_time=case s.shift_code when 'morning' then time '08:00' else time '17:00' end,
  cutoff_local_time=case s.shift_code when 'morning' then time '16:00' else time '00:00' end,
  cutoff_day_offset=case s.shift_code when 'morning' then 0 else 1 end,
  timezone='Asia/Bangkok',
  missing_alerts_enabled_from=coalesce(s.missing_alerts_enabled_from,now())
from public.inspection_types t
where s.inspection_type_id=t.id and t.slug in ('refrigerator-temperature','room-environment')
  and s.shift_code in ('morning','afternoon');

alter table public.notification_outbox drop constraint notification_outbox_status_check;
alter table public.notification_outbox add constraint notification_outbox_status_check
  check (status in ('pending','processing','sent','failed','cancelled'));

create or replace function public.is_inspection_round_missing(p_type_slug text,p_work_date date,p_shift_code text)
returns boolean language sql stable security definer set search_path=public as $$
  select not exists(
    select 1 from inspection_submissions s join inspection_types t on t.id=s.inspection_type_id
    where t.slug=p_type_slug and s.work_date=p_work_date and s.shift_code=p_shift_code and s.import_status='complete'
  );
$$;

create or replace function public.enqueue_missing_inspection_notifications(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path=public as $$
declare v_count integer;
begin
  with candidates as (
    select distinct on (t.id,s.shift_code,d.work_date)
      t.id type_id,t.slug,t.title_th,t.discord_channel_id,s.shift_code,s.start_local_time,s.cutoff_local_time,
      s.cutoff_day_offset,s.timezone,s.missing_alerts_enabled_from,d.work_date,
      ((d.work_date+s.cutoff_day_offset+s.cutoff_local_time) at time zone s.timezone) deadline
    from inspection_types t join inspection_schedules s on s.inspection_type_id=t.id
    cross join lateral (
      select (p_now at time zone s.timezone)::date-n work_date from generate_series(0,1) n
    ) d
    where t.is_active and s.required and s.cutoff_local_time is not null and s.missing_alerts_enabled_from is not null
      and nullif(trim(t.discord_channel_id),'') is not null
      and s.effective_from<=d.work_date and (s.effective_to is null or s.effective_to>=d.work_date)
    order by t.id,s.shift_code,d.work_date,s.effective_from desc
  )
  insert into notification_outbox(notification_kind,target_channel_id,payload,dedupe_key)
  select 'missing_round',c.discord_channel_id,jsonb_build_object(
    'kind','missing_round','type_slug',c.slug,'title_th',c.title_th,'work_date',c.work_date,'shift_code',c.shift_code,
    'window_start',to_char(c.start_local_time,'HH24:MI'),
    'window_end',case when c.cutoff_day_offset=1 and c.cutoff_local_time=time '00:00' then '24:00' else to_char(c.cutoff_local_time,'HH24:MI') end,
    'deadline',c.deadline,'checked_at',p_now,'timezone',c.timezone,
    'detail_path','/inspect/'||c.slug||'?date='||c.work_date::text||'&shift='||c.shift_code
  ),'missing:'||c.type_id::text||':'||c.work_date::text||':'||c.shift_code
  from candidates c
  where c.deadline<=p_now and c.deadline>p_now-interval '24 hours'
    and c.deadline>=c.missing_alerts_enabled_from
    and public.is_inspection_round_missing(c.slug,c.work_date,c.shift_code)
  on conflict(dedupe_key) do nothing;
  get diagnostics v_count=row_count;
  return v_count;
end $$;

revoke all on function public.is_inspection_round_missing(text,date,text),public.enqueue_missing_inspection_notifications(timestamptz) from public,anon,authenticated;
grant execute on function public.is_inspection_round_missing(text,date,text),public.enqueue_missing_inspection_notifications(timestamptz) to service_role;

-- Preserve the public scheduler entrypoint used by the Edge Function and local worker.
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
    values(v_schedule.notification_kind,null,v_channel,v_payload,'summary:'||v_schedule.notification_kind||':'||v_schedule.id::text||':'||v_work_date::text||':'||coalesce(v_schedule.shift_code,'daily'))
    on conflict(dedupe_key) do nothing;
    if found then v_count:=v_count+1; end if;
  end loop;
  return v_count+public.enqueue_missing_inspection_notifications(p_now);
end $$;

commit;
