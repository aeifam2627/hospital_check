-- Include every measured value in Discord, even when it is within the accepted range.
-- Channel routing stays unchanged: one refrigerator channel, one room/humidity channel.
begin;

create or replace function public.inspection_notification_readings(p_submission_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'item',r.item_name_snapshot,'variant',r.variant_label_snapshot,'actual',r.actual_qty,'unit',r.unit_snapshot,
    'input_kind',r.input_kind_snapshot,'standard',r.standard_qty_snapshot,
    'comparison_mode',r.comparison_mode_snapshot,'standard_min',r.standard_min_snapshot,'standard_max',r.standard_max_snapshot,
    'outside_standard',public.inspection_result_outside_standard(r)
  ) order by case r.input_kind_snapshot when 'temperature' then 1 else 2 end,r.item_name_snapshot,r.variant_label_snapshot),'[]'::jsonb)
  from inspection_results r where r.submission_id=p_submission_id and r.input_kind_snapshot in ('temperature','humidity');
$$;
revoke all on function public.inspection_notification_readings(uuid) from public,anon,authenticated;
grant execute on function public.inspection_notification_readings(uuid) to service_role;

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
    'readings',public.inspection_notification_readings(v_submission.id),
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
      'submission',(select to_jsonb(x) from (select s.id,s.inspector_name,s.submitted_at,s.notes,public.inspection_notification_readings(s.id) readings,count(r.id)::integer completed_count,count(r.id) filter(where public.inspection_result_outside_standard(r))::integer difference_count from inspection_submissions s left join inspection_results r on r.submission_id=s.id where s.inspection_type_id=v_schedule.inspection_type_id and s.work_date=v_work_date and (v_schedule.shift_code is null or s.shift_code=v_schedule.shift_code) group by s.id order by s.submitted_at desc limit 1)x));
    insert into notification_outbox(notification_kind,reference_id,target_channel_id,payload,dedupe_key)
    values(v_schedule.notification_kind,null,v_channel,v_payload,'summary:'||v_schedule.notification_kind||':'||v_schedule.id::text||':'||v_work_date::text||':'||coalesce(v_schedule.shift_code,'daily'))
    on conflict(dedupe_key) do nothing;
    if found then v_count:=v_count+1; end if;
  end loop;
  return v_count+public.enqueue_missing_inspection_notifications(p_now);
end $$;

commit;
