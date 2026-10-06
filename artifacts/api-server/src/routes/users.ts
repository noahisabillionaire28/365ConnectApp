import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { invalidateRole, getRoleInfo } from '../lib/roleCache.js';
import { requireAuth, requireSession } from '../middleware/auth.js';
import { HttpError, sendError } from '../lib/httpError.js';
import { normalizeUsername, isUniqueViolation, HANDLE_TAKEN } from '../lib/username.js';
import { isBlockedEitherWay } from '../lib/chat.js';
import { rateLimit } from '../lib/rateLimit.js';
import { LEGAL_VERSIONS } from '../lib/legal.js';

const router = Router();

// Data portability is cheap to serve but reads a dozen tables: a handful of
// downloads per hour per account is plenty for a person, and stops a script
// from using it as a bulk reader.
const exportLimiter = rateLimit({
  windowMs: 60 * 60_000,
  max: 6,
  keys: (req) => [req.userId ? `user:${req.userId}` : null],
  message: 'You can download your data a few times an hour. Please try again later.',
});

/** The verified email on the Supabase auth account (never taken from the body). */
async function authEmail(userId: string): Promise<string | null> {
  try {
    const { data } = await adminDb.auth.admin.getUserById(userId);
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

/** A profile someone has blocked (either way) is not available to them. */
async function assertNotBlocked(viewerId: string, profileId: string): Promise<void> {
  if (viewerId === profileId) return;
  if (await isBlockedEitherWay(viewerId, profileId)) {
    throw new HttpError(403, "This profile isn't available.");
  }
}

// Note: notification preferences, email and moderation status are private and
// read via GET /me (select *), so they are intentionally NOT part of the
// public column set.
const PUBLIC_COLS =
  'id, role, username, photo_url, bio, job_types, certifications, ' +
  'rating, primary_job_type, secondary_job_types, availability, ' +
  'lat, lng, is_pro, company_name, hourly_rate, created_at';

/**
 * A public profile as another signed-in user may see it: the home location
 * is coarsened to ~1 km (two decimals) so a profile never pins someone's
 * house. The user themselves and admins get the exact coordinates.
 */
async function publicView(row: Record<string, unknown>, viewerId: string | null): Promise<Record<string, unknown>> {
  if (viewerId && (viewerId === row.id || (await getRoleInfo(viewerId)).isAdmin)) return row;
  const round = (v: unknown) => (v == null || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 100) / 100);
  return { ...row, lat: round(row.lat), lng: round(row.lng) };
}

/**
 * GET /api/users/me — current user's full profile. Uses requireSession (not
 * requireAuth) on purpose: a suspended account must still be able to read its
 * own status so the app can render the suspended screen instead of a blank one.
 */
router.get('/me', requireSession, async (req, res) => {
  const { data, error } = await adminDb
    .from('users')
    .select('*')
    .eq('id', req.userId)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'User not found' });
  return res.json(data);
});

/**
 * GET /api/users/me/export — everything we hold about the caller, as one JSON
 * bundle (profile, applications, time entries, payments, reviews given and
 * received, posts, comments, messages they sent, notifications, saved
 * searches, follows, legal acceptances). requireSession on purpose: a
 * suspended account keeps its right to a copy of its data. Served as an
 * attachment so a browser saves it as a file.
 */
