-- Idempotency key for Stripe Checkout: /payments/confirm upserts on this so a
-- session can only ever record one payment row. NULLs are distinct in a Postgres
-- unique index, so existing rows (no Stripe session) are unaffected.
alter table public.payments add column if not exists stripe_session_id text;
create unique index if not exists payments_stripe_session_id_key
  on public.payments (stripe_session_id);
