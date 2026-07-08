-- ============================================================
-- 365 Connect — Supabase Schema
-- Run this in your Supabase project → SQL Editor → New query
-- Safe to re-run: all statements use IF NOT EXISTS / DROP IF EXISTS
-- ============================================================

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id              UUID          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT,
  role            TEXT          NOT NULL DEFAULT 'worker' CHECK (role IN ('worker', 'client', 'admin', 'staffer')),
  username        TEXT          UNIQUE,
  photo_url       TEXT,
  bio             TEXT,
  job_types       TEXT[]        NOT NULL DEFAULT '{}',
  certifications  TEXT[]        NOT NULL DEFAULT '{}',
  rating          NUMERIC(3,2)  NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select"       ON public.users;
DROP POLICY IF EXISTS "users_insert"       ON public.users;
DROP POLICY IF EXISTS "users_update"       ON public.users;
DROP POLICY IF EXISTS "users_service_role" ON public.users;

CREATE POLICY "users_select" ON public.users FOR SELECT USING (true);
CREATE POLICY "users_insert" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users_update" ON public.users FOR UPDATE USING (auth.uid() = id);

-- ─── Shifts ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shifts (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title           TEXT          NOT NULL,
  description     TEXT,
  location        TEXT,
  job_type        TEXT          NOT NULL,
  hourly_rate     NUMERIC(8,2),
  start_time      TIMESTAMPTZ   NOT NULL,
  end_time        TIMESTAMPTZ   NOT NULL,
  spots           INT           NOT NULL DEFAULT 1,
  status          TEXT          NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'filled', 'cancelled', 'completed')),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shifts_select"  ON public.shifts;
DROP POLICY IF EXISTS "shifts_insert"  ON public.shifts;
DROP POLICY IF EXISTS "shifts_update"  ON public.shifts;
DROP POLICY IF EXISTS "shifts_delete"  ON public.shifts;

CREATE POLICY "shifts_select" ON public.shifts FOR SELECT USING (true);
CREATE POLICY "shifts_insert" ON public.shifts FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "shifts_update" ON public.shifts FOR UPDATE USING (auth.uid() = client_id);
CREATE POLICY "shifts_delete" ON public.shifts FOR DELETE USING (auth.uid() = client_id);

-- ─── Applications ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.applications (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id        UUID          NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  worker_id       UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status          TEXT          NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  message         TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (shift_id, worker_id)
);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "applications_select"  ON public.applications;
DROP POLICY IF EXISTS "applications_insert"  ON public.applications;
DROP POLICY IF EXISTS "applications_update"  ON public.applications;

-- Workers see their own applications; clients see applications for their shifts
CREATE POLICY "applications_select" ON public.applications FOR SELECT
  USING (
    auth.uid() = worker_id OR
    auth.uid() = (SELECT client_id FROM public.shifts WHERE id = shift_id)
  );
CREATE POLICY "applications_insert" ON public.applications FOR INSERT WITH CHECK (auth.uid() = worker_id);
-- Workers may only withdraw their own application; only the shift's client/owner
-- may move an application to accepted/declined/pending (the applicant-review flow).
-- This prevents a worker from self-accepting or self-declining their own application.
CREATE POLICY "applications_update" ON public.applications FOR UPDATE
  USING (
    auth.uid() = worker_id OR
    auth.uid() = (SELECT client_id FROM public.shifts WHERE id = shift_id)
  )
  WITH CHECK (
    (auth.uid() = worker_id AND status = 'withdrawn') OR
    (auth.uid() = (SELECT client_id FROM public.shifts WHERE id = shift_id) AND status IN ('pending', 'accepted', 'declined'))
  );

-- ─── Messages ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id       UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_id    UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body            TEXT          NOT NULL,
  read            BOOLEAN       NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select"  ON public.messages;
DROP POLICY IF EXISTS "messages_insert"  ON public.messages;
DROP POLICY IF EXISTS "messages_update"  ON public.messages;

CREATE POLICY "messages_select" ON public.messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "messages_update" ON public.messages FOR UPDATE USING (auth.uid() = recipient_id);

