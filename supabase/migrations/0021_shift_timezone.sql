-- Shift times become real instants tagged with the venue's IANA time zone.
--
-- Before: the app saved the venue wall-clock time labelled UTC
--   (6:00 PM Miami → 2026-08-20 18:00:00+00) and rendered it in UTC.
-- Every rule that compared against now() (clock-in windows, late flags,
-- reminders, "shift ended") was therefore off by the venue's UTC offset.
--
-- After: start_time/end_time are true instants and `timezone` says how to
-- display them. Existing rows were all posted from Miami, so they are
-- re-interpreted as America/New_York wall-clock times.

alter table public.shifts
  add column if not exists timezone text not null default 'America/New_York';

-- Convert legacy rows exactly once (the column is new, so every row still has
-- the default and its times are still "wall clock labelled UTC").
update public.shifts
set start_time = (start_time at time zone 'UTC') at time zone 'America/New_York',
    end_time   = (end_time   at time zone 'UTC') at time zone 'America/New_York'
where timezone = 'America/New_York'
  and created_at < now();

-- Shifts whose end has passed are no longer open. (The API also sweeps this
-- lazily; this just tidies historical rows.)
update public.shifts
set status = 'completed'
where status in ('open', 'filled')
  and end_time < now();
