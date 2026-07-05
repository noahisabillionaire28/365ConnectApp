-- ============================================================
-- 365 Connect — Supabase Schema
-- Run this in your Supabase project → SQL Editor → New query
-- Safe to re-run: all statements use IF NOT EXISTS / DROP IF EXISTS
-- ============================================================

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id              UUID          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT,
  role            TEXT          NOT NULL DEFAULT 'worker' CHECK (role IN ('worker', 'client', 'admin')),
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
CREATE POLICY "applications_update" ON public.applications FOR UPDATE
  USING (
    auth.uid() = worker_id OR
    auth.uid() = (SELECT client_id FROM public.shifts WHERE id = shift_id)
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
