-- Dedicated availability flag for the profile "Available / Unavailable" toggle,
-- so toggling it persists without clobbering the per-day `availability` map.
alter table public.users
  add column if not exists is_available boolean not null default true;
