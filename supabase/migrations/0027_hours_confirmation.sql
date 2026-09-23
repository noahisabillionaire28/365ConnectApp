-- 0027_hours_confirmation.sql
-- Worker confirmation of approved hours (the trust moment after a shift):
--   clocked_hours — billable hours as computed at clock-out, kept so the app
--                   can show "5h 12m → 4h 45m" after the poster changes them.
--   worker_ack    — null | 'accepted' | 'disputed' once the poster approved.
--   worker_ack_at — when the worker answered.
--   dispute_note  — the worker's optional note when disputing.
alter table public.time_entries
  add column if not exists clocked_hours numeric;
alter table public.time_entries
  add column if not exists worker_ack text
    check (worker_ack is null or worker_ack in ('accepted', 'disputed'));
alter table public.time_entries
  add column if not exists worker_ack_at timestamptz;
alter table public.time_entries
  add column if not exists dispute_note text;
