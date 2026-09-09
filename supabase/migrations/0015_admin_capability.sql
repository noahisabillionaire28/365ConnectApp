-- 0015_admin_capability.sql
-- Make admin a capability (a flag) instead of a role. This lets an account keep
-- its normal role (worker/client/staffer) — so it uses the app like any user —
-- while still reaching the admin panel. The backend admin guard accepts either
-- is_admin = true OR the legacy role = 'admin'.
alter table public.users
  add column if not exists is_admin boolean not null default false;

create index if not exists users_is_admin_idx on public.users(is_admin) where is_admin;