router.get('/me/export', requireSession, exportLimiter, async (req, res) => {
  const me = req.userId!;
  const q = <T = Record<string, unknown>>(p: PromiseLike<{ data: T[] | null; error: { message: string } | null }>) =>
    Promise.resolve(p).then(({ data, error }) => { if (error) throw new HttpError(500, error.message); return data ?? []; });
  try {
    const [
      profileRows, authUser, applications, timeEntries, payments, reviewsGiven, reviewsReceived, posts, comments,
      messagesSent, notifications, savedSearches, following, followers, savedWorkers, legal, pushSubs, blocks,
    ] = await Promise.all([
      q(adminDb.from('users').select('*').eq('id', me).limit(1)),
      adminDb.auth.admin.getUserById(me).then((r) => r.data.user ?? null).catch(() => null),
      q(adminDb.from('applications').select('*').eq('worker_id', me).order('created_at', { ascending: false })),
      q(adminDb.from('time_entries').select('*').eq('worker_id', me).order('created_at', { ascending: false })),
      q(adminDb.from('payments').select('*').or(`worker_id.eq.${me},client_id.eq.${me}`).order('created_at', { ascending: false })),
      q(adminDb.from('reviews').select('*').eq('reviewer_id', me).order('created_at', { ascending: false })),
      q(adminDb.from('reviews').select('*').eq('reviewee_id', me).order('created_at', { ascending: false })),
      q(adminDb.from('posts').select('*').eq('user_id', me).order('created_at', { ascending: false })),
      q(adminDb.from('post_comments').select('*').eq('user_id', me).order('created_at', { ascending: false })),
      q(adminDb.from('messages').select('id, conversation_id, recipient_id, kind, text, image_url, video_url, voice_url, file_url, file_name, reply_to_id, shift_card_id, created_at, edited_at, deleted_at, read_at')
        .eq('sender_id', me).is('deleted_at', null).order('created_at', { ascending: false }).limit(5000)),
      q(adminDb.from('notifications').select('id, type, title, body, shift_id, post_id, from_user_id, amount, read, read_at, created_at')
        .eq('user_id', me).eq('hidden', false).order('created_at', { ascending: false }).limit(2000)),
      q(adminDb.from('saved_searches').select('*').eq('user_id', me)),
      q(adminDb.from('follows').select('following_id, created_at').eq('follower_id', me)),
      q(adminDb.from('follows').select('follower_id, created_at').eq('following_id', me)),
      q(adminDb.from('saved_workers').select('worker_id, created_at').eq('owner_id', me)),
      q(adminDb.from('legal_acceptances').select('document, version, accepted_at, ip, user_agent').eq('user_id', me).order('accepted_at', { ascending: true })),
      q(adminDb.from('push_subscriptions').select('id, platform, user_agent, created_at').eq('user_id', me)),
      q(adminDb.from('user_blocks').select('blocked_id, created_at').eq('blocker_id', me)),
    ]);

    // Shifts the user posted (as a poster) or worked (as a worker), so the
    // ids elsewhere in the bundle mean something without another lookup.
    const workedIds = [...new Set([...applications, ...timeEntries, ...payments].map((r) => r.shift_id as string | null).filter((v): v is string => !!v))];
    const [postedShifts, workedShifts] = await Promise.all([
      q(adminDb.from('shifts').select('*').eq('client_id', me).order('start_time', { ascending: false })),
      workedIds.length
        ? q(adminDb.from('shifts').select('id, title, company_name, job_type, location, start_time, end_time, timezone, pay_rate, pay_period, status').in('id', workedIds))
        : Promise.resolve([] as Record<string, unknown>[]),
    ]);

    const profile = profileRows[0] ?? null;
    const bundle = {
      export_version: 1,
      generated_at: new Date().toISOString(),
      user_id: me,
      about: {
        description: 'A copy of the personal data 365 Connect holds for your account, in JSON. Ids refer to rows in the other sections or to other users.',
        legal_versions_current: LEGAL_VERSIONS,
      },
      account: authUser
        ? { email: authUser.email ?? null, created_at: authUser.created_at ?? null, last_sign_in_at: authUser.last_sign_in_at ?? null, providers: authUser.app_metadata?.providers ?? null }
        : null,
      profile,
      applications,
      time_entries: timeEntries,
      payments,
      reviews: { given: reviewsGiven, received: reviewsReceived },
      posts,
      post_comments: comments,
      messages_sent: messagesSent,
      notifications,
      saved_searches: savedSearches,
      follows: { following, followers },
      saved_workers: savedWorkers,
      blocked_users: blocks,
      push_subscriptions: pushSubs,
      legal_acceptances: legal,
      shifts: { posted: postedShifts, worked_or_applied: workedShifts },
    };

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', `attachment; filename="365connect-my-data-${stamp}.json"`);
    return res.json(bundle);
  } catch (e) {
    return sendError(res, e);
  }
});

