-- 0029_shift_swaps.sql
-- Shift swaps: a booked worker offers their spot to another worker. The other
-- worker accepts or declines; then the poster approves or declines. On
-- approval the spot moves (the offering worker's application becomes
-- 'withdrawn' with callout_reason 'swap', the new worker is booked).
--
-- status lifecycle:
--   offered → accepted → approved
--   offered → declined_by_worker
--   offered | accepted → declined_by_poster | cancelled (by the offering worker,
--   or automatically when they call out / are removed) | expired (shift started)
create table if not exists public.shift_swaps (
  id             uuid primary key default gen_random_uuid(),
  shift_id       uuid not null references public.shifts(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  from_worker_id uuid not null references public.users(id) on delete cascade,
  to_worker_id   uuid not null references public.users(id) on delete cascade,
  status         text not null default 'offered'
    check (status in ('offered', 'accepted', 'approved', 'declined_by_worker', 'declined_by_poster', 'cancelled', 'expired')),
  note           text,
  created_at     timestamptz not null default now(),
  responded_at   timestamptz,
  decided_at     timestamptz,
  decided_by     uuid references public.users(id) on delete set null
);
create index if not exists shift_swaps_shift_idx  on public.shift_swaps(shift_id, created_at desc);
create index if not exists shift_swaps_to_idx     on public.shift_swaps(to_worker_id, created_at desc);
create index if not exists shift_swaps_from_idx   on public.shift_swaps(from_worker_id, created_at desc);
-- An application has at most one swap in flight.
create unique index if not exists shift_swaps_one_active_idx
  on public.shift_swaps(application_id)
  where status in ('offered', 'accepted');

-- Only ever written by the service-role backend. Direct reads are limited to
-- the two workers involved; the poster reads through the API.
alter table public.shift_swaps enable row level security;
drop policy if exists "shift_swaps_select" on public.shift_swaps;
create policy "shift_swaps_select" on public.shift_swaps
  for select using (auth.uid() = from_worker_id or auth.uid() = to_worker_id);
