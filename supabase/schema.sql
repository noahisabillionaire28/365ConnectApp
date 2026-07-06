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
Good. Now test the full app yourself.

Go through every screen in the Replit preview:

1. Splash screen - white, black logo
2. Sign up as worker - full flow
3. Complete profile setup
4. Home feed - white cards, shifts loading
5. Tap a shift - detail screen loads
6. Jobs tab - map loads with pins
7. Messages tab - loads
8. Notifications tab - loads
9. Profile tab - loads with data
10. Sign out
11. Sign up as client
12. Post a shift using 5-step wizard
13. Confirm shift appears in home feed
14. Admin login: admin@365connect.com / Admin123!
15. Check users list loads
16. Check shifts list loads

For each screen report:
- Works or broken
- What specifically is broken
- Fix it immediately if broken

Do not stop until every single screen works.
Fix as you go.
Report final status when all 12 are done.