-- ============================================================
-- B. Hardcode the passwords behind dev mode.
Use environment variables not string literals.

Pull from these env vars:
VITE_TEST_WORKER_EMAIL=worker.test.qa1@example.com
VITE_TEST_WORKER_PASSWORD=Test123!
VITE_TEST_CLIENT_EMAIL=clienttestqa1@example.com
VITE_TEST_CLIENT_PASSWORD=Test123!
VITE_TEST_STAFFER_EMAIL=staffer.test@365connect.com
VITE_TEST_STAFFER_PASSWORD=Test123!
VITE_TEST_ADMIN_EMAIL=admin@365connect.com
VITE_TEST_ADMIN_PASSWORD=Admin123!

Add these to Replit Secrets.
Only show the Quick Test Login buttons 
when VITE_APP_ENV=development.

Then proceed with everything else.
Build all 11 screen fixes.
Run tsc.
Go. + Assign Workers (Section 8)
-- Run in Supabase SQL Editor if upgrading an existing DB.
-- Roster membership reuses the existing `follows` table (a staffer's roster
-- is simply the set of workers they follow) — no new table is introduced.
-- Adds: the ability for a shift's owner (client/staffer) to directly insert
-- an *already-accepted* `applications` row for a worker (the "Assign" action,
-- distinct from the normal apply-then-review flow), with matching
-- spots-filled bookkeeping and a worker-facing notification.
-- ============================================================

-- Allow the shift owner to directly insert a pre-accepted application row
-- (assigning a worker from their roster), in addition to a worker inserting
-- their own (normally pending) application.
DROP POLICY IF EXISTS "applications_insert" ON public.applications;
CREATE POLICY "applications_insert" ON public.applications FOR INSERT
  WITH CHECK (
    -- A worker may only insert their own application, and only as 'pending' —
    -- self-accepting is not allowed; only the shift owner can accept (below).
    (auth.uid() = worker_id AND status = 'pending')
    OR (
      auth.uid() = (SELECT client_id FROM public.shifts WHERE id = shift_id)
      AND status = 'accepted'
      -- Direct-assign is restricted to workers on the staffer/client's own
      -- roster (who they follow) — enforced here, not just in the UI's list.
      AND EXISTS (
        SELECT 1 FROM public.follows f
        WHERE f.follower_id = auth.uid() AND f.following_id = worker_id
      )
    )
  );

-- The "someone applied" notification only makes sense for the normal
-- worker-initiated apply flow — an owner directly assigning a worker inserts
-- the row already `accepted`, and is handled by handle_application_assigned below.
CREATE OR REPLACE FUNCTION public.notify_application_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_client_id   UUID;
  v_shift_title TEXT;
