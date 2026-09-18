-- 0020_messaging_v2.sql
-- Messaging overhaul: shift group chats, replies, reactions, edits, files,
-- shift cards, per-user read tracking (group "read by"), thread management
-- (mute / pin / archive / delete-for-me), blocks, quick replies, push
-- subscriptions, and scheduled messages.

-- ── Conversations ─────────────────────────────────────────────────────────────
alter table public.conversations
  add column if not exists is_group     boolean not null default false,
  add column if not exists title        text,
  add column if not exists created_by   uuid,
  add column if not exists muted_by     uuid[] not null default '{}',
  add column if not exists pinned_by    uuid[] not null default '{}',
  add column if not exists archived_by  uuid[] not null default '{}',
  add column if not exists deleted_by   uuid[] not null default '{}';

-- participant_ids (uuid[]) already exists; groups use it, DMs keep a/b.
create index if not exists conversations_participant_ids_gin
  on public.conversations using gin (participant_ids);
create unique index if not exists conversations_shift_group_uniq
  on public.conversations (shift_id) where is_group;

-- ── Messages ──────────────────────────────────────────────────────────────────
alter table public.messages
  add column if not exists kind          text not null default 'user',   -- 'user' | 'system'
  add column if not exists reply_to_id   uuid references public.messages(id) on delete set null,
  add column if not exists edited_at     timestamptz,
  add column if not exists reactions     jsonb not null default '{}'::jsonb, -- {"👍": ["uid", ...]}
  add column if not exists file_url      text,
  add column if not exists file_name     text,
  add column if not exists file_size     integer,
  add column if not exists shift_card_id uuid,
  add column if not exists client_key    text;   -- idempotency key for retries / offline queue

create unique index if not exists messages_sender_client_key_uniq
  on public.messages (sender_id, client_key) where client_key is not null;
create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc);

-- ── Per-user read position (unread counts + "Read by N of M" in groups) ──────
create table if not exists public.conversation_reads (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null,
  last_read_at    timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

-- ── Blocks ────────────────────────────────────────────────────────────────────
create table if not exists public.user_blocks (
  blocker_id uuid not null,
  blocked_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

-- ── Web push subscriptions ────────────────────────────────────────────────────
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  endpoint   text not null unique,
  keys       jsonb not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ── Scheduled messages ────────────────────────────────────────────────────────
create table if not exists public.scheduled_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null,
  text            text not null,
  send_at         timestamptz not null,
  sent_message_id uuid,
  created_at      timestamptz not null default now()
);
create index if not exists scheduled_messages_due_idx
  on public.scheduled_messages (send_at) where sent_message_id is null;

-- ── Quick replies (per-user templates) ───────────────────────────────────────
alter table public.users
  add column if not exists quick_replies text[];
