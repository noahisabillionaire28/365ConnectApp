import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { invalidateRole } from '../lib/roleCache.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Note: notification preferences are private and read via GET /me (select *),
// so they are intentionally NOT part of the public column set.
const PUBLIC_COLS =
  'id, email, role, username, photo_url, bio, job_types, certifications, ' +
  'rating, primary_job_type, secondary_job_types, availability, ' +
  'lat, lng, is_pro, company_name, hourly_rate, created_at';

/** GET /api/users/me — current user's full profile */
router.get('/me', requireAuth, async (req, res) => {
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
  // existing values on conflict.
  const optional = [
    'email', 'username', 'photo_url', 'bio', 'job_types', 'certifications',
    'primary_job_type', 'secondary_job_types', 'availability',
    'lat', 'lng', 'is_pro', 'company_name', 'status', 'hourly_rate',
  ];
  const payload: Record<string, unknown> = { id: req.userId };
  for (const f of optional) {
    if (body[f] !== undefined && body[f] !== null) payload[f] = body[f];
  }

  const { data: existing } = await adminDb
    .from('users').select('role, username').eq('id', req.userId).maybeSingle();

  // An auto-generated username (sent at role select) must never replace one
  // the user chose during setup.
  if (payload.username !== undefined && existing?.username) delete payload.username;

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
  if (error) return res.status(500).json({ error: error.message });
  if (payload.role !== undefined) invalidateRole(req.userId!);
  return res.json(data);
});

/** PATCH /api/users/me — partial update of current user */
router.patch('/me', requireAuth, async (req, res) => {
  const allowed = [
    'email', 'username', 'photo_url', 'bio', 'job_types', 'certifications',
    'primary_job_type', 'secondary_job_types', 'availability',
    'lat', 'lng', 'company_name', 'is_pro', 'is_available',
    'in_app_notifications', 'email_notifications', 'hourly_rate',
    'quick_replies',
  ];
  const body = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No valid fields' });

  const { data, error } = await adminDb
    .from('users')
    .update(updates)
    .eq('id', req.userId)
    .select()
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'User not found' });
  return res.json(data);
});

/** GET /api/users/by-username/:username — look up a user by their username */
router.get('/by-username/:username', async (req, res) => {
  const { data, error } = await adminDb
    .from('users')
    .select(PUBLIC_COLS)
    .eq('username', req.params.username)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Not found' });
  return res.json(data);
});

/** GET /api/users/:id — public profile of any user */
router.get('/:id', async (req, res) => {
  const { data, error } = await adminDb
    .from('users')
    .select(PUBLIC_COLS)
    .eq('id', req.params.id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Not found' });
  return res.json(data);
});

/** GET /api/users/blocks — ids I've blocked */
router.get('/blocks', requireAuth, async (req, res) => {
  const { data, error } = await adminDb.from('user_blocks').select('blocked_id, created_at').eq('blocker_id', req.userId);
  if (error) return res.status(500).json({ error: error.message });
  return res.json((data ?? []).map((r) => r.blocked_id));
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