BEGIN
  IF NEW.status <> 'pending' THEN RETURN NEW; END IF;
  SELECT client_id, title INTO v_client_id, v_shift_title FROM public.shifts WHERE id = NEW.shift_id;
  IF v_client_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, shift_id, from_user_id)
    VALUES (
      v_client_id, 'application_received', 'New applicant',
      'Someone applied to your ' || COALESCE(v_shift_title, 'shift') || '.',
      NEW.shift_id, NEW.worker_id
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Fill the spots-filled bookkeeping gap on the normal pending→accepted
-- decision path too (previously only the Section 7 shift-request decision
-- path incremented it), so Applicants-approve and Assign agree on fill count.
CREATE OR REPLACE FUNCTION public.notify_application_status_changed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_shift_title TEXT;
  v_filled      BOOLEAN;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT title INTO v_shift_title FROM public.shifts WHERE id = NEW.shift_id;

  IF NEW.status = 'accepted' THEN
    -- Skip the increment when this UPDATE was driven by handle_shift_request_decision
    -- (Section 7) — that function already increments spots_filled itself, and this
    -- trigger still fires on top of its INSERT ... ON CONFLICT DO UPDATE.
    IF COALESCE(current_setting('app.via_shift_request_decision', true), '') <> 'true' THEN
      -- Atomic, concurrency-safe capacity check: the conditional WHERE means
      -- only one concurrent acceptance can win the last open spot.
      UPDATE public.shifts
      SET spots_filled = spots_filled + 1,
          status       = CASE WHEN spots_filled + 1 >= spots_available THEN 'filled' ELSE status END
      WHERE id = NEW.shift_id AND spots_filled < spots_available
      RETURNING true INTO v_filled;

      IF v_filled IS NOT TRUE THEN
        RAISE EXCEPTION 'This shift is already fully booked';
      END IF;
    END IF;

    INSERT INTO public.notifications (user_id, type, title, body, shift_id, from_user_id)
    SELECT
      NEW.worker_id, 'application_accepted', 'Application approved',
      'You''re confirmed for ' || COALESCE(v_shift_title, 'the shift') || '. Clock in is now unlocked.',
      NEW.shift_id, s.client_id
    FROM public.shifts s WHERE s.id = NEW.shift_id;
  ELSIF NEW.status = 'declined' THEN
    INSERT INTO public.notifications (user_id, type, title, body, shift_id, from_user_id)
    SELECT
      NEW.worker_id, 'application_declined', 'Application update',
      'You were not selected for ' || COALESCE(v_shift_title, 'the shift') || '.',
      NEW.shift_id, s.client_id
    FROM public.shifts s WHERE s.id = NEW.shift_id;
  END IF;
  RETURN NEW;
END;
$$;

-- ─── Trigger: staffer/client directly assigns a roster worker to their shift ────
-- Fires only when a brand-new `applications` row is inserted already `accepted`
-- (the Assign flow) — the normal apply-then-review flow always inserts `pending`
-- and is handled by notify_application_created + notify_application_status_changed.
CREATE OR REPLACE FUNCTION public.handle_application_assigned()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_shift_title TEXT;
  v_client_id   UUID;
  v_filled      BOOLEAN;
BEGIN
  -- handle_shift_request_decision (Section 7) already does its own insert,
  -- spots_filled increment, and notification for this row — skip here.
  IF COALESCE(current_setting('app.via_shift_request_decision', true), '') = 'true' THEN
    RETURN NEW;
  END IF;

  SELECT title, client_id INTO v_shift_title, v_client_id
  FROM public.shifts WHERE id = NEW.shift_id;

  -- Atomic, concurrency-safe capacity check: the conditional WHERE means only
  -- one concurrent assignment can win the last open spot.
  UPDATE public.shifts
  SET spots_filled = spots_filled + 1,
      status       = CASE WHEN spots_filled + 1 >= spots_available THEN 'filled' ELSE status END
  WHERE id = NEW.shift_id AND spots_filled < spots_available
  RETURNING true INTO v_filled;

  IF v_filled IS NOT TRUE THEN
    RAISE EXCEPTION 'This shift is already fully booked';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, shift_id, from_user_id)
  VALUES (
    NEW.worker_id, 'application_accepted', 'You were assigned to a shift',
    'You''ve been added to ' || COALESCE(v_shift_title, 'a shift') || '. Clock in is now unlocked.',
    NEW.shift_id, v_client_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_application_assigned ON public.applications;
CREATE TRIGGER trg_handle_application_assigned
  AFTER INSERT ON public.applications
  FOR EACH ROW WHEN (NEW.status = 'accepted')
  EXECUTE FUNCTION public.handle_application_assigned();

-- ─── Scheduled: notify workers a confirmed shift starts in ~2 hours ─────────────
-- Requires the `pg_cron` extension (Supabase Dashboard → Database →
-- Extensions → enable "pg_cron"), then run the `cron.schedule(...)` call at
-- the bottom of this block once. Safe to re-run — it dedupes against
-- existing 'shift_starting_soon' notifications for the same user+shift.
CREATE OR REPLACE FUNCTION public.notify_shifts_starting_soon()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, shift_id)
  SELECT a.worker_id, 'shift_starting_soon', 'Shift starting soon',
         COALESCE(s.title, 'Your shift') || ' starts in about 2 hours.',
         s.id
  FROM public.shifts s
  JOIN public.applications a ON a.shift_id = s.id AND a.status = 'accepted'
  WHERE s.start_time BETWEEN NOW() + INTERVAL '110 minutes' AND NOW() + INTERVAL '130 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = a.worker_id AND n.shift_id = s.id AND n.type = 'shift_starting_soon'
    );
END;
$$;

-- Run this once (after enabling the pg_cron extension) to schedule the job
-- every 15 minutes:
-- SELECT cron.schedule('notify-shifts-starting-soon', '*/15 * * * *',
--   $$SELECT public.notify_shifts_starting_soon();$$);

-- ─── Storage: chat media bucket (photos, videos, voice notes) ───────────────────
-- PRIVATE bucket (unlike the public avatars/post-photos buckets) — chat
-- attachments are only ever meant to be visible to the two conversation
-- participants, so the app fetches them via short-lived signed URLs
-- (see getSignedChatMediaUrl in src/lib/supabase.ts) rather than public URLs.
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "chat_media_read" ON storage.objects;
DROP POLICY IF EXISTS "chat_media_insert" ON storage.objects;

