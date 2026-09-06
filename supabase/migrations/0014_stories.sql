-- 0014_stories.sql
-- Instagram-style ephemeral Stories: a photo that disappears after 24 hours.
-- Shown in a ring tray at the top of the Explore feed, from people you follow
-- (and yourself). Read/written by the service-role backend; RLS scopes writes
-- to the author and lets any authenticated user read active stories.

create table if not exists public.stories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  photo_url  text not null,
  caption    text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

-- Who has seen which story (drives the "unseen" gradient ring + view counts).
create table if not exists public.story_views (
  id         uuid primary key default gen_random_uuid(),
  story_id   uuid not null references public.stories(id) on delete cascade,
  viewer_id  uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (story_id, viewer_id)
);

create index if not exists stories_active_idx on public.stories(expires_at, created_at desc);
create index if not exists stories_user_idx   on public.stories(user_id, created_at desc);
create index if not exists story_views_viewer_idx on public.story_views(viewer_id);

alter table public.stories      enable row level security;
alter table public.story_views  enable row level security;

drop policy if exists "stories_select"      on public.stories;
drop policy if exists "stories_insert"      on public.stories;
drop policy if exists "stories_delete"      on public.stories;
create policy "stories_select" on public.stories for select using (true);
create policy "stories_insert" on public.stories for insert with check (auth.uid() = user_id);
create policy "stories_delete" on public.stories for delete using (auth.uid() = user_id);

drop policy if exists "story_views_select" on public.story_views;
drop policy if exists "story_views_insert" on public.story_views;
create policy "story_views_select" on public.story_views for select using (auth.uid() = viewer_id);
create policy "story_views_insert" on public.story_views for insert with check (auth.uid() = viewer_id);
