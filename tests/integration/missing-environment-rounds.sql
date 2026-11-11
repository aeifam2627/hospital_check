-- Disposable PostgreSQL only, after both environmental migrations. No Discord calls.
begin;

create function pg_temp.record_round(slug text,work_date date,shift text)
returns void language plpgsql as $$
declare f jsonb; results jsonb;
begin
  f:=public.get_inspection_form(slug,work_date,shift);
  select jsonb_agg(jsonb_build_object('variant_id',v->>'id','actual_qty',(v->>'standard_qty')::numeric)) into results
  from jsonb_array_elements(f->'groups') g cross join lateral jsonb_array_elements(g->'items') i
  cross join lateral jsonb_array_elements(i->'variants') v;
  perform public.save_inspection_submission(jsonb_build_object('type_slug',slug,'work_date',work_date,'shift_code',shift,
    'inspector_name','ผู้ตรวจทดสอบ','notes','','revision_expected',0,'idempotency_key',gen_random_uuid(),'results',results));
end $$;

do $$
begin
  update public.inspection_types set discord_channel_id='123456789012345678'
    where slug in ('refrigerator-temperature','room-environment');
  update public.inspection_schedules set missing_alerts_enabled_from='2026-11-11 00:00+07'
    where inspection_type_id in (select id from inspection_types where slug in ('refrigerator-temperature','room-environment'));
  assert public.enqueue_due_notification_summaries('2026-11-11 07:59:59+07')=0;
  assert public.enqueue_due_notification_summaries('2026-11-11 15:59:59+07')=0, 'no early morning alert';
  assert public.enqueue_due_notification_summaries('2026-11-11 16:00:00+07')=2, 'one alert per environmental type';
  assert public.enqueue_due_notification_summaries('2026-11-11 16:02:00+07')=0, 'no duplicate every two minutes';
  assert (select count(*)=2 from notification_outbox where notification_kind='missing_round' and payload->>'shift_code'='morning' and payload->>'window_start'='08:00' and payload->>'window_end'='16:00');
  assert public.enqueue_due_notification_summaries('2026-11-11 23:59:59+07')=0, 'no early afternoon alert';
  assert public.enqueue_due_notification_summaries('2026-11-12 00:00:00+07')=2, 'midnight closes preceding work date';
  assert (select count(*)=2 from notification_outbox where notification_kind='missing_round' and payload->>'work_date'='2026-11-11' and payload->>'shift_code'='afternoon' and payload->>'window_end'='24:00');
  assert public.enqueue_due_notification_summaries('2026-11-12 00:02:00+07')=0;
  assert (select count(*)=0 from notification_outbox where notification_kind='missing_round' and payload->>'work_date'='2026-11-12'), 'never label yesterday evening as today';

  perform pg_temp.record_round('refrigerator-temperature','2026-11-11','morning');
  assert not public.is_inspection_round_missing('refrigerator-temperature','2026-11-11','morning'), 'sender can cancel an already queued alert';
  delete from notification_outbox where notification_kind='missing_round';
  assert public.enqueue_missing_inspection_notifications('2026-11-11 16:02:00+07')=1, 'completed round skipped';
  perform pg_temp.record_round('room-environment','2026-11-11','morning');
  delete from notification_outbox where notification_kind='missing_round';
  assert public.enqueue_missing_inspection_notifications('2026-11-11 16:02:00+07')=0;

  update inspection_submissions set import_status='partial' where work_date='2026-11-11' and shift_code='morning';
  assert public.enqueue_missing_inspection_notifications('2026-11-11 16:02:00+07')=2, 'partial import is not a completed round';
  delete from notification_outbox where notification_kind='missing_round';
  update inspection_schedules set missing_alerts_enabled_from='2026-11-11 17:00+07' where missing_alerts_enabled_from is not null;
  assert public.enqueue_missing_inspection_notifications('2026-11-11 18:00+07')=0, 'activation never backfills older deadlines';
  update inspection_schedules set missing_alerts_enabled_from='2026-11-11 00:00+07' where missing_alerts_enabled_from is not null;
  update inspection_types set discord_channel_id=null where slug='room-environment';
  assert public.enqueue_missing_inspection_notifications('2026-11-11 18:00+07')=1, 'unconfigured channel skipped';
  delete from notification_outbox where notification_kind='missing_round';
  update inspection_schedules set required=false where missing_alerts_enabled_from is not null;
  assert public.enqueue_missing_inspection_notifications('2026-11-11 18:00+07')=0, 'optional round skipped';
  update inspection_schedules set required=true,effective_to='2026-11-11' where missing_alerts_enabled_from is not null;
  assert public.enqueue_missing_inspection_notifications('2026-11-13 18:00+07')=0, 'old deadlines beyond recovery window and expired schedules skipped';
end $$;

rollback;
