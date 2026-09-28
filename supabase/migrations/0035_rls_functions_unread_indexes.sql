-- 0035: close the last RLS gaps, lock down SECURITY DEFINER functions, move
-- the unread-message count into SQL, and add the indexes the app's filters
-- actually use.
--
-- Idempotent: safe to re-run.

-- ── 1. Row Level Security on the remaining service-only tables ───────────────
-- These tables are read and written exclusively by the API server (service
-- role, which bypasses RLS). Enabling RLS with NO policies is the intended
-- deny-all: the browser's anon / authenticated keys could otherwise read
-- push endpoints and keys, who blocked whom, read positions, scheduled
-- messages and match insights straight through PostgREST.
alter table public.conversation_reads  enable row level security;
alter table public.user_blocks         enable row level security;
alter table public.scheduled_messages  enable row level security;
alter table public.push_subscriptions  enable row level security;
alter table public.match_insights      enable row level security;

comment on table public.conversation_reads is 'RLS on, no policies: service role only (deny-all for anon/authenticated).';
comment on table public.user_blocks        is 'RLS on, no policies: service role only (deny-all for anon/authenticated).';
comment on table public.scheduled_messages is 'RLS on, no policies: service role only (deny-all for anon/authenticated).';
comment on table public.push_subscriptions is 'RLS on, no policies: service role only (deny-all for anon/authenticated).';
comment on table public.match_insights     is 'RLS on, no policies: service role only (deny-all for anon/authenticated).';

-- ── 2. SECURITY DEFINER functions: not callable from the browser ─────────────
-- Trigger functions and the no-show sweeper run as their owner; nothing in the
-- app calls them through /rest/v1/rpc, so the default PUBLIC grant only adds
-- attack surface.
revoke execute on function public.gate_notification_by_pref()   from public, anon, authenticated;
revoke execute on function public.handle_application_released() from public, anon, authenticated;
revoke execute on function public.notify_no_show_late()         from public, anon, authenticated;

-- A SECURITY DEFINER function without a pinned search_path resolves unqualified
-- names in the caller's path.
alter function public.handle_application_released() set search_path = public, pg_temp;

-- ── 3. public_profiles stays a definer view (documented decision) ────────────
-- The security advisor flags `public_profiles` as SECURITY DEFINER. Switching
-- it to security_invoker would run it under the caller's RLS, and since 0031
-- `users_select` is `auth.uid() = id`, the view would then return only the
-- caller's own row — defeating its purpose (looking another user up). The view
-- exposes only the public columns (coordinates rounded to ~1 km, no email,
-- no moderation flags) and is granted to `authenticated` only, so the
-- advisor warning is accepted deliberately.
comment on view public.public_profiles is
  'Definer view on purpose: exposes only public columns (see 0031); security_invoker would hide every row but the caller''s own under users_select.';

-- ── 4. Unread counts in SQL ───────────────────────────────────────────────────
-- Replaces the API's "load up to 2,000 message rows and count in JS" on every
-- unread-count poll and conversation-list load. Counts, per conversation the
-- user belongs to, the messages from others that are newer than the user's
-- read position (and not deleted / not system lines).
create or replace function public.unread_counts_for(p_user uuid)
returns table (conversation_id uuid, unread bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.conversation_id, count(*)::bigint as unread
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  left join public.conversation_reads r
    on r.conversation_id = m.conversation_id and r.user_id = p_user
  where (c.participant_a_id = p_user or c.participant_b_id = p_user or p_user = any(c.participant_ids))
    and m.sender_id <> p_user
    and m.deleted_at is null
    and coalesce(m.kind, 'user') <> 'system'
    and (r.last_read_at is null or m.created_at > r.last_read_at)
  group by m.conversation_id
$$;

revoke execute on function public.unread_counts_for(uuid) from public, anon, authenticated;
grant  execute on function public.unread_counts_for(uuid) to service_role;

-- ── 5. Indexes for the filters the app runs ──────────────────────────────────
-- Plain (non-concurrent) CREATE INDEX: these run inside the migration
-- transaction and the tables are small.

-- feed: status = 'open' AND end_time > now() ORDER BY start_time
create index if not exists shifts_open_feed_idx      on public.shifts (start_time) where status = 'open';
-- /shifts/my, sweepEnded(client), cron: client_id (unindexed FK)
create index if not exists shifts_client_start_idx   on public.shifts (client_id, start_time desc);
-- cron windows: status in (open, filled) and start_time between …; sweep: end_time < now()
create index if not exists shifts_status_start_idx   on public.shifts (status, start_time);
create index if not exists shifts_status_end_idx     on public.shifts (status, end_time);
-- worker-side lists: /applications, /my-shift-ids, findTimeConflict
create index if not exists applications_worker_status_idx on public.applications (worker_id, status);
-- roster / accepted counts
create index if not exists applications_shift_status_idx  on public.applications (shift_id, status);
-- /time-entries/mine, paidByShift
create index if not exists time_entries_worker_clock_idx  on public.time_entries (worker_id, clock_in desc);
create index if not exists payments_worker_status_idx     on public.payments (worker_id, status, shift_id);
create index if not exists payments_client_idx            on public.payments (client_id);
-- DM lookup and memberFilter
create index if not exists conversations_participant_a_idx on public.conversations (participant_a_id);
create index if not exists conversations_participant_b_idx on public.conversations (participant_b_id);
-- unread_counts_for: messages by conversation, not mine, not deleted
create index if not exists messages_conv_sender_created_idx
  on public.messages (conversation_id, sender_id, created_at desc) where deleted_at is null;
-- conversation_reads lookup by reader
create index if not exists conversation_reads_user_idx on public.conversation_reads (user_id, conversation_id);
-- roster / rosterAllows / rosterPostersFor: follows.following_id
create index if not exists follows_following_idx on public.follows (following_id, follower_id);
-- cron dedupe: notifications where type = ? and shift_id in (...)
create index if not exists notifications_type_shift_idx on public.notifications (type, shift_id);
-- shift_requests by worker (Requests tab)
create index if not exists shift_requests_worker_status_idx on public.shift_requests (worker_id, status);
-- feed ordering
create index if not exists posts_created_idx on public.posts (created_at desc) where photo_url is not null;