-- ─── Reviews ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id        UUID          NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  reviewer_id     UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reviewee_id     UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating          INT           NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment         TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (shift_id, reviewer_id, reviewee_id)
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_select"  ON public.reviews;
DROP POLICY IF EXISTS "reviews_insert"  ON public.reviews;

CREATE POLICY "reviews_select" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert" ON public.reviews FOR INSERT
  WITH CHECK (
    auth.uid() = reviewer_id AND
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.shift_id = reviews.shift_id
        AND a.worker_id = reviews.reviewee_id
        AND a.status = 'accepted'
    )
  );

-- ─── Trigger: keep users.rating in sync after each review ─────────────────────
CREATE OR REPLACE FUNCTION public.update_user_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.users
  SET    rating = (
    SELECT COALESCE(AVG(rating), 0)
    FROM   public.reviews
    WHERE  reviewee_id = NEW.reviewee_id
  )
  WHERE  id = NEW.reviewee_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_user_rating ON public.reviews;
CREATE TRIGGER trg_update_user_rating
  AFTER INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_user_rating();

-- ─── Trigger: auto-insert a users row when a new Auth user signs up ───────────
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ─── Storage buckets (run separately in Supabase Storage UI if needed) ────────
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('posts',   'posts',   true) ON CONFLICT DO NOTHING;

-- ============================================================
-- Phase 2 additions — safe to re-run (IF NOT EXISTS / ON CONFLICT)
-- Run AFTER the initial schema above is applied.
-- ============================================================

-- ─── Shifts: extended columns ─────────────────────────────────────────────────
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS lat                  FLOAT8,
  ADD COLUMN IF NOT EXISTS lng                  FLOAT8,
  ADD COLUMN IF NOT EXISTS cover_image          TEXT,
  ADD COLUMN IF NOT EXISTS company_name         TEXT,
  ADD COLUMN IF NOT EXISTS job_types            TEXT[]   NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS requirements         TEXT[]   NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dress_code           TEXT,
  ADD COLUMN IF NOT EXISTS dress_code_items     TEXT[]   NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS point_of_contact     TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone        TEXT,
  ADD COLUMN IF NOT EXISTS pay_period           TEXT     NOT NULL DEFAULT 'hr',
  ADD COLUMN IF NOT EXISTS spots_filled         INT      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_match_pct         INT      NOT NULL DEFAULT 85,
  ADD COLUMN IF NOT EXISTS unit_info            TEXT,
  ADD COLUMN IF NOT EXISTS parking_notes        TEXT,
  ADD COLUMN IF NOT EXISTS special_instructions TEXT,
  ADD COLUMN IF NOT EXISTS repeat_type          TEXT     NOT NULL DEFAULT 'once';

