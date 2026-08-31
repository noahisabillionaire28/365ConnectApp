-- 0012_post_likes_comments.sql
-- Social layer: likes + comments on posts, and a post link on notifications so
-- like/comment alerts can deep-link to the post. Tables are read/written by the
-- service-role backend; RLS policies mirror the follows table for safety.

-- ── Likes ────────────────────────────────────────────────────────────────────
create table if not exists public.post_likes (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);
alter table public.post_likes enable row level security;
drop policy if exists "post_likes_select" on public.post_likes;
drop policy if exists "post_likes_insert" on public.post_likes;
drop policy if exists "post_likes_delete" on public.post_likes;
create policy "post_likes_select" on public.post_likes for select using (true);
create policy "post_likes_insert" on public.post_likes for insert with check (auth.uid() = user_id);
create policy "post_likes_delete" on public.post_likes for delete using (auth.uid() = user_id);
create index if not exists post_likes_post_idx on public.post_likes(post_id);

-- ── Comments ─────────────────────────────────────────────────────────────────
create table if not exists public.post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
alter table public.post_comments enable row level security;
drop policy if exists "post_comments_select" on public.post_comments;
drop policy if exists "post_comments_insert" on public.post_comments;
drop policy if exists "post_comments_delete" on public.post_comments;
create policy "post_comments_select" on public.post_comments for select using (true);
create policy "post_comments_insert" on public.post_comments for insert with check (auth.uid() = user_id);
create policy "post_comments_delete" on public.post_comments for delete using (auth.uid() = user_id);
create index if not exists post_comments_post_idx on public.post_comments(post_id, created_at);

-- ── Notifications → post deep-link ───────────────────────────────────────────
alter table public.notifications
  add column if not exists post_id uuid references public.posts(id) on delete cascade;
