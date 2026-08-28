-- 0008_notification_preferences.sql
-- Per-user notification preferences + a DB-level gate so the in-app toggle
-- governs EVERY notification source at once (the 11 SECURITY DEFINER triggers
-- that insert into notifications, plus the Node backend's createNotification()).

-- 1. Preference columns on users (default ON so existing users keep notifications).
alter table public.users
  add column if not exists in_app_notifications boolean not null default true,
  add column if not exists email_notifications  boolean not null default true;

-- 2. Gate trigger: before any notification row is inserted, drop it silently
--    when the recipient has turned in-app notifications off. Returning NULL from
--    a BEFORE INSERT trigger cancels that single insert without error.
create or replace function public.gate_notification_by_pref()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wants boolean;
begin
  select in_app_notifications into wants
    from public.users
    where id = new.user_id;
  -- Only suppress when explicitly off; unknown/NULL recipients still get the row.
  if wants is false then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_gate_notification_by_pref on public.notifications;
create trigger trg_gate_notification_by_pref
  before insert on public.notifications
  for each row execute function public.gate_notification_by_pref();
