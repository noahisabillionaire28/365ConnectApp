# Auth, data access and the background clock

What the second audit changed, what needs a manual step, and how to flip the
one behaviour that is behind a flag.

## What the browser can read and write directly (RLS)

Migration `0031_rls_hardening.sql` (applied):

- `public.users`: a signed-in user can read **only their own row** through
  the anon key. No client-side INSERT / UPDATE / DELETE at all — every profile
  write goes through the API, whose allow-lists never include `email`,
  `is_pro`, `status`, `is_admin` or `is_banned`.
- `public.public_profiles`: a view of the public profile columns (coordinates
  rounded to two decimals, ~1 km) any signed-in user may read. The API's
  `GET /users/:id` returns the same shape and is still the preferred path.
- `follows`, `reviews`, `posts`, `post_likes`, `post_comments`, `shifts`:
  readable by signed-in users only; the anon role has no privileges.

The API server uses the service role, so none of this affects it. The only
direct table read left in the app is the own-row read on `LoginScreen`, which
the own-row policy allows. (The unreachable phone-OTP screen was removed.)

## Sign-up and `AUTH_AUTOCONFIRM`

`POST /api/auth/register` is rate-limited (5 per 15 minutes per IP and per
email; best effort per serverless instance) and answers the same body whether
or not the address is already registered. `GET /api/link-preview` is limited
to 60 per 15 minutes per user.

Email confirmation is behind an environment variable on the API project:

| `AUTH_AUTOCONFIRM` | Behaviour |
| --- | --- |
| unset or `true` (**current**) | The server creates an already-confirmed account and the app signs the user straight in. |
| `false` | The server creates nothing; the app calls `supabase.auth.signUp`, Supabase sends the confirmation email, and the app shows "Check your email". |

Before setting it to `false` in production:

1. Supabase → Authentication → Email Templates: check the *Confirm signup*
   template.
2. Supabase → Project Settings → Auth → SMTP: configure a real sender. The
   built-in sender is rate-limited to a handful of emails per hour and, on
   newer projects, only delivers to team members.
3. Supabase → Authentication → URL Configuration: the site URL must be the
   app's URL so the confirmation link lands on it.
4. Set `AUTH_AUTOCONFIRM=false` on the `365-connect-api` Vercel project and
   redeploy.

## Roles

`POST /api/users` accepts `role` only while the account has none. Role select
is the one screen that sends it; once a role is set it cannot be changed from
the app (an admin can, from the panel). The splash and Home screens no longer
send a signed-in user to role select when the profile read merely failed:
they show a retry card, so a network blip can never rewrite an account.

## Account deletion

`DELETE /api/users/me` (signed-in user) deletes the Supabase auth account;
every table that references `public.users(id)` cascades (profile, posts,
stories, messages, applications, reviews, follows, notifications, push
subscriptions, payments rows that reference the user). It answers **409** with
an explanation while the user still has commitments other people rely on:

- as a worker: an accepted application on an open/filled shift that has not
  ended yet → "withdraw from it first";
- as a poster: an open or filled shift that has not ended yet → "cancel it
  first".

In the app it lives under Profile → Settings → **Delete account**, behind a
confirmation sheet that requires typing `DELETE`; on success the app signs out
and returns to the splash screen. The admin panel's *Delete User* is refused
(409) while the user has shifts, applications or payments; suspend or ban
instead.

## Native deep links (iOS app)

Inside the Capacitor shell the app asks Supabase to redirect to the custom
scheme instead of the web origin: `connect365://auth/callback` for OAuth /
magic links and `connect365://reset-password` for password resets. Both must
be on the Supabase redirect allow-list (docs/ios-testflight.md, step 5).
`NativeBridge` reads the tokens from the link fragment, sets the session, and
opens `/reset-password` when the link is a recovery link (`type=recovery`),
or the splash route otherwise. A failed link (`#error=…`) is passed through
to the reset screen, which explains and offers to send a new one.

## Scheduled routes

`POST /api/cron/tick` and `GET|POST /api/messages/flush-scheduled` require
`Authorization: Bearer <CRON_SECRET>`. With no `CRON_SECRET` configured they
answer 401 (they used to be open). Vercel cron sends the header itself.

The 15-minute tick is a pg_cron job (`365connect-tick`) in the Supabase
database. Migration `0032_cron_tick.sql` records it and recreates it on a
fresh database **without the secret in the file**: it reads the database
settings `app.cron_url` and `app.cron_secret`. To (re)create the job:

```sql
alter database postgres set app.cron_url    = 'https://365-connect-api.vercel.app/api/cron/tick';
alter database postgres set app.cron_secret = '<the CRON_SECRET from Vercel>';
-- then re-run migration 0032 (or, to rotate: select cron.unschedule('365connect-tick'); and re-run it)
```

Windows are wider than the cadence so a late tick misses nothing: saved-search
alerts look back 30 minutes, the "starts in 2h" reminder covers 1h40–2h20,
rating prompts cover 1–4 h after the end and the reminder 25–28 h.
Dedupe is per (user, shift, type) in `notifications`; users who turned in-app
notifications off get a hidden row instead of none, so they are emailed once.

## Uploads

The `uploads` bucket accepts images, `video/mp4`, `video/quicktime`,
`audio/*` and `application/pdf` up to 25 MB. The API sets these limits on the
bucket at startup and `POST /storage/sign-upload` checks the declared type and
size first so the app can show a clear message.
