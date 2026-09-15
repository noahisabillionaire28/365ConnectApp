-- 0016_updates_and_standby.sql
-- Nowsta-style additions:
--   1) shift_updates — updates & announcements a staffer posts to a shift.
--   2) a 'standby' application status (waitlist when a shift is full).
--   3) a trigger that frees a spot when a booked worker is released
--      (dropped / removed), reopening the shift so standbys can be confirmed.

/* ── 1. Shift updates / announcements ─────────────────────────────────────── */
create table if not exists public.shift_updates (
  id         uuid primary key default gen_random_uuid(),
  shift_id   uuid not null references public.shifts(id) on delete cascade,
  author_id  uuid not null references public.users(id) on delete cascade,
  kind       text not null default 'update' check (kind in ('update', 'announcement')),
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists shift_updates_shift_idx on public.shift_updates(shift_id, created_at desc);

alter table public.shift_updates enable row level security;
drop policy if exists "shift_updates_select" on public.shift_updates;
-- Reads happen through the service-role backend, which scopes them to the shift
-- owner + booked workers; allow authenticated selects, writes are backend-only.
create policy "shift_updates_select" on public.shift_updates for select using (auth.role() = 'authenticated');

/* ── 2. 'standby' application status (waitlist) ───────────────────────────── */
alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications
  add constraint applications_status_check
  check (status in ('pending', 'accepted', 'rejected', 'declined', 'withdrawn', 'standby'));

/* ── 3. Free a spot when a booked worker is released ──────────────────────── */
-- When an application leaves 'accepted' (worker drops, or staffer removes),
-- decrement spots_filled and flip a 'filled' shift back to 'open' so the spot
-- can be re-filled (e.g. by confirming a standby worker).
create or replace function public.handle_application_released()
returns trigger language plpgsql security definer as $$
begin
  if old.status = 'accepted'
     and new.status in ('withdrawn', 'declined', 'rejected') then
    update public.shifts
    set spots_filled = greatest(0, spots_filled - 1),
        status = case when status = 'filled' then 'open' else status end
    where id = new.shift_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_handle_application_released on public.applications;
create trigger trg_handle_application_released
  after update on public.applications
  for each row
  when (old.status is distinct from new.status)
  execute function public.handle_application_released();
