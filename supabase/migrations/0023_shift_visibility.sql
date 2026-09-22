-- Roster-only shifts: an agency can post a shift that only workers on its
-- roster (follows.follower_id = the agency) can see, apply to, or claim.
alter table public.shifts
  add column if not exists visibility text not null default 'public';

alter table public.shifts
  drop constraint if exists shifts_visibility_check;
alter table public.shifts
  add constraint shifts_visibility_check check (visibility in ('public', 'roster'));

create index if not exists shifts_visibility_idx on public.shifts (visibility) where visibility <> 'public';
