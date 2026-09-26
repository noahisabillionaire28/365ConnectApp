import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { invalidateRole, getRoleInfo } from '../lib/roleCache.js';
import { requireAuth, requireSession } from '../middleware/auth.js';
import { HttpError, sendError } from '../lib/httpError.js';
import { normalizeUsername, isUniqueViolation, HANDLE_TAKEN } from '../lib/username.js';
import { isBlockedEitherWay } from '../lib/chat.js';

const router = Router();

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

  if (safeRole) {
    // Guard: a self-assigned 'worker' must never DOWNGRADE an already-chosen
    // role (staffer/client/admin). Bootstrap sign-in writes used to send
    // role:'worker' and would reset a real staffer back to worker on conflict.
    if (safeRole === 'worker') {
      if (!existing?.role || existing.role === 'worker') payload.role = 'worker';
      // else: keep their existing non-worker role — do not overwrite.
    } else {
      payload.role = safeRole;
    }
  }

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
