-- 0031: lock down what the browser's anon key can read and write.
--
-- Before this migration:
--   * users_select USING (true) exposed every user's email, exact home
--     coordinates and moderation columns to anyone holding the anon key;
--   * users_update USING (auth.uid() = id) let a signed-in user set their own
--     is_admin / is_pro / status / is_banned / rating through PostgREST.
--
-- The app only ever reads its OWN users row directly (LoginScreen /
-- PhoneAuthScreen after sign-in); everything else goes through the API, which
-- uses the service role and is unaffected by RLS. So:
--   1. users: SELECT is own-row only; no client INSERT / UPDATE / DELETE at all
--      (all profile writes go through the API's allow-lists).
--   2. public_profiles: a view of the public columns only (coordinates rounded
--      to ~1 km) for any signed-in user who needs to look someone up directly.
--   3. follows / reviews / posts / post_likes / post_comments / shifts: readable
--      by signed-in users only, never by the anon role.

-- ── 1. users ─────────────────────────────────────────────────────────────────
drop policy if exists "users_select"       on public.users;
drop policy if exists "users_insert"       on public.users;
drop policy if exists "users_update"       on public.users;
drop policy if exists "users_admin_select" on public.users;
drop policy if exists "users_admin_update" on public.users;

create policy "users_select" on public.users
  for select to authenticated
  using (auth.uid() = id);

-- Belt and braces: even if a permissive policy is ever re-added, the browser
-- roles hold no write privilege on the table.
revoke insert, update, delete, truncate, references, trigger on public.users from anon, authenticated;
revoke select on public.users from anon;

-- ── 2. public_profiles ───────────────────────────────────────────────────────
-- Owned by postgres and NOT security_invoker, so it reads the base table
-- without the caller's RLS; it only exposes the columns the API's PUBLIC_COLS
-- exposes, with the home location coarsened the same way (two decimals).
create or replace view public.public_profiles
  with (security_invoker = false)
as
  select
    id, role, username, photo_url, bio, job_types, certifications, rating,
    primary_job_type, secondary_job_types, availability,
    round(lat::numeric, 2)::double precision as lat,
    round(lng::numeric, 2)::double precision as lng,
    is_pro, company_name, hourly_rate, created_at
  from public.users;

alter view public.public_profiles owner to postgres;
revoke all on public.public_profiles from anon, public;
grant select on public.public_profiles to authenticated;

-- ── 3. social tables: signed-in readers only ─────────────────────────────────
drop policy if exists "follows_select" on public.follows;
create policy "follows_select" on public.follows for select to authenticated using (true);

drop policy if exists "reviews_select" on public.reviews;
create policy "reviews_select" on public.reviews for select to authenticated using (true);

drop policy if exists "posts_select" on public.posts;
drop policy if exists "Anyone can view posts" on public.posts;
create policy "posts_select" on public.posts for select to authenticated using (true);

drop policy if exists "post_likes_select" on public.post_likes;
create policy "post_likes_select" on public.post_likes for select to authenticated using (true);

drop policy if exists "post_comments_select" on public.post_comments;
create policy "post_comments_select" on public.post_comments for select to authenticated using (true);

-- Shifts carry the poster's point of contact and phone number.
drop policy if exists "shifts_select" on public.shifts;
create policy "shifts_select" on public.shifts for select to authenticated using (true);

revoke all on public.follows, public.reviews, public.posts, public.post_likes,
  public.post_comments, public.shifts from anon;
