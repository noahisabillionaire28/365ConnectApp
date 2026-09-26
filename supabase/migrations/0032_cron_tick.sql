-- 0032: the background clock.
--
-- The API's POST /api/cron/tick (reminders, unfilled nudges, rating prompts,
-- saved-search alerts, sweeps) is driven by a pg_cron job that has lived only
-- in the live database until now. Vercel's own cron in api-server/vercel.json
-- runs the same route once a day as a backstop.
--
-- This migration records the schedule so a fresh database gets it, and is a
-- no-op where the job already exists. The bearer token is NEVER stored in a
-- file: it is read from the database setting `app.cron_secret`, which the
-- project owner sets once with
--
--     alter database postgres set app.cron_secret = '<the CRON_SECRET from Vercel>';
--     alter database postgres set app.cron_url    = 'https://365-connect-api.vercel.app/api/cron/tick';
--
-- (both settings are then visible to pg_cron's sessions). To rotate the secret:
-- update the Vercel env var, re-run the two ALTERs, then
-- `select cron.unschedule('365connect-tick')` and re-apply this migration.
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  cron_url    text := current_setting('app.cron_url', true);
  cron_secret text := current_setting('app.cron_secret', true);
begin
  if exists (select 1 from cron.job where jobname = '365connect-tick') then
    raise notice '365connect-tick already scheduled - leaving it as is';
    return;
  end if;
  if cron_secret is null or cron_secret = '' then
    raise notice 'app.cron_secret is not set - 365connect-tick NOT scheduled (see migration header)';
    return;
  end if;
  if cron_url is null or cron_url = '' then
    cron_url := 'https://365-connect-api.vercel.app/api/cron/tick';
  end if;

  perform cron.schedule(
    '365connect-tick',
    '*/15 * * * *',
    format(
      $job$ select net.http_post(
        url := %L,
        headers := jsonb_build_object('Authorization', %L, 'Content-Type', 'application/json'),
        body := '{}'::jsonb,
        timeout_milliseconds := 25000
      ); $job$,
      cron_url,
      'Bearer ' || cron_secret
    )
  );
end $$;
