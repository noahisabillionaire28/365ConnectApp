-- Align the live database with the shape the app's frontend + backend expect.
-- The repo evolved to a newer schema that was never applied to this project;
-- this brings the deployed DB in line without dropping existing data.
-- Applied via Supabase on the qjshmqscoevtdwrmhngl project.

-- 1. conversations: two-participant + last_message_at model (backfill from participant_ids)
alter table public.conversations
  add column if not exists participant_a_id uuid,
  add column if not exists participant_b_id uuid,
  add column if not exists last_message_at timestamptz;
update public.conversations
  set participant_a_id = coalesce(participant_a_id, participant_ids[1]),
      participant_b_id = coalesce(participant_b_id, participant_ids[2]),
      last_message_at  = coalesce(last_message_at, created_at);

-- 2. reviews: reviewer_id / reviewee_id (rename carries data + the unique index)
alter table public.reviews rename column from_user_id to reviewer_id;
alter table public.reviews rename column to_user_id   to reviewee_id;

-- 3. payments: net_amount + payment_type (backfill net_amount from total)
alter table public.payments
  add column if not exists net_amount   numeric,
  add column if not exists payment_type text default 'shift_payment';
update public.payments set net_amount = coalesce(net_amount, total);

-- 4. notifications: explicit read flag (backfill from read_at)
alter table public.notifications add column if not exists read boolean not null default false;
update public.notifications set read = true where read_at is not null;

-- 5. messages: backend does not populate recipient_id, and media messages have no text
alter table public.messages alter column recipient_id drop not null;
alter table public.messages alter column text         drop not null;

-- 6. users: fields the backend selects / admin edits
alter table public.users
  add column if not exists company_name text,
  add column if not exists status       text not null default 'active';

-- 7. unique targets required by upsert(onConflict) in shift-requests + time-entries
create unique index if not exists shift_requests_shift_worker_key
  on public.shift_requests (shift_id, worker_id);
create unique index if not exists time_entries_shift_worker_key
  on public.time_entries (shift_id, worker_id);