/** POST /api/users — upsert user (called after sign-up / profile setup) */
router.post('/', requireAuth, async (req, res) => {
  const body = req.body as Record<string, unknown>;
  // Users may self-assign worker/client/staffer during onboarding; admin is
  // granted out-of-band and can never be self-assigned here.
  const SELF_ASSIGNABLE = ['worker', 'client', 'staffer'];
  const safeRole =
    typeof body.role === 'string' && SELF_ASSIGNABLE.includes(body.role)
      ? body.role
      : undefined;

  // Build the payload with only provided fields so an upsert never nulls out
  // existing values on conflict. Email, Pro status and moderation status are
  // never taken from the body: email comes from the auth account, is_pro from
  // a recorded subscription, status from an admin.
  const optional = [
    'username', 'photo_url', 'bio', 'job_types', 'certifications',
    'primary_job_type', 'secondary_job_types', 'availability',
    'lat', 'lng', 'company_name', 'hourly_rate',
  ];
  const payload: Record<string, unknown> = { id: req.userId };
  for (const f of optional) {
    if (body[f] !== undefined && body[f] !== null) payload[f] = body[f];
  }

  const { data: existing } = await adminDb
    .from('users').select('role, username, email').eq('id', req.userId).maybeSingle();

  // An auto-generated username (sent at role select) must never replace one
  // the user chose during setup.
  if (payload.username !== undefined && existing?.username) delete payload.username;
  if (payload.username !== undefined) {
    try { payload.username = normalizeUsername(payload.username); } catch (e) { return sendError(res, e); }
  }
  if (!existing?.email) {
    const email = await authEmail(req.userId!);
    if (email) payload.email = email;
  }

  // A role is accepted only while the account has none. Role select is the
  // one place that sends it; a transient failure to read the profile used to
  // bounce an existing client back to role select, where a tap on "I'm
  // Working" silently turned their account into a worker.
  if (safeRole && !existing?.role) payload.role = safeRole;

  const { data, error } = await adminDb
    .from('users')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();
  if (error) {
    if (isUniqueViolation(error)) return res.status(409).json({ error: HANDLE_TAKEN });
    return res.status(500).json({ error: error.message });
  }
  if (payload.role !== undefined) invalidateRole(req.userId!);
  return res.json(data);
});

/** PATCH /api/users/me — partial update of current user */
router.patch('/me', requireAuth, async (req, res) => {
  // email (verified by auth), is_pro (subscription) and status (admin) are
  // deliberately not here.
  const allowed = [
    'username', 'photo_url', 'bio', 'job_types', 'certifications',
    'primary_job_type', 'secondary_job_types', 'availability',
    'lat', 'lng', 'company_name', 'is_available',
    'in_app_notifications', 'email_notifications', 'hourly_rate',
    'quick_replies',
  ];
  const body = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No valid fields' });
  if ('username' in updates) {
    try { updates.username = normalizeUsername(updates.username); } catch (e) { return sendError(res, e); }
  }

  const { data, error } = await adminDb
    .from('users')
    .update(updates)
    .eq('id', req.userId)
    .select()
    .maybeSingle();
  if (error) {
    if (isUniqueViolation(error)) return res.status(409).json({ error: HANDLE_TAKEN });
    return res.status(500).json({ error: error.message });
  }
  if (!data) return res.status(404).json({ error: 'User not found' });
  return res.json(data);
});

/**
 * DELETE /api/users/me — self-serve account deletion (an App Store
 * requirement). Refused while the user still has commitments other people
 * are counting on: upcoming shifts they are booked on as a worker, or open /
 * filled future shifts they posted. Everything else cascades from auth.users.
 */
