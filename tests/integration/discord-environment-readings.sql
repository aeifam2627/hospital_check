-- Disposable PostgreSQL only after 202611110003. Entire test rolls back; no Discord calls.
begin;
set constraints all immediate;
do $$
declare f jsonb; p jsonb; results jsonb; submission uuid; payload jsonb; queued integer;
begin
  update inspection_types set discord_channel_id=case slug
    when 'refrigerator-temperature' then '111111111111111111' else '222222222222222222' end
    where slug in ('refrigerator-temperature','room-environment');

  f:=public.get_inspection_form('refrigerator-temperature','2026-11-11','morning');
  p:=jsonb_build_object('type_slug','refrigerator-temperature','work_date','2026-11-11','shift_code','morning',
    'inspector_name','ผู้ตรวจทดสอบ','notes','','revision_expected',0,'idempotency_key',gen_random_uuid(),
    'results',jsonb_build_array(jsonb_build_object('variant_id',f->'groups'->0->'items'->0->'variants'->0->>'id','actual_qty',5.25)));
  submission:=(public.save_inspection_submission(p)->>'id')::uuid;
  select o.payload into payload from notification_outbox o where o.reference_id=submission;
  assert (select target_channel_id='111111111111111111' from notification_outbox where reference_id=submission);
  assert jsonb_array_length(payload->'readings')=1;
  assert jsonb_array_length(payload->'differences')=0, 'normal temperature must appear even without differences';
  assert (payload->'readings'->0->>'actual')::numeric=5.25;
  assert (payload->'readings'->0->>'standard_min')::numeric=2;
  assert not (payload->'readings'->0->>'outside_standard')::boolean;
  assert (payload->'readings'->0->>'input_kind')='temperature';

  f:=public.get_inspection_form('room-environment','2026-11-11','morning');
  select jsonb_agg(jsonb_build_object('variant_id',v->>'id','actual_qty',case v->>'input_kind' when 'temperature' then 23.5 else 0 end)) into results
    from jsonb_array_elements(f->'groups') g cross join lateral jsonb_array_elements(g->'items') i cross join lateral jsonb_array_elements(i->'variants') v;
  p:=p||jsonb_build_object('type_slug','room-environment','idempotency_key',gen_random_uuid(),'results',results);
  submission:=(public.save_inspection_submission(p)->>'id')::uuid;
  select o.payload into payload from notification_outbox o where o.reference_id=submission;
  assert (select target_channel_id='222222222222222222' from notification_outbox where reference_id=submission), 'same existing room/humidity channel';
  assert (select count(*)=1 from notification_outbox where reference_id=submission), 'one combined notification';
  assert jsonb_array_length(payload->'readings')=2;
  assert (payload->'readings'->0->>'actual')::numeric=23.5;
  assert (payload->'readings'->1->>'actual')::numeric=0, 'zero humidity is preserved';
  assert (payload->'readings'->1->>'unit')='%';
  assert not (payload->'readings'->1->>'outside_standard')::boolean;

  select jsonb_agg(jsonb_build_object('variant_id',v->>'id','actual_qty',case v->>'input_kind' when 'temperature' then 25 else 65.5 end)) into results
    from jsonb_array_elements(f->'groups') g cross join lateral jsonb_array_elements(g->'items') i cross join lateral jsonb_array_elements(i->'variants') v;
  perform public.save_inspection_submission(p||jsonb_build_object('idempotency_key',gen_random_uuid(),'results',results,'notes','ตรวจซ้ำแล้ว'));
  select o.payload into payload from notification_outbox o where o.reference_id=submission and o.payload->>'revision_number'='1';
  assert (payload->>'difference_count')::integer=2;
  assert (payload->'readings'->0->>'outside_standard')::boolean;
  assert (payload->'readings'->1->>'outside_standard')::boolean;
  assert payload->>'notes'='ตรวจซ้ำแล้ว';

  insert into notification_schedules(inspection_type_id,shift_code,notification_kind,send_local_time,enabled)
    select id,'morning','shift_summary','16:00',true from inspection_types where slug='room-environment';
  queued:=public.enqueue_due_notification_summaries('2026-11-11 16:00+07');
  select o.payload into payload from notification_outbox o where notification_kind='shift_summary';
  assert jsonb_array_length(payload->'submission'->'readings')=2, 'summaries include every reading';
  assert (payload->'submission'->'readings'->0->>'actual')::numeric=25;
  assert (payload->'submission'->'readings'->1->>'actual')::numeric=65.5;
  assert (select inspection_notification_readings(s.id)='[]'::jsonb from inspection_submissions s where s.id=submission) is false;
end $$;
rollback;
