---
name: Supabase integration
description: How Supabase is wired into 365 Connect — client setup, auth flow, schema, storage, and key gotchas.
---

## Rule
VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are Replit Secrets exposed to Vite via `import.meta.env`. A dev-server restart is required after adding/changing these secrets — HMR alone does not pick them up.

**Why:** Vite bakes `import.meta.env` at build/startup time, not at module evaluation time.

## Schema
All DDL lives in `supabase/schema.sql`. It must be run manually in the Supabase Dashboard → SQL Editor. It cannot be auto-applied. The file includes tables (users, shifts, applications, messages, reviews), RLS policies, auth triggers (auto-insert users row on signup), and a rating-average trigger. Storage bucket creation instructions are in the comments at the bottom.

## Auth flow
- Email sign-up: `supabase.auth.signUp` → if `data.session` is truthy (email confirmation disabled), navigate to /role-select immediately; otherwise show "check your email" screen and do NOT advance the user.
- Login: `supabase.auth.signInWithPassword` → use `.maybeSingle()` (not `.single()`) for the profile check so a missing row is null, not an error. Only route to /role-select on null result; throw on actual DB errors.
- **Missing-table resilience**: LoginScreen, AuthCallbackScreen, and PhoneAuthScreen all check for PostgREST error code `42P01` (or "relation"/"does not exist" in message) and treat it as "no profile → /role-select" instead of crashing. This makes the app functional before the schema is applied.
- OAuth (Google/Apple): `signInWithOAuth` with `redirectTo` pointing to `/auth/callback`. Dedicated `AuthCallbackScreen` handles the redirect, upserts the users row, and routes new vs returning users. Provider must be enabled in Supabase Dashboard → Authentication → Providers.
- Phone: `/phone-auth` route — two-step SMS OTP via Twilio (must be configured in Supabase Dashboard → Auth → Providers → Phone). Code handles graceful error if provider not configured.
- Password reset: `resetPasswordForEmail` with `redirectTo` pointing to `/reset-password`. The `ResetPasswordScreen` listens for the `PASSWORD_RECOVERY` auth event to gate the form.

## Replit network constraint
Outbound TCP on port 5432/6543 is blocked — psql/pg cannot connect to Supabase Postgres from Replit. Direct DB migrations must be run via the Supabase SQL Editor in the dashboard, not from shell scripts. The Supabase Management API (api.supabase.com) requires a PAT (not the service role key), so that path also requires a separate credential.

## Profile save
ProfileSetupScreen reads `sessionStorage.getItem('selectedRole')` (set by RoleSelectScreen) and upserts to `public.users`. Storage uploads (avatars, post-photos) require public buckets named "avatars" and "post-photos" — see schema.sql comments for bucket creation SQL.

## Public profile fetch
WorkerProfileScreen selects only public-safe columns (`id, role, username, photo_url, bio, job_types, certifications, rating, created_at`) — never `email`. Uses typed `.returns<ReviewWithShift[]>()` for the joined reviews query.

## What's NOT done yet
- Follows/following count (needs a `follows` table)
- Verified badge (needs a `subscriptions` table)
- First-post storage (logged as console.info; full feed posts table deferred)
- Phone auth (disabled in UI, pending Twilio/SMS setup in Supabase)
