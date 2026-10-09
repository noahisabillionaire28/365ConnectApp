-- 0037: data minimisation + ratings that survive deletions.
--
-- 1. users.followers_count / following_count were never written by any trigger
--    or route (counts are computed live from `follows` by GET /follows/counts)
--    so they sat at 0 forever. Dropped: a column nothing reads or writes is
--    data we should not keep.
-- 2. users.rating is recomputed by trg_update_user_rating, which only fired on
--    INSERT / UPDATE. Deleting a review (moderation, a removed test row, an
--    account deletion that cascades) left the stale average behind, so a
--    profile could show stars no surviving review supports. The trigger now
--    also fires on DELETE and recomputes from the remaining real reviews.
--
-- Idempotent: safe to re-run. Fails fast instead of queueing behind a busy
-- users table (re-run when quiet).
set lock_timeout = '5s';

alter table public.users drop column if exists followers_count;
alter table public.users drop column if exists following_count;

create or replace function public.update_user_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.reviewee_id, old.reviewee_id);
begin
  update public.users
  set    rating = (
    select coalesce(avg(rating), 0)
    from   public.reviews
    where  reviewee_id = target
  )
  where  id = target;
  return coalesce(new, old);
end;
$$;

revoke execute on function public.update_user_rating() from public, anon, authenticated;

drop trigger if exists trg_update_user_rating on public.reviews;
create trigger trg_update_user_rating
  after insert or update or delete on public.reviews
  for each row execute function public.update_user_rating();

comment on column public.users.rating is
  'Average of public.reviews.rating for this user, maintained by trg_update_user_rating on insert, update and delete. Computed only from real review rows.';
