-- 0018_event_positions.sql
-- Multi-position events: one event = several position-shifts that share an
-- event_id. Each position keeps its own role, pay rate, headcount, roster,
-- clock-in, and timesheet — so all existing per-shift machinery is reused.
alter table public.shifts
  add column if not exists event_id uuid;

create index if not exists shifts_event_idx on public.shifts(event_id) where event_id is not null;
