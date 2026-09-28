-- 0033: data-integrity guards the API now relies on.

-- ── 1. Handles are unique regardless of case ─────────────────────────────────
-- users_username_key is case-sensitive, so "Maria" and "maria" could coexist.
-- The API now lower-cases every handle it stores; this index makes the rule
-- hold for rows written any other way. (Live data was checked for
-- case-insensitive duplicates before this was applied: there were none.)
create unique index if not exists users_username_lower_idx
  on public.users (lower(username));

-- ── 2. A worker is paid at most once per shift ───────────────────────────────
-- Both payment paths (Stripe confirm, "mark as paid") check for an existing
-- completed payment first, but two requests can race. Pro subscriptions have
-- no shift and are not affected.
create unique index if not exists payments_one_completed_per_shift_worker_idx
  on public.payments (shift_id, worker_id)
  where status = 'completed' and shift_id is not null;

-- ── 3. Notifications for people who turned in-app alerts off ─────────────────
-- The cron jobs dedupe reminders and rating prompts against the notifications
-- table. The gate trigger from 0008 used to DROP the row for users with in-app
-- notifications off, so those users got the same email on every 15-minute
-- tick. The row is now kept but hidden: it never shows in the app or counts as
-- unread, and it still dedupes.
alter table public.notifications
  add column if not exists hidden boolean not null default false;

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
  -- Only when explicitly off: keep the row for dedupe, but never surface it.
  if wants is false then
    new.hidden := true;
    new.read := true;
    new.read_at := coalesce(new.read_at, now());
  end if;
  return new;
end;
$$;

-- The trigger itself is unchanged (BEFORE INSERT, from 0008); only its
-- function body changed above.

create index if not exists notifications_user_visible_idx
  on public.notifications (user_id, created_at desc)
  where hidden = false;
