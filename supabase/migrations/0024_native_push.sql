-- Native (iOS) push tokens live next to web push subscriptions.
--   platform = 'web'  → endpoint + keys (VAPID / service worker)
--   platform = 'ios'  → endpoint holds the APNs device token, keys is null
alter table public.push_subscriptions
  add column if not exists platform text not null default 'web';
alter table public.push_subscriptions
  alter column keys drop not null;
alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_platform_check;
alter table public.push_subscriptions
  add constraint push_subscriptions_platform_check check (platform in ('web', 'ios', 'android'));