-- ─── Follows ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.follows (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  following_id UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (follower_id, following_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "follows_select" ON public.follows;
DROP POLICY IF EXISTS "follows_insert" ON public.follows;
DROP POLICY IF EXISTS "follows_delete" ON public.follows;

CREATE POLICY "follows_select" ON public.follows FOR SELECT USING (true);
CREATE POLICY "follows_insert" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete" ON public.follows FOR DELETE USING (auth.uid() = follower_id);
-- ============================================================
-- Phase 3: add 'staffer' role
-- Run in Supabase SQL Editor if upgrading an existing DB
-- (schema.sql above already reflects the widened constraint)
-- ============================================================

-- Drop the auto-named check constraint and replace with widened version
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('worker', 'client', 'admin', 'staffer'));

-- ============================================================
-- Phase 4: feeds, discovery, map, shift detail (Section 3)
-- Run in Supabase SQL Editor if upgrading an existing DB
-- (schema.sql above already reflects these columns/tables)
-- ============================================================

-- ─── Users: profile-setup + feed/discovery columns ────────────────────────────
-- (primary_job_type / secondary_job_types / availability are written by the
--  worker/client/staffer setup screens; lat/lng/is_pro power Section 3 feeds)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS primary_job_type    TEXT,
  ADD COLUMN IF NOT EXISTS secondary_job_types TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS availability        JSONB,
  ADD COLUMN IF NOT EXISTS lat                 FLOAT8,
  ADD COLUMN IF NOT EXISTS lng                 FLOAT8,
  ADD COLUMN IF NOT EXISTS is_pro              BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS company_name        TEXT,
  ADD COLUMN IF NOT EXISTS billing_ref         TEXT;

-- ─── Shifts: multi job-type support (worker feed job-type intersection) ──────
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS job_types TEXT[] NOT NULL DEFAULT '{}';

-- ─── Posts (worker setup step 8 "first post") ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.posts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  image_url  TEXT,
  caption    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "posts_select" ON public.posts;
DROP POLICY IF EXISTS "posts_insert" ON public.posts;

CREATE POLICY "posts_select" ON public.posts FOR SELECT USING (true);
CREATE POLICY "posts_insert" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Phase 5: Applications, Clock In/Out & Reviews (Section 5)
-- Run in Supabase SQL Editor if upgrading an existing DB.
-- Adds: applications.match_score, applications 'declined' status,
--       notifications, time_entries, payments, reviews tag arrays.
-- ============================================================

-- ─── Applications: match score + widened status ────────────────────────────────
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS match_score INT;

ALTER TABLE public.applications DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE public.applications
  ADD CONSTRAINT applications_status_check
  CHECK (status IN ('pending', 'accepted', 'rejected', 'declined', 'withdrawn'));

-- ─── Notifications ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type             TEXT        NOT NULL,
  title            TEXT        NOT NULL,
  body             TEXT,
  related_shift_id UUID        REFERENCES public.shifts(id) ON DELETE CASCADE,
  related_user_id  UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  read             BOOLEAN     NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;

CREATE POLICY "notifications_select" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
-- No client-side INSERT policy — rows are created only by the SECURITY DEFINER
-- triggers below, so a worker can create a notification for a client (and
-- vice versa) without needing direct write access to each other's rows.

-- ─── Time entries (Clock In / Clock Out) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.time_entries (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id      UUID        NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  worker_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  clock_in      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clock_out     TIMESTAMPTZ,
  break_minutes INT         NOT NULL DEFAULT 0,
  total_hours   NUMERIC(6,2),
  total_pay     NUMERIC(10,2),
  fee           NUMERIC(10,2),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shift_id, worker_id)
);

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "time_entries_select" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_insert" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_update" ON public.time_entries;

CREATE POLICY "time_entries_select" ON public.time_entries FOR SELECT
  USING (auth.uid() = worker_id OR auth.uid() = (SELECT client_id FROM public.shifts WHERE id = shift_id));
CREATE POLICY "time_entries_insert" ON public.time_entries FOR INSERT WITH CHECK (auth.uid() = worker_id);
CREATE POLICY "time_entries_update" ON public.time_entries FOR UPDATE USING (auth.uid() = worker_id);

-- ─── Payments (simulated instant transfer ledger) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments (
  id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id   UUID          NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  worker_id  UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount     NUMERIC(10,2) NOT NULL,
  fee        NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(10,2) NOT NULL,
  status     TEXT          NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select" ON public.payments;
DROP POLICY IF EXISTS "payments_insert" ON public.payments;

CREATE POLICY "payments_select" ON public.payments FOR SELECT
  USING (auth.uid() = worker_id OR auth.uid() = (SELECT client_id FROM public.shifts WHERE id = shift_id));
CREATE POLICY "payments_insert" ON public.payments FOR INSERT WITH CHECK (auth.uid() = worker_id);

-- ─── Reviews: tag arrays + two-way eligibility ──────────────────────────────────
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS positive_tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS negative_tags TEXT[] NOT NULL DEFAULT '{}';

-- Widen insert policy so EITHER side of an accepted application can review
-- the other (worker → client, or client/staffer → worker).
DROP POLICY IF EXISTS "reviews_insert" ON public.reviews;
CREATE POLICY "reviews_insert" ON public.reviews FOR INSERT
  WITH CHECK (
    auth.uid() = reviewer_id AND
    EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.shifts s ON s.id = a.shift_id
      WHERE a.shift_id = reviews.shift_id
        AND a.status = 'accepted'
        AND (
          (a.worker_id = reviews.reviewer_id AND s.client_id = reviews.reviewee_id) OR
          (s.client_id  = reviews.reviewer_id AND a.worker_id = reviews.reviewee_id)
        )
    )
  );

