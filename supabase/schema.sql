-- ============================================================
-- 365 Connect — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── USERS ────────────────────────────────────────────────────────────────────
-- Extends auth.users with app-specific profile data.
CREATE TABLE IF NOT EXISTS public.users (
  id            UUID          REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email         TEXT          NOT NULL,
  role          TEXT          NOT NULL DEFAULT 'worker' CHECK (role IN ('worker', 'client')),
  username      TEXT          UNIQUE,
  photo_url     TEXT,
  bio           TEXT,
  job_types     TEXT[]        NOT NULL DEFAULT '{}',
  certifications TEXT[]       NOT NULL DEFAULT '{}',
  rating        NUMERIC(3,2)  NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Auto-create a users row when someone signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ─── SHIFTS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shifts (
  id               UUID         DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id        UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title            TEXT         NOT NULL,
  job_type         TEXT         NOT NULL,
  description      TEXT,
  date             DATE         NOT NULL,
  start_time       TIME         NOT NULL,
  end_time         TIME         NOT NULL,
  pay_rate         NUMERIC(10,2),
  location         TEXT,
  dress_code       TEXT,
  point_of_contact TEXT,
  status           TEXT         NOT NULL DEFAULT 'open'
                                CHECK (status IN ('open', 'filled', 'completed', 'cancelled')),
  spots_available  INTEGER      NOT NULL DEFAULT 1,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── APPLICATIONS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.applications (
  id           UUID         DEFAULT uuid_generate_v4() PRIMARY KEY,
  shift_id     UUID         NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  worker_id    UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status       TEXT         NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  match_score  NUMERIC(5,2),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (shift_id, worker_id)
);

-- ─── MESSAGES ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id              UUID         DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID         NOT NULL,
  sender_id       UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  text            TEXT,
  image_url       TEXT,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at);

-- ─── REVIEWS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id           UUID         DEFAULT uuid_generate_v4() PRIMARY KEY,
  shift_id     UUID         NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  from_user_id UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  to_user_id   UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating       INTEGER      NOT NULL CHECK (rating BETWEEN 1 AND 5),
  tags         TEXT[]       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Recompute average rating whenever a review is inserted or updated
CREATE OR REPLACE FUNCTION public.update_user_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.users
  SET rating = (
    SELECT COALESCE(ROUND(AVG(rating)::NUMERIC, 2), 0)
    FROM public.reviews
    WHERE to_user_id = NEW.to_user_id
  )
  WHERE id = NEW.to_user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_review_upsert ON public.reviews;
CREATE TRIGGER on_review_upsert
  AFTER INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_user_rating();

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────

ALTER TABLE public.users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews       ENABLE ROW LEVEL SECURITY;

-- users: public read, self write
CREATE POLICY "users_public_read"   ON public.users FOR SELECT USING (true);
CREATE POLICY "users_self_insert"   ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users_self_update"   ON public.users FOR UPDATE USING (auth.uid() = id);

-- shifts: public read, clients write their own
CREATE POLICY "shifts_public_read"  ON public.shifts FOR SELECT USING (true);
CREATE POLICY "shifts_client_write" ON public.shifts FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "shifts_client_update" ON public.shifts FOR UPDATE USING (auth.uid() = client_id);
CREATE POLICY "shifts_client_delete" ON public.shifts FOR DELETE USING (auth.uid() = client_id);

-- applications: workers manage their own; shift clients can read
CREATE POLICY "apps_worker_insert"  ON public.applications FOR INSERT WITH CHECK (auth.uid() = worker_id);
CREATE POLICY "apps_worker_update"  ON public.applications FOR UPDATE USING (auth.uid() = worker_id);
CREATE POLICY "apps_self_read"      ON public.applications FOR SELECT
  USING (auth.uid() = worker_id OR
         auth.uid() = (SELECT client_id FROM public.shifts WHERE id = shift_id));

-- messages: participants can read and send in their conversations
CREATE POLICY "messages_self_read"   ON public.messages FOR SELECT
  USING (auth.uid() = sender_id OR
         EXISTS (SELECT 1 FROM public.messages m2
                 WHERE m2.conversation_id = messages.conversation_id
                   AND m2.sender_id = auth.uid()));
CREATE POLICY "messages_self_insert" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- reviews: public read, shift participants write
CREATE POLICY "reviews_public_read"  ON public.reviews FOR SELECT USING (true);
CREATE POLICY "reviews_participant_write" ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

-- ─── STORAGE BUCKETS (run separately or via dashboard) ───────────────────────
-- In Supabase Dashboard → Storage → New bucket:
--   1. Name: "avatars"    | Public: true
--   2. Name: "post-photos" | Public: true
--
-- Or run:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('post-photos', 'post-photos', true) ON CONFLICT DO NOTHING;
--
-- Storage RLS (run these too):
-- CREATE POLICY "avatars_self_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
-- CREATE POLICY "post_photos_self_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'post-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "post_photos_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'post-photos');
