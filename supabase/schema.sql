-- ============================================================
-- 365 Connect — Supabase Schema
-- Run this in your Supabase project → SQL Editor → New query
-- ============================================================

-- ─── Users ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id              UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT,
  role            TEXT        NOT NULL DEFAULT 'worker' CHECK (role IN ('worker', 'client', 'admin')),
  username        TEXT        UNIQUE,
  photo_url       TEXT,
  bio             TEXT,
  job_types       TEXT[]      NOT NULL DEFAULT '{}',
  certifications  TEXT[]      NOT NULL DEFAULT '{}',
  rating          NUMERIC(3,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop then recreate so re-runs are idempotent
DROP POLICY IF EXISTS "users_select" ON public.users;
DROP POLICY IF EXISTS "users_insert" ON public.users;
DROP POLICY IF EXISTS "users_update" ON public.users;
DROP POLICY IF EXISTS "users_service_role" ON public.users;

CREATE POLICY "users_select"       ON public.users FOR SELECT USING (true);
CREATE POLICY "users_insert"       ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users_update"       ON public.users FOR UPDATE USING (auth.uid() = id);

-- ─── Storage buckets ──────────────────────────────────────
-- (create via Supabase Storage UI or uncomment below)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('posts',   'posts',   true) ON CONFLICT DO NOTHING;