-- Object paths are `${conversationId}/kind/file.ext` (namespaced by CONVERSATION,
-- not by uploader) — see uploadChatImage/Video/Voice in src/lib/supabase.ts.
-- (storage.foldername(name))[1] is therefore the conversation id, so this
-- checks "is the requester a participant of THIS SPECIFIC conversation",
-- not "does the requester share *some* conversation with the uploader" —
-- the latter would let sharing one thread with someone leak their media
-- from unrelated threads too.
CREATE POLICY "chat_media_read" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'chat-media' AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = (storage.foldername(name))[1]::uuid
        AND auth.uid() IN (c.participant_a_id, c.participant_b_id)
    )
  );
CREATE POLICY "chat_media_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chat-media' AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = (storage.foldername(name))[1]::uuid
        AND auth.uid() IN (c.participant_a_id, c.participant_b_id)
    )
  );


-- ============================================================
-- Phase 10: Monetization Display (Section 10)
-- Run in Supabase SQL Editor if upgrading an existing DB.
-- Changes:
--   1. payments.shift_id made nullable (Pro subscription rows have no shift).
--   2. payments.payment_type column added to distinguish shift earnings
--      from Pro subscription charges.
--   3. RLS payments_select updated to handle null shift_id gracefully.
-- ============================================================

-- 1. Allow shift_id to be null for non-shift payments (e.g. Pro subscriptions)
ALTER TABLE public.payments
  ALTER COLUMN shift_id DROP NOT NULL;

-- 2. Add payment_type column ('shift_payment' | 'pro_subscription')
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'shift_payment';

-- 3. Refresh RLS select policy to handle null shift_id
--    (null comparisons return NULL/false in SQL, so the OR clause
--    is simply skipped for subscription rows — auth.uid() = worker_id
--    is the effective check in that case.)
DROP POLICY IF EXISTS "payments_select" ON public.payments;
CREATE POLICY "payments_select" ON public.payments FOR SELECT
  USING (
    auth.uid() = worker_id
    OR (
      shift_id IS NOT NULL
      AND auth.uid() = (SELECT client_id FROM public.shifts WHERE id = shift_id)
    )
  );

-- Insert policy is unchanged: any user can insert rows where worker_id = their own id.
-- (Covers both clock-out payouts and Pro subscription self-charges.)


-- ============================================================
-- Phase 11: Full Admin Panel (Section 11)
-- Run in Supabase SQL Editor on existing databases.
-- Changes:
--   1. Add `status` column to users (active/suspended/flagged)
--   2. Create `disputes` table with full RLS
--   3. Admin-role SELECT policies on users, shifts, payments,
--      applications so the admin API (service-role key) can
--      read all rows regardless of auth.uid().
-- ============================================================

-- 1. User moderation status
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- Constrain values
DO $$ BEGIN
  ALTER TABLE public.users
    ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'suspended', 'flagged'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Disputes table
CREATE TABLE IF NOT EXISTS public.disputes (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type                TEXT        NOT NULL,   -- 'no-show' | 'late-cancel' | 'fake-review' | 'dress-code' | 'payment' | 'harassment'
  reported_user_id    UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  reported_by_user_id UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  reason              TEXT        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'open',  -- 'open' | 'resolved' | 'warned' | 'banned'
  resolution_note     TEXT,
  resolved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- Only admin-role users (or the service-role key bypassing RLS) may access disputes
DO $ BEGIN
  CREATE POLICY "disputes_admin_all" ON public.disputes FOR ALL
    USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $;

-- 3. Allow admin-role users to SELECT across all core tables
--    (The API server uses the service-role key which bypasses RLS anyway,
--     but these policies cover direct Supabase admin logins too.)

-- users_admin_select
DO $$ BEGIN
  CREATE POLICY "users_admin_select" ON public.users FOR SELECT
    USING (
      auth.uid() = id
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );
EXCEPTION WHEN duplicate_object THEN
  -- policy already exists from an earlier phase; skip
  NULL;
END $$;

-- shifts_admin_select
DO $$ BEGIN
  CREATE POLICY "shifts_admin_select" ON public.shifts FOR SELECT
    USING (
      auth.uid() = client_id
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- payments_admin_select (supplements the Phase 10 policy)
DO $$ BEGIN
  CREATE POLICY "payments_admin_select" ON public.payments FOR SELECT
    USING (
      auth.uid() = worker_id
      OR (shift_id IS NOT NULL AND auth.uid() = (SELECT client_id FROM public.shifts WHERE id = shift_id))
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- applications_admin_select
DO $$ BEGIN
  CREATE POLICY "applications_admin_select" ON public.applications FOR SELECT
    USING (
      auth.uid() = worker_id
      OR auth.uid() = (SELECT client_id FROM public.shifts WHERE id = shift_id)
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Allow admin-role users to UPDATE user status/role
DO $$ BEGIN
  CREATE POLICY "users_admin_update" ON public.users FOR UPDATE
    USING (
      auth.uid() = id
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
