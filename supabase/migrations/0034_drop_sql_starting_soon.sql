-- 0034: one "starting soon" producer.
--
-- schema.sql once defined public.notify_shifts_starting_soon() plus a
-- commented pg_cron schedule for it. The API's cron tick (routes/cron.ts,
-- driven by the 365connect-tick job from migration 0032) now sends the same
-- reminder with the shift's details, push and email, and dedupes on the
-- notifications table — two producers would race and a worker could be told
-- twice. Live, the function was never created and the job never scheduled;
-- this migration guarantees that on any database built from schema.sql too.
-- Idempotent: safe to re-run.

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron')
     and exists (select 1 from cron.job where jobname = 'notify-shifts-starting-soon') then
    perform cron.unschedule('notify-shifts-starting-soon');
  end if;
end $$;

drop function if exists public.notify_shifts_starting_soon();
