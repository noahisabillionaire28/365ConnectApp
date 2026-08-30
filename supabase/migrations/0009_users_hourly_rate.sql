-- 0009_users_hourly_rate.sql
-- Workers set their own asking rate at signup. Stored on the user profile and
-- shown publicly so staffers/clients see it when browsing or booking.
alter table public.users
  add column if not exists hourly_rate numeric(10,2);
