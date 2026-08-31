-- 0011_no_show_alerts.sql
-- Automated no-show / late alerts. A function that (a) tells the client when a
-- booked worker still hasn't clocked in 15+ min after start, and (b) warns the
-- worker they're late. Deduped per user+shift+type. The gate_notification_by_pref
-- trigger still applies, so recipients who turned in-app notifications off are
-- skipped. Schedule it with pg_cron (see the commented cron.schedule below).

create or replace function public.notify_no_show_late()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- (a) Alert the client: a booked worker hasn't clocked in 15+ min after start.
  insert into public.notifications (user_id, from_user_id, type, title, body, shift_id)
  select s.client_id, a.worker_id, 'no_show_alert', 'Worker hasn''t clocked in',
         coalesce('@' || u.username, 'A worker')
           || ' still hasn''t clocked in for "' || coalesce(s.title, 'a shift') || '".',
         s.id
  from public.applications a
  join public.shifts s on s.id = a.shift_id
  left join public.users u on u.id = a.worker_id
  left join public.time_entries t on t.shift_id = s.id and t.worker_id = a.worker_id
  where a.status = 'accepted'
    and s.status not in ('cancelled', 'completed')
    and s.client_id is not null
    and t.clock_in is null
    and now() >= s.start_time + interval '15 minutes'
    and now() <= s.start_time + interval '12 hours'
    and not exists (
      select 1 from public.notifications n
      where n.user_id = s.client_id and n.shift_id = s.id and n.type = 'no_show_alert'
    );

  -- (b) Warn the worker they're late (10+ min after start, not yet clocked in).
  insert into public.notifications (user_id, from_user_id, type, title, body, shift_id)
  select a.worker_id, s.client_id, 'late_clock_in', 'You''re late — clock in now',
         'Your shift "' || coalesce(s.title, 'a shift')
           || '" has started. Please clock in as soon as you arrive.',
         s.id
  from public.applications a
  join public.shifts s on s.id = a.shift_id
  left join public.time_entries t on t.shift_id = s.id and t.worker_id = a.worker_id
  where a.status = 'accepted'
    and s.status not in ('cancelled', 'completed')
    and t.clock_in is null
    and now() >= s.start_time + interval '10 minutes'
    and now() <= s.start_time + interval '12 hours'
    and not exists (
      select 1 from public.notifications n
      where n.user_id = a.worker_id and n.shift_id = s.id and n.type = 'late_clock_in'
    );
end;
$$;

-- To run it automatically every 5 minutes, enable the pg_cron extension
-- (Dashboard → Database → Extensions → pg_cron), then run once:
-- select cron.schedule('notify-no-show-late', '*/5 * * * *',
--   $$select public.notify_no_show_late();$$);
