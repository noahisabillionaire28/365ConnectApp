-- 0017_timesheet_approval.sql
-- Nowsta-style timesheet approval + overtime.
-- After a worker clocks out, the entry is UNAPPROVED. The staffer reviews the
-- hours (adjusting the break if needed), then approves — which computes regular
-- vs overtime hours and the final approved pay. Payment is only allowed after
-- approval.
alter table public.time_entries
  add column if not exists approved       boolean not null default false,
  add column if not exists approved_at    timestamptz,
  add column if not exists approved_by    uuid references public.users(id),
  add column if not exists regular_hours  numeric,
  add column if not exists overtime_hours numeric,
  add column if not exists approved_pay   numeric;

create index if not exists time_entries_approved_idx
  on public.time_entries(shift_id) where approved = false;
