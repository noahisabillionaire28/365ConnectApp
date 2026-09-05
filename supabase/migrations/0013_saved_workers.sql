-- 0013_saved_workers.sql
-- Clients/staffers bookmark workers ("my go-to bartenders") for fast re-hire.
-- Private to the owner. Read/written by the service-role backend; RLS scopes to owner.
create table if not exists public.saved_workers (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.users(id) on delete cascade,
  worker_id  uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (owner_id, worker_id)
);
alter table public.saved_workers enable row level security;
drop policy if exists "saved_workers_select" on public.saved_workers;
drop policy if exists "saved_workers_insert" on public.saved_workers;
drop policy if exists "saved_workers_delete" on public.saved_workers;
create policy "saved_workers_select" on public.saved_workers for select using (auth.uid() = owner_id);
create policy "saved_workers_insert" on public.saved_workers for insert with check (auth.uid() = owner_id);
create policy "saved_workers_delete" on public.saved_workers for delete using (auth.uid() = owner_id);
create index if not exists saved_workers_owner_idx on public.saved_workers(owner_id, created_at desc);
