-- 0028_saved_searches.sql
-- Saved search alerts: a worker keeps up to three filter sets ("Bartender,
-- $30+/hr, within 5 mi, Weddings") and the cron tells them when a new open
-- public shift matches. Private to the owner; the service-role backend reads
-- and writes it, RLS scopes direct access to the owner.
create table if not exists public.saved_searches (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users(id) on delete cascade,
  job_types          text[] not null default '{}',
  max_distance_miles numeric,
  min_pay            numeric,
  event_type         text,
  created_at         timestamptz not null default now(),
  last_notified_at   timestamptz
);
create index if not exists saved_searches_user_idx on public.saved_searches(user_id, created_at desc);

alter table public.saved_searches enable row level security;
drop policy if exists "saved_searches_select" on public.saved_searches;
drop policy if exists "saved_searches_insert" on public.saved_searches;
drop policy if exists "saved_searches_delete" on public.saved_searches;
create policy "saved_searches_select" on public.saved_searches for select using (auth.uid() = user_id);
create policy "saved_searches_insert" on public.saved_searches for insert with check (auth.uid() = user_id);
create policy "saved_searches_delete" on public.saved_searches for delete using (auth.uid() = user_id);
