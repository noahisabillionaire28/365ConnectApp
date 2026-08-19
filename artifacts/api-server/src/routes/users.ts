import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const PUBLIC_COLS =
  'id, email, role, username, photo_url, bio, job_types, certifications, ' +
  'rating, primary_job_type, secondary_job_types, availability, ' +
  'lat, lng, is_pro, company_name, created_at';

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
  // Users may only self-assign a non-privileged role; admin/staffer are granted out-of-band.
  const safeRole =
    body.role === 'client' ? 'client' : body.role === 'worker' ? 'worker' : undefined;

  // Build the payload with only provided fields so an upsert never nulls out
  // existing values on conflict.
  const optional = [
    'email', 'username', 'photo_url', 'bio', 'job_types', 'certifications',
    'primary_job_type', 'secondary_job_types', 'availability',
    'lat', 'lng', 'is_pro', 'company_name', 'billing_ref', 'status',
  ];
  const payload: Record<string, unknown> = { id: req.userId };
  for (const f of optional) {
    if (body[f] !== undefined && body[f] !== null) payload[f] = body[f];
  }
  if (safeRole) payload.role = safeRole;

  const { data, error } = await adminDb
    .from('users')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

/** PATCH /api/users/me — partial update of current user */
router.patch('/me', requireAuth, async (req, res) => {
  const allowed = [
    'email', 'username', 'photo_url', 'bio', 'job_types', 'certifications',
    'primary_job_type', 'secondary_job_types', 'availability',
    'lat', 'lng', 'company_name',
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
    .single();
  if (error) return res.status(500).json({ error: error.message });
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

export default router;