router.delete('/me', requireAuth, async (req, res) => {
  const me = req.userId!;
  const nowIso = new Date().toISOString();
  try {
    const { data: apps, error: aErr } = await adminDb
      .from('applications')
      .select('shift_id')
      .eq('worker_id', me)
      .eq('status', 'accepted');
    if (aErr) throw aErr;
    const bookedIds = (apps ?? []).map((a) => a.shift_id as string);
    if (bookedIds.length) {
      const { data: upcoming, error: uErr } = await adminDb
        .from('shifts')
        .select('id')
        .in('id', bookedIds)
        .in('status', ['open', 'filled'])
        .gt('end_time', nowIso)
        .limit(1);
      if (uErr) throw uErr;
      if (upcoming?.length) {
        throw new HttpError(409, "You're booked on an upcoming shift. Withdraw from it first, then delete your account.");
      }
    }

    const { data: posted, error: pErr } = await adminDb
      .from('shifts')
      .select('id')
      .eq('client_id', me)
      .in('status', ['open', 'filled'])
      .gt('end_time', nowIso)
      .limit(1);
    if (pErr) throw pErr;
    if (posted?.length) {
      throw new HttpError(409, 'You still have an open or filled upcoming shift. Cancel it first, then delete your account.');
    }

    // Push subscriptions must not keep delivering to this device for the next
    // account; they cascade with the profile row, but clear them explicitly
    // in case the cascade is ever loosened.
    await adminDb.from('push_subscriptions').delete().eq('user_id', me);

    const { error } = await adminDb.auth.admin.deleteUser(me);
    if (error) throw error;
    invalidateRole(me);
    return res.json({ ok: true });
  } catch (e) {
    return sendError(res, e);
  }
});

/** GET /api/users/blocks — ids I've blocked (registered before /:id so it is never shadowed) */
router.get('/blocks', requireAuth, async (req, res) => {
  const { data, error } = await adminDb.from('user_blocks').select('blocked_id, created_at').eq('blocker_id', req.userId);
  if (error) return res.status(500).json({ error: error.message });
  return res.json((data ?? []).map((r) => r.blocked_id));
});

/**
 * GET /api/users/by-username/:username — look up a user by their username.
 * Signed-in only: the app always sends a session token (the username
 * availability check during setup runs after sign-in too).
 */
router.get('/by-username/:username', requireAuth, async (req, res) => {
  const { data, error } = await adminDb
    .from('users')
    .select(PUBLIC_COLS)
    .eq('username', String(req.params.username).trim().toLowerCase())
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Not found' });
  try {
    await assertNotBlocked(req.userId!, (data as unknown as { id: string }).id);
  } catch (e) {
    return sendError(res, e);
  }
  return res.json(await publicView(data as unknown as Record<string, unknown>, req.userId));
});

/** GET /api/users/:id — public profile of any user (signed-in only) */
router.get('/:id', requireAuth, async (req, res) => {
  const { data, error } = await adminDb
    .from('users')
    .select(PUBLIC_COLS)
    .eq('id', req.params.id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Not found' });
  try {
    await assertNotBlocked(req.userId!, (data as unknown as { id: string }).id);
  } catch (e) {
    return sendError(res, e);
  }
  return res.json(await publicView(data as unknown as Record<string, unknown>, req.userId));
});

/** POST /api/users/:id/block — block a user (they can no longer message me). */
router.post('/:id/block', requireAuth, async (req, res) => {
  if (req.params.id === req.userId) return res.status(400).json({ error: "You can't block yourself" });
  const { error } = await adminDb
    .from('user_blocks')
    .upsert({ blocker_id: req.userId, blocked_id: req.params.id }, { onConflict: 'blocker_id,blocked_id' });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true, blocked: true });
});

/** DELETE /api/users/:id/block — unblock. */
router.delete('/:id/block', requireAuth, async (req, res) => {
  const { error } = await adminDb
    .from('user_blocks').delete().eq('blocker_id', req.userId).eq('blocked_id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true, blocked: false });
});

export default router;
