-- Disputes / moderation: users can report each other; admins resolve/warn/ban.
-- This is the backing table the admin Disputes screen and /api/disputes routes need.

create table if not exists public.disputes (
  id                  uuid primary key default gen_random_uuid(),
  type                text not null,               -- no-show | late-cancel | fake-review | dress-code | payment | harassment | other
  reason              text not null,
  reported_user_id    uuid references public.users(id) on delete set null,
  reported_by_user_id uuid references public.users(id) on delete set null,
  shift_id            uuid references public.shifts(id) on delete set null,
  status              text not null default 'open', -- open | resolved | warned | banned
  resolution_note     text,
  resolved_at         timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists disputes_status_created_idx
  on public.disputes (status, created_at desc);
