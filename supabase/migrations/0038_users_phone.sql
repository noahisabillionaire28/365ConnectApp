-- 0038: an optional, private phone number on the account.
--
-- Entered and changed by the user on Edit Profile (PATCH /users/me, which
-- normalises it to +<country><number>). It is private like email: the
-- public_profiles view and the API's public column list name their columns
-- explicitly, so neither exposes it; only the owner (GET /users/me, the data
-- export) and the service role read it. Users' own RLS select policy is the
-- own row only (0031).

set lock_timeout = '5s';

alter table public.users
  add column if not exists phone text;

alter table public.users
  drop constraint if exists users_phone_format;
alter table public.users
  add constraint users_phone_format
  check (phone is null or phone ~ '^\+[0-9]{7,15}$');
