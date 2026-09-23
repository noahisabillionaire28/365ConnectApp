-- 0026_arrival_status.sql
-- Day-of reliability for booked workers:
--   1) arrival_status / arrival_status_at — the worker's self-reported day-of
--      status ('on_my_way' | 'running_late' | 'arrived'); 'arrived' is also set
--      automatically when the worker clocks in.
--   2) callout_reason — why a booked worker called out (their application is
--      set to 'withdrawn' and the earliest standby worker is auto-promoted).
alter table public.applications
  add column if not exists arrival_status text
    check (arrival_status is null or arrival_status in ('on_my_way', 'running_late', 'arrived'));
alter table public.applications
  add column if not exists arrival_status_at timestamptz;
alter table public.applications
  add column if not exists callout_reason text;