-- Negative tags must never be readable by workers, even via a direct API call
-- with an explicit `select=negative_tags` — row-level security alone cannot
-- mask individual columns, so reads go through this view instead of the base
-- table. This is intentionally a standard (definer-privilege) view, NOT
-- security_invoker: SELECT on the base table is revoked from authenticated/anon
-- below, so the view must run with the owner's privileges to read the
-- underlying rows at all and apply the masking logic itself.
CREATE OR REPLACE VIEW public.reviews_visible AS
SELECT
  r.id, r.shift_id, r.reviewer_id, r.reviewee_id, r.rating, r.comment, r.positive_tags, r.created_at,
  CASE
    WHEN EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('client', 'staffer'))
      THEN r.negative_tags
    ELSE '{}'::TEXT[]
  END AS negative_tags
FROM public.reviews r;

GRANT SELECT ON public.reviews_visible TO authenticated, anon;
REVOKE SELECT ON public.reviews FROM authenticated, anon;
GRANT INSERT ON public.reviews TO authenticated;

-- ─── Trigger: notify the client when a worker applies ───────────────────────────
CREATE OR REPLACE FUNCTION public.notify_application_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_client_id   UUID;
  v_shift_title TEXT;
BEGIN
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

DROP TRIGGER IF EXISTS trg_notify_application_created ON public.applications;
CREATE TRIGGER trg_notify_application_created
  AFTER INSERT ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_application_created();

-- ─── Trigger: notify the worker when their application is accepted/declined ────
CREATE OR REPLACE FUNCTION public.notify_application_status_changed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_shift_title TEXT;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT title INTO v_shift_title FROM public.shifts WHERE id = NEW.shift_id;

  IF NEW.status = 'accepted' THEN
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

DROP TRIGGER IF EXISTS trg_notify_application_status_changed ON public.applications;
CREATE TRIGGER trg_notify_application_status_changed
  AFTER UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_application_status_changed();

-- ============================================================
-- Phase 6: Messaging & Notifications (Section 6)
-- Run in Supabase SQL Editor if upgrading an existing DB.
-- Adds: conversations, messages (conversation-based, media), full
--       notification type coverage, chat-media storage bucket.
--
-- IMPORTANT: the live `notifications` table already exists with columns
-- (id, user_id, type, title, body, shift_id, from_user_id, amount,
-- read_at, created_at) and RLS disabled — this migration matches that
-- exact shape (NOT the related_shift_id/related_user_id/read names used
-- by the original Phase 5 draft above) and turns RLS on.
-- ============================================================

-- ─── Notifications: align to live schema + enable RLS ───────────────────────────
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS shift_id     UUID REFERENCES public.shifts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS from_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS amount       NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS read_at      TIMESTAMPTZ;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;

CREATE POLICY "notifications_select" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
-- No client-side INSERT policy — rows are created only by SECURITY DEFINER
-- triggers, so one user can generate a notification for another without
-- needing direct write access to their notifications row.

-- ─── Conversations ────────────────────────────────────────────────────────────
-- Every conversation is exactly 2 participants — either an open DM (shift_id
-- IS NULL) or the auto-created chat for a confirmed shift (shift_id set).
CREATE TABLE IF NOT EXISTS public.conversations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_a_id UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  participant_b_id UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  shift_id         UUID        REFERENCES public.shifts(id) ON DELETE SET NULL,
  last_message     TEXT,
  last_message_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT conversations_distinct_participants CHECK (participant_a_id <> participant_b_id)
);

-- At most one open DM per unordered pair, and at most one conversation per
-- (shift, pair) — prevents duplicate threads when either side re-opens/re-taps.
CREATE UNIQUE INDEX IF NOT EXISTS conversations_unique_dm
  ON public.conversations (LEAST(participant_a_id, participant_b_id), GREATEST(participant_a_id, participant_b_id))
  WHERE shift_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS conversations_unique_shift_pair
  ON public.conversations (shift_id, LEAST(participant_a_id, participant_b_id), GREATEST(participant_a_id, participant_b_id))
  WHERE shift_id IS NOT NULL;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert" ON public.conversations;
DROP POLICY IF EXISTS "conversations_update" ON public.conversations;

