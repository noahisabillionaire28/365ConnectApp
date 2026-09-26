-- 0030_shift_series_and_templates.sql
--
-- Recurring shifts: a poster picks "Daily / Weekly / Custom dates" in the
-- wizard and one shift_series row groups the N shifts it creates (max 12).
-- Every occurrence is a normal shift with its own instants, roster and
-- lifecycle; the series only ties them together so the poster can find the
-- siblings and cancel "this and all future shifts" in one go.
create table if not exists public.shift_series (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.users(id) on delete cascade,
  title      text not null,
  -- The rule the poster chose ({type, weekdays, ends, occurrences}) — kept for
  -- display only; the shifts themselves are the source of truth.
  rule       jsonb not null default '{}'::jsonb,
  timezone   text not null default 'America/New_York',
  created_at timestamptz not null default now()
);
create index if not exists shift_series_client_idx on public.shift_series(client_id, created_at desc);

alter table public.shifts
  add column if not exists series_id uuid references public.shift_series(id) on delete set null;
create index if not exists shifts_series_idx on public.shifts(series_id) where series_id is not null;

alter table public.shift_series enable row level security;
drop policy if exists "shift_series_select" on public.shift_series;
create policy "shift_series_select" on public.shift_series for select using (auth.uid() = client_id);

-- Shift templates: a poster saves a shift's details (everything but the
-- dates) under a name and starts the next post from it.
create table if not exists public.shift_templates (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.users(id) on delete cascade,
  name         text not null,
  payload      jsonb not null,
  use_count    int not null default 0,
  last_used_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists shift_templates_client_idx on public.shift_templates(client_id, updated_at desc);

alter table public.shift_templates enable row level security;
drop policy if exists "shift_templates_select" on public.shift_templates;
drop policy if exists "shift_templates_insert" on public.shift_templates;
drop policy if exists "shift_templates_update" on public.shift_templates;
drop policy if exists "shift_templates_delete" on public.shift_templates;
create policy "shift_templates_select" on public.shift_templates for select using (auth.uid() = client_id);
create policy "shift_templates_insert" on public.shift_templates for insert with check (auth.uid() = client_id);
create policy "shift_templates_update" on public.shift_templates for update using (auth.uid() = client_id);
create policy "shift_templates_delete" on public.shift_templates for delete using (auth.uid() = client_id);
