-- Cached match insights: one row per (shift, worker) with the rules-based
-- signals hash it was computed from, the score, and a one-line reason.
-- Recomputed when the signals change or the row is older than a day.
create table if not exists public.match_insights (
  shift_id     uuid not null references public.shifts(id) on delete cascade,
  worker_id    uuid not null references public.users(id) on delete cascade,
  score        integer not null check (score between 0 and 100),
  reason       text not null,
  signals_hash text not null,
  source       text not null default 'rules',   -- 'rules' | 'claude'
  created_at   timestamptz not null default now(),
  primary key (shift_id, worker_id)
);
create index if not exists match_insights_worker_idx on public.match_insights (worker_id);