CREATE POLICY "conversations_select" ON public.conversations FOR SELECT
  USING (auth.uid() IN (participant_a_id, participant_b_id));
CREATE POLICY "conversations_insert" ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() IN (participant_a_id, participant_b_id));
-- No client-side UPDATE policy: participant_a_id/participant_b_id/shift_id must
-- never be reassignable by either party (that would let a user hijack another
-- conversation's identity), and last_message/last_message_at are only ever
-- written by the SECURITY DEFINER trg_touch_conversation_on_message trigger.

-- ─── Messages: rebuild around conversation_id + media ───────────────────────────
-- The original Phase-1 `messages` table was sender/recipient-pair based with a
-- single `body` column. Widen it in place rather than dropping, in case any
-- rows already exist.
ALTER TABLE public.messages ALTER COLUMN recipient_id DROP NOT NULL;
ALTER TABLE public.messages ALTER COLUMN body DROP NOT NULL;
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS text            TEXT,
  ADD COLUMN IF NOT EXISTS image_url       TEXT,
  ADD COLUMN IF NOT EXISTS video_url       TEXT,
  ADD COLUMN IF NOT EXISTS voice_url       TEXT,
  ADD COLUMN IF NOT EXISTS read_at         TIMESTAMPTZ;

UPDATE public.messages SET text = body WHERE text IS NULL AND body IS NOT NULL;

DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
DROP POLICY IF EXISTS "messages_update" ON public.messages;

CREATE POLICY "messages_select" ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND auth.uid() IN (c.participant_a_id, c.participant_b_id)
    )
  );
CREATE POLICY "messages_insert" ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND auth.uid() IN (c.participant_a_id, c.participant_b_id)
    )
  );
-- Only the RECEIVING participant may UPDATE a message (to stamp read_at),
-- never the sender — this stops a sender from rewriting their own message
-- content/attachments after the fact via a bare UPDATE.
CREATE POLICY "messages_update" ON public.messages FOR UPDATE
  USING (
    auth.uid() <> sender_id AND
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND auth.uid() IN (c.participant_a_id, c.participant_b_id)
    )
  )
  WITH CHECK (
    auth.uid() <> sender_id AND
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND auth.uid() IN (c.participant_a_id, c.participant_b_id)
    )
  );

-- Belt-and-braces: RLS alone can't stop the receiving participant's UPDATE
-- from also rewriting message content/attachments/conversation_id — only
-- read_at may change on any UPDATE.
CREATE OR REPLACE FUNCTION public.enforce_message_read_only_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.sender_id     IS DISTINCT FROM OLD.sender_id
     OR NEW.text          IS DISTINCT FROM OLD.text
     OR NEW.image_url     IS DISTINCT FROM OLD.image_url
     OR NEW.video_url     IS DISTINCT FROM OLD.video_url
     OR NEW.voice_url     IS DISTINCT FROM OLD.voice_url
     OR NEW.created_at    IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Only read_at may be updated on an existing message';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_message_read_only_update ON public.messages;
CREATE TRIGGER trg_enforce_message_read_only_update
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_message_read_only_update();

-- ─── Trigger: keep conversations.last_message / last_message_at fresh ──────────
CREATE OR REPLACE FUNCTION public.touch_conversation_on_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.conversations
  SET    last_message    = COALESCE(NEW.text, CASE
           WHEN NEW.image_url IS NOT NULL THEN '📷 Photo'
           WHEN NEW.video_url IS NOT NULL THEN '🎥 Video'
           WHEN NEW.voice_url IS NOT NULL THEN '🎤 Voice message'
           ELSE ''
         END),
         last_message_at = NEW.created_at
  WHERE  id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_conversation_on_message ON public.messages;
CREATE TRIGGER trg_touch_conversation_on_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_conversation_on_message();

