-- Run these once before enabling the job (replace placeholders in Supabase SQL Editor):
-- select vault.create_secret('https://YOUR_PROJECT.supabase.co','project_url');
-- select vault.create_secret('YOUR_SERVICE_ROLE_KEY','service_role_key');
-- select vault.create_secret('THE_SAME_LONG_RANDOM_VALUE_AS_EDGE_SECRET','scheduler_secret');

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname='hospital-inspection-discord-every-2-minutes';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
end $$;

select cron.schedule(
  'hospital-inspection-discord-every-2-minutes',
  '*/2 * * * *',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name='project_url' limit 1) || '/functions/v1/check-inspection-schedules',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='service_role_key' limit 1),
        'x-scheduler-secret',(select decrypted_secret from vault.decrypted_secrets where name='scheduler_secret' limit 1)
      ),
      body := jsonb_build_object('invoked_at',now()),
      timeout_milliseconds := 15000
    );
  $job$
);
