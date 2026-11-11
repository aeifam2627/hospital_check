-- Run against a disposable database after schema, reporting, legacy-import, seed,
-- and 202611110001_environment_inspections.sql. All test records are rolled back.
begin;
do $$
declare f jsonb; p jsonb; result jsonb; variant uuid; room_variant uuid; humidity_variant uuid; medication_variant uuid; submission uuid; failures integer;
begin
  f:=public.get_inspection_form('refrigerator-temperature','2026-11-11','morning');
  assert jsonb_array_length(f->'schedules')=2, 'expected morning and afternoon';
  variant:=(f->'groups'->0->'items'->0->'variants'->0->>'id')::uuid;
  update inspection_types set discord_channel_id='test-only' where slug='refrigerator-temperature';
  assert f->'groups'->0->'items'->0->'variants'->0->>'input_kind'='temperature';
  p:=jsonb_build_object('type_slug','refrigerator-temperature','work_date','2026-11-11','shift_code','morning',
    'inspector_name','ผู้ตรวจทดสอบ','notes','ตรวจซ้ำแล้ว','revision_expected',0,'idempotency_key',gen_random_uuid(),
    'results',jsonb_build_array(jsonb_build_object('variant_id',variant,'actual_qty',5.25)));
  result:=public.save_inspection_submission(p); submission:=(result->>'id')::uuid;
  assert (select actual_qty=5.25 and not public.inspection_result_outside_standard(r) from inspection_results r where submission_id=submission);
  assert (public.get_inspection_history('2026-11-11','2026-11-11','refrigerator-temperature')->'items'->0->>'difference_count')::integer=0;
  assert (public.get_dashboard('2026-11-11')->'kpi'->>'difference_count')::integer=0;
  assert public.save_inspection_submission(p)->>'id'=submission::text, 'idempotent retry';
  p:=p||jsonb_build_object('idempotency_key',gen_random_uuid(),'results',jsonb_build_array(jsonb_build_object('variant_id',variant,'actual_qty',-1.25)));
  result:=public.save_inspection_submission(p);
  assert (result->>'revision_number')::integer=1;
  assert (select actual_qty=-1.25 and public.inspection_result_outside_standard(r) from inspection_results r where submission_id=submission);
  assert (public.get_inspection_history('2026-11-11','2026-11-11','refrigerator-temperature')->'items'->0->>'difference_count')::integer=1;
  assert (public.get_dashboard('2026-11-11')->'kpi'->>'difference_count')::integer=1;
  set constraints all immediate;
  assert (select (payload->>'difference_count')::integer=1 and payload->'differences'->0->>'comparison_mode'='range'
    and payload->'differences'->0->>'standard_min'='2' and payload->>'notes'='ตรวจซ้ำแล้ว'
    from notification_outbox where reference_id=submission order by created_at desc limit 1), 'range-aware notification payload';
  update variant_standards set standard_min=-10,standard_max=10 where variant_id=variant;
  assert (select standard_min_snapshot=2 and standard_max_snapshot=8 and public.inspection_result_outside_standard(r) from inspection_results r where submission_id=submission), 'historical snapshot';
  failures:=0;
  begin perform public.save_inspection_submission(p||jsonb_build_object('idempotency_key',gen_random_uuid())); exception when sqlstate 'P0002' then failures:=failures+1; end;
  begin perform public.get_inspection_form('refrigerator-temperature','2026-11-11','night'); exception when sqlstate 'P0001' then failures:=failures+1; end;
  begin perform public.save_inspection_submission(p||jsonb_build_object('shift_code','night')); exception when sqlstate 'P0001' then failures:=failures+1; end;
  begin perform public.get_inspection_form('room-environment','2026-11-10','morning'); exception when sqlstate 'P0001' then failures:=failures+1; end;
  assert failures=4, 'conflicts, unsupported shifts, and pre-activation date must fail';

  f:=public.get_inspection_form('room-environment','2026-11-11','afternoon');
  room_variant:=(f->'groups'->0->'items'->0->'variants'->0->>'id')::uuid;
  humidity_variant:=(f->'groups'->0->'items'->1->'variants'->0->>'id')::uuid;
  p:=p||jsonb_build_object('type_slug','room-environment','shift_code','afternoon','revision_expected',0,'idempotency_key',gen_random_uuid(),
    'results',jsonb_build_array(jsonb_build_object('variant_id',room_variant,'actual_qty',24),jsonb_build_object('variant_id',humidity_variant,'actual_qty',60)));
  result:=public.save_inspection_submission(p); submission:=(result->>'id')::uuid;
  assert (select count(*)=2 from inspection_results r where submission_id=submission and not public.inspection_result_outside_standard(r)), 'inclusive upper bounds';
  p:=p||jsonb_build_object('idempotency_key',gen_random_uuid(),'results',jsonb_build_array(jsonb_build_object('variant_id',room_variant,'actual_qty',24.01),jsonb_build_object('variant_id',humidity_variant,'actual_qty',60.01)));
  result:=public.save_inspection_submission(p);
  assert (select count(*)=2 from inspection_results r where submission_id=submission and public.inspection_result_outside_standard(r));
  failures:=0;
  begin perform public.save_inspection_submission(p||jsonb_build_object('revision_expected',1,'idempotency_key',gen_random_uuid(),'results',jsonb_build_array(jsonb_build_object('variant_id',room_variant,'actual_qty',24),jsonb_build_object('variant_id',humidity_variant,'actual_qty',100.01)))); exception when sqlstate 'P0001' then failures:=failures+1; end;
  begin perform public.save_inspection_submission(p||jsonb_build_object('revision_expected',1,'idempotency_key',gen_random_uuid(),'results',jsonb_build_array(jsonb_build_object('variant_id',room_variant,'actual_qty',24.001),jsonb_build_object('variant_id',humidity_variant,'actual_qty',50)))); exception when sqlstate 'P0001' then failures:=failures+1; end;
  assert failures=2, 'invalid numeric values must not be silently rounded';
  assert (select revision_number=1 from inspection_submissions where id=submission), 'invalid writes must roll back';

  -- Existing medication counts must retain integer validation even through direct RPC calls.
  f:=public.get_inspection_form('medication','2026-11-11','morning');
  select (entry->>'id')::uuid into medication_variant from jsonb_array_elements(f->'groups'->0->'items'->0->'variants') entry limit 1;
  failures:=0;
  begin
    insert into inspection_results(submission_id,variant_id,actual_qty,standard_qty_snapshot,item_name_snapshot,unit_snapshot)
      values(submission,medication_variant,1.5,2,'count','Amp');
  exception when sqlstate 'P0001' then failures:=failures+1; end;
  assert failures=1, 'inventory must reject fractional counts';
end $$;
rollback;