-- ─── Trigger: auto-create the shift group chat when a worker is confirmed ──────
CREATE OR REPLACE FUNCTION public.create_shift_conversation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_client_id UUID;
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    SELECT client_id INTO v_client_id FROM public.shifts WHERE id = NEW.shift_id;
    IF v_client_id IS NOT NULL THEN
      INSERT INTO public.conversations (participant_a_id, participant_b_id, shift_id)
      VALUES (NEW.worker_id, v_client_id, NEW.shift_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_shift_conversation ON public.applications;
CREATE TRIGGER trg_create_shift_conversation
  AFTER UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.create_shift_conversation();

-- ─── Trigger: notify on payment received ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_payment_received()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, shift_id, amount)
  VALUES (
    NEW.worker_id, 'payment_received', 'Payment received',
    'Your payout has been deposited.', NEW.shift_id, NEW.net_amount
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_payment_received ON public.payments;
CREATE TRIGGER trg_notify_payment_received
  AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.notify_payment_received();

-- ─── Trigger: notify on new review ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_new_review()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, shift_id, from_user_id)
  VALUES (
    NEW.reviewee_id, 'new_review', 'New review',
    'You received a ' || NEW.rating || '-star review.', NEW.shift_id, NEW.reviewer_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_review ON public.reviews;
CREATE TRIGGER trg_notify_new_review
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_review();

-- ─── Trigger: notify on new follower ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_new_follower()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_username TEXT;
BEGIN
  SELECT username INTO v_username FROM public.users WHERE id = NEW.follower_id;
  INSERT INTO public.notifications (user_id, type, title, body, from_user_id)
  VALUES (
    NEW.following_id, 'new_follower', 'New follower',
    '@' || COALESCE(v_username, 'Someone') || ' started following you.', NEW.follower_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_follower ON public.follows;
CREATE TRIGGER trg_notify_new_follower
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_follower();

-- ─── Trigger: notify accepted workers when a client cancels a shift ─────────────
CREATE OR REPLACE FUNCTION public.notify_shift_cancelled()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    INSERT INTO public.notifications (user_id, type, title, body, shift_id, from_user_id)
    SELECT a.worker_id, 'shift_cancelled', 'Shift cancelled',
           COALESCE(NEW.title, 'A shift') || ' was cancelled by the client.',
           NEW.id, NEW.client_id
    FROM public.applications a
    WHERE a.shift_id = NEW.id AND a.status = 'accepted';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_shift_cancelled ON public.shifts;
CREATE TRIGGER trg_notify_shift_cancelled
  AFTER UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.notify_shift_cancelled();

-- ─── Trigger: notify workers of a newly posted shift matching their job types ──
-- Matches on job_types overlap and a 25-mile radius from the worker's lat/lng
-- (workers without saved coordinates are skipped rather than guessed).
CREATE OR REPLACE FUNCTION public.notify_new_shift_match()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'open' THEN
    INSERT INTO public.notifications (user_id, type, title, body, shift_id)
    SELECT u.id, 'new_shift_match', 'New shift near you',
           COALESCE(NEW.title, 'A new shift') || ' matches your job type.',
           NEW.id
    FROM public.users u
    WHERE u.role = 'worker'
      AND u.job_types && NEW.job_types
      AND u.lat IS NOT NULL AND u.lng IS NOT NULL
      AND NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL
      AND (
        3958.8 * 2 * ASIN(SQRT(
          POWER(SIN(RADIANS(NEW.lat - u.lat) / 2), 2) +
          COS(RADIANS(u.lat)) * COS(RADIANS(NEW.lat)) *
          POWER(SIN(RADIANS(NEW.lng - u.lng) / 2), 2)
        ))
      ) <= 25;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_shift_match ON public.shifts;
CREATE TRIGGER trg_notify_new_shift_match
  AFTER INSERT ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_shift_match();

-- ============================================================
-- Phase 7: Shift Requests (Nowsta-style) + AI Match Notifications (Section 7)
-- Run in Supabase SQL Editor if upgrading an existing DB.
-- Adds: shift_requests table, its notify/decision triggers, and rewrites
-- notify_new_shift_match to also require an availability-day match and to
-- word the notification body using the shift's real pay_rate/pay_period.
-- ============================================================

-- ─── Shift requests: client/staffer personally invites a worker to a shift ──────
CREATE TABLE IF NOT EXISTS public.shift_requests (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id    UUID        NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  client_id   UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  worker_id   UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status      TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  message     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shift_id, worker_id)
);

-- Idempotent for upgrading a DB where shift_requests already exists without `message`.
ALTER TABLE public.shift_requests ADD COLUMN IF NOT EXISTS message TEXT;

ALTER TABLE public.shift_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shift_requests_select" ON public.shift_requests;
DROP POLICY IF EXISTS "shift_requests_insert" ON public.shift_requests;
DROP POLICY IF EXISTS "shift_requests_update" ON public.shift_requests;

-- Either side of the request can read it.
CREATE POLICY "shift_requests_select" ON public.shift_requests FOR SELECT
  USING (auth.uid() = client_id OR auth.uid() = worker_id);
-- Only the shift's owning client/staffer may request a worker, and only for their own shift.
CREATE POLICY "shift_requests_insert" ON public.shift_requests FOR INSERT
  WITH CHECK (
    auth.uid() = client_id AND
    auth.uid() = (SELECT client_id FROM public.shifts WHERE id = shift_id)
  );
-- Only the requested worker may accept/decline — the client cannot flip their own request.
-- Note: RLS WITH CHECK alone can't compare NEW against OLD (e.g. "shift_id must not
-- change"), so shift_id/client_id/worker_id/pending→accepted-or-declined immutability
-- is enforced below by a BEFORE UPDATE trigger, not by the policy itself.
CREATE POLICY "shift_requests_update" ON public.shift_requests FOR UPDATE
  USING (auth.uid() = worker_id)
  WITH CHECK (auth.uid() = worker_id AND status IN ('accepted', 'declined'));

-- ─── Trigger: lock down what a decision update is allowed to change ─────────────
-- Without this, a worker's UPDATE (permitted by the RLS policy above on `status`)
-- could smuggle in changes to shift_id/client_id/worker_id, or flip status back
-- and forth between accepted/declined/pending — either of which would let
-- handle_shift_request_decision below apply its side effects (accepted
-- application + spots_filled increment) against the wrong shift, or more than once.
CREATE OR REPLACE FUNCTION public.enforce_shift_request_decision_only()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.shift_id <> OLD.shift_id OR NEW.client_id <> OLD.client_id OR NEW.worker_id <> OLD.worker_id THEN
    RAISE EXCEPTION 'shift_requests: shift_id, client_id, and worker_id cannot be changed';
  END IF;
  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'shift_requests: this request has already been decided';
  END IF;
  IF NEW.status NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'shift_requests: status may only move from pending to accepted or declined';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_shift_request_decision_only ON public.shift_requests;
CREATE TRIGGER trg_enforce_shift_request_decision_only
  BEFORE UPDATE ON public.shift_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_shift_request_decision_only();

-- ─── Trigger: notify the worker when a client personally requests them ──────────
CREATE OR REPLACE FUNCTION public.notify_shift_request_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_shift_title TEXT;
BEGIN
  SELECT title INTO v_shift_title FROM public.shifts WHERE id = NEW.shift_id;
  INSERT INTO public.notifications (user_id, type, title, body, shift_id, from_user_id)
  VALUES (
    NEW.worker_id, 'direct_shift_request', 'You were requested for a shift',
    'A client wants you for ' || COALESCE(v_shift_title, 'a shift') || '.' ||
      CASE WHEN NEW.message IS NOT NULL AND NEW.message <> '' THEN ' "' || NEW.message || '"' ELSE ' Review and respond.' END,
    NEW.shift_id, NEW.client_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_shift_request_created ON public.shift_requests;
CREATE TRIGGER trg_notify_shift_request_created
  AFTER INSERT ON public.shift_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_shift_request_created();

-- ─── Trigger: worker's Accept/Decline decision on a shift request ───────────────
-- Accept skips the normal pending-application review: it writes (or upserts)
-- a *confirmed* `applications` row directly, so the existing Shift Detail CTA
-- logic (applicationStatus === 'accepted' → Clock In) unlocks immediately.
-- Note: on this table, `spots_available` is the TOTAL slots posted (not the
-- remainder) — the remaining count is spots_available - spots_filled, so an
-- accepted request increments spots_filled, it never decrements spots_available.
CREATE OR REPLACE FUNCTION public.handle_shift_request_decision()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_shift_title TEXT;
  v_prev_status TEXT;
  v_filled      BOOLEAN;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT title INTO v_shift_title FROM public.shifts WHERE id = NEW.shift_id;

  IF NEW.status = 'accepted' THEN
    -- Tell the applications-table triggers (notify_application_status_changed,
    -- handle_application_assigned) to skip their own spots_filled/notify side
    -- effects below — this function already performs them itself.
    PERFORM set_config('app.via_shift_request_decision', 'true', true);

    SELECT status INTO v_prev_status
    FROM public.applications WHERE shift_id = NEW.shift_id AND worker_id = NEW.worker_id;

    -- Only count/require a fill if the application row wasn't already accepted
    -- (e.g. a staffer had already assigned this worker directly) — otherwise
    -- this would double-count the same worker's spot.
    IF v_prev_status IS DISTINCT FROM 'accepted' THEN
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

    INSERT INTO public.applications (shift_id, worker_id, status)
    VALUES (NEW.shift_id, NEW.worker_id, 'accepted')
    ON CONFLICT (shift_id, worker_id) DO UPDATE SET status = 'accepted';

    INSERT INTO public.notifications (user_id, type, title, body, shift_id, from_user_id)
    VALUES (
      NEW.client_id, 'application_accepted', 'Shift request accepted',
      'Your request for ' || COALESCE(v_shift_title, 'the shift') || ' was accepted.',
      NEW.shift_id, NEW.worker_id
    );
  ELSIF NEW.status = 'declined' THEN
    INSERT INTO public.notifications (user_id, type, title, body, shift_id, from_user_id)
    VALUES (
      NEW.client_id, 'application_declined', 'Shift request declined',
      'Your request for ' || COALESCE(v_shift_title, 'the shift') || ' was declined.',
      NEW.shift_id, NEW.worker_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_shift_request_decision ON public.shift_requests;
CREATE TRIGGER trg_handle_shift_request_decision
  AFTER UPDATE ON public.shift_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_shift_request_decision();

-- ─── Rewrite: AI-matching notification now also requires an availability match ──
-- (job-type match AND the worker's availability[day-of-week] is true), and the
-- body uses the shift's real pay_rate/pay_period + day name, e.g.
-- "New Bartender shift matches your availability — $28/hr Saturday night".
CREATE OR REPLACE FUNCTION public.notify_new_shift_match()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_day_key   TEXT;
  v_day_label TEXT;
  v_daypart   TEXT;
  v_price     TEXT;
BEGIN
  IF NEW.status <> 'open' THEN RETURN NEW; END IF;

  v_day_key   := (ARRAY['sun','mon','tue','wed','thu','fri','sat'])[EXTRACT(DOW FROM NEW.start_time)::int + 1];
  v_day_label := TRIM(TO_CHAR(NEW.start_time, 'FMDay'));
  v_daypart   := CASE
    WHEN EXTRACT(HOUR FROM NEW.start_time) < 12 THEN 'morning'
    WHEN EXTRACT(HOUR FROM NEW.start_time) < 17 THEN 'afternoon'
    ELSE 'night'
  END;
  v_price := chr(36) || TRIM(TO_CHAR(NEW.pay_rate, 'FM999999990.00'));

  INSERT INTO public.notifications (user_id, type, title, body, shift_id)
  SELECT u.id, 'new_shift_match', 'New shift matches your availability',
         'New ' || COALESCE(NEW.job_type, 'shift') || ' shift matches your availability -- ' ||
           v_price || '/' || COALESCE(NEW.pay_period, 'hr') ||
           ' ' || v_day_label || ' ' || v_daypart || '.',
         NEW.id
  FROM public.users u
  WHERE u.role = 'worker'
    AND (
      u.primary_job_type = NEW.job_type
      OR NEW.job_type = ANY(u.secondary_job_types)
      OR u.job_types && NEW.job_types
    )
    AND u.availability IS NOT NULL
    AND COALESCE((u.availability ->> v_day_key)::boolean, false) = true;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_shift_match ON public.shifts;
CREATE TRIGGER trg_notify_new_shift_match
  AFTER INSERT ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_shift_match();

-- ============================================================
-- Phase 8: Staffer Roster + Assign Workers (Section 8)
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
