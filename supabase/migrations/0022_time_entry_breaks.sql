-- 0022_time_entry_breaks.sql
-- 1) Server-tracked breaks: time_entries.break_started_at marks an open break;
--    POST /time-entries/:id/break/start|stop accumulate break_minutes and
--    clock-out closes any open break. Pay math lives on the server.
-- 2) book_worker(): the atomic capacity check used by every booking path
--    (owner accepts, direct assign, instant claim, invite accepted). Locks the
--    shift row, counts accepted applications, upserts the worker's application
--    to 'accepted', and derives spots_filled / status from the accepted count.

/* ── 1. Break tracking ─────────────────────────────────────────────────────── */
alter table public.time_entries
  add column if not exists break_started_at timestamptz;

comment on column public.time_entries.break_started_at is
  'When the worker''s current (open) break started; null when not on break.';

/* ── 2. Atomic booking ─────────────────────────────────────────────────────── */
create or replace function public.book_worker(p_shift uuid, p_worker uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift    public.shifts%rowtype;
  v_capacity int;
  v_others   int;
  v_total    int;
  v_app      public.applications%rowtype;
begin
  -- Serialise concurrent bookings on the same shift.
  select * into v_shift from public.shifts where id = p_shift for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_shift.status not in ('open', 'filled') or v_shift.end_time < now() then
    return jsonb_build_object('ok', false, 'code', 'closed');
  end if;

  v_capacity := greatest(1, coalesce(v_shift.spots_available, 1));

  -- Accepted workers other than this one (re-booking an accepted worker is a no-op).
  select count(*) into v_others
    from public.applications
   where shift_id = p_shift and status = 'accepted' and worker_id <> p_worker;

  if v_others >= v_capacity then
    return jsonb_build_object('ok', false, 'code', 'full');
  end if;

  insert into public.applications (shift_id, worker_id, status)
  values (p_shift, p_worker, 'accepted')
  on conflict (shift_id, worker_id) do update set status = 'accepted'
  returning * into v_app;

  v_total := v_others + 1;

  update public.shifts
     set spots_filled = v_total,
         status       = case when v_total >= v_capacity then 'filled' else 'open' end
   where id = p_shift;

  return jsonb_build_object(
    'ok', true,
    'application', to_jsonb(v_app),
    'spots_filled', v_total,
    'spots_available', v_capacity
  );
end;
$$;

-- Backend-only (service role). Not callable from the browser.
revoke execute on function public.book_worker(uuid, uuid) from public, anon, authenticated;
