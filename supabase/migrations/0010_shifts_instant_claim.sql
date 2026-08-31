-- 0010_shifts_instant_claim.sql
-- "Open Claim" shifts: any qualified worker can grab the shift instantly with no
-- approval step (first-come, first-served). Default off = normal apply/approve.
alter table public.shifts
  add column if not exists instant_claim boolean not null default false;
