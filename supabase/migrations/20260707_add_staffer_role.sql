-- ============================================================
-- Migration: add 'staffer' to users.role CHECK constraint
-- Safe to run on a live database — no data is dropped or altered.
--
-- BEFORE:  CHECK (role IN ('worker', 'client', 'admin'))
-- AFTER:   CHECK (role IN ('worker', 'client', 'admin', 'staffer'))
--
-- Run in: Supabase dashboard → SQL Editor → New query → Run
-- ============================================================

-- Step 1: confirm the current constraint name
-- (PostgreSQL auto-names it 'users_role_check' when none is specified)
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM   pg_constraint
WHERE  conrelid = 'public.users'::regclass
  AND  contype  = 'c';

-- Step 2: drop the existing check constraint (no data affected)
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

-- Step 3: add the widened constraint that includes 'staffer'
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('worker', 'client', 'admin', 'staffer'));

-- Step 4: verify the new constraint is in place
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM   pg_constraint
WHERE  conrelid = 'public.users'::regclass
  AND  contype  = 'c';
