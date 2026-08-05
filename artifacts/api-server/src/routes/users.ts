import { Router } from 'express';
import { pool } from '@workspace/db';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/** GET /api/users/me — current user's full profile */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    return res.json(rows[0]);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** POST /api/users — upsert user (called after sign-up / profile setup) */
router.post('/', requireAuth, async (req, res) => {
  const {
    email, role, username, photo_url, bio, job_types, certifications,
    primary_job_type, secondary_job_types, availability,
    lat, lng, is_pro, company_name, billing_ref, status,
  } = req.body as Record<string, unknown>;
  // Users may only self-assign a non-privileged role; admin/staffer are granted out-of-band.
  const safeRole = role === 'client' ? 'client' : 'worker';
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (
         id, email, role, username, photo_url, bio, job_types, certifications,
         primary_job_type, secondary_job_types, availability,
         lat, lng, is_pro, company_name, billing_ref, status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (id) DO UPDATE SET
         email = COALESCE(EXCLUDED.email, users.email),
         role = COALESCE(EXCLUDED.role, users.role),
         username = COALESCE(EXCLUDED.username, users.username),
         photo_url = COALESCE(EXCLUDED.photo_url, users.photo_url),
         bio = COALESCE(EXCLUDED.bio, users.bio),
         job_types = COALESCE(EXCLUDED.job_types, users.job_types),
         certifications = COALESCE(EXCLUDED.certifications, users.certifications),
         primary_job_type = COALESCE(EXCLUDED.primary_job_type, users.primary_job_type),
         secondary_job_types = COALESCE(EXCLUDED.secondary_job_types, users.secondary_job_types),
         availability = COALESCE(EXCLUDED.availability, users.availability),
         lat = COALESCE(EXCLUDED.lat, users.lat),
         lng = COALESCE(EXCLUDED.lng, users.lng),
         is_pro = COALESCE(EXCLUDED.is_pro, users.is_pro),
         company_name = COALESCE(EXCLUDED.company_name, users.company_name),
         billing_ref = COALESCE(EXCLUDED.billing_ref, users.billing_ref),
         status = COALESCE(EXCLUDED.status, users.status)
       RETURNING *`,
      [
        req.userId, email ?? null, safeRole, username ?? null,
        photo_url ?? null, bio ?? null,
        job_types ?? '{}', certifications ?? '{}',
        primary_job_type ?? null, secondary_job_types ?? '{}',
        availability ?? null, lat ?? null, lng ?? null,
        is_pro ?? false, company_name ?? null, billing_ref ?? null, status ?? 'active',
      ],
    );
    return res.json(rows[0]);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** PATCH /api/users/me — partial update of current user */
router.patch('/me', requireAuth, async (req, res) => {
  const allowed = [
    'email','username','photo_url','bio','job_types','certifications',
    'primary_job_type','secondary_job_types','availability',
    'lat','lng','company_name',
  ];
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  for (const key of allowed) {
    if (key in req.body) {
      updates.push(`${key} = $${idx++}`);
      values.push((req.body as Record<string,unknown>)[key]);
    }
  }
  if (!updates.length) return res.status(400).json({ error: 'No valid fields' });
  values.push(req.userId);
  try {
    const { rows } = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );
    return res.json(rows[0]);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** GET /api/users/by-username/:username — look up a user by their username */
router.get('/by-username/:username', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, role, username, photo_url, bio, job_types, certifications,
              rating, primary_job_type, secondary_job_types, availability,
              lat, lng, is_pro, company_name, created_at
       FROM users WHERE username = $1`,
      [req.params.username],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    return res.json(rows[0]);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** GET /api/users/:id — public profile of any user */
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, role, username, photo_url, bio, job_types, certifications,
              rating, primary_job_type, secondary_job_types, availability,
              lat, lng, is_pro, company_name, created_at
       FROM users WHERE id = $1`,
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    return res.json(rows[0]);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

export default router;
