import { Router } from 'express';
import { pool } from '../lib/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

/** GET /api/shifts — open shifts, optional filters */
router.get('/', async (req, res) => {
  const { job_type, status = 'open', limit = '50', offset = '0' } = req.query as Record<string, string>;
  try {
    const conditions = ['s.status = $1'];
    const values: unknown[] = [status];
    let idx = 2;
    if (job_type) { conditions.push(`(s.job_type = $${idx} OR $${idx} = ANY(s.job_types))`); values.push(job_type); idx++; }
    const { rows } = await pool.query(
      `SELECT s.*, u.username AS client_username, u.company_name AS client_company, u.photo_url AS client_photo_url
       FROM shifts s LEFT JOIN users u ON u.id = s.client_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.created_at DESC LIMIT $${idx} OFFSET $${idx+1}`,
      [...values, parseInt(limit), parseInt(offset)],
    );
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** GET /api/shifts/my — shifts posted by the current user (client) */
router.get('/my', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM shifts WHERE client_id = $1 ORDER BY created_at DESC`,
      [req.userId],
    );
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/shifts/:id — single shift */
router.get('/:id', async (req, res) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(404).json({ error: 'Not found' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT s.*, u.username AS client_username, u.company_name AS client_company,
              u.photo_url AS client_photo_url, u.rating AS client_rating
       FROM shifts s LEFT JOIN users u ON u.id = s.client_id
       WHERE s.id = $1`,
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    return res.json(rows[0]);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** POST /api/shifts — create shift */
router.post('/', requireAuth, requireRole('client', 'staffer'), async (req, res) => {
  const b = req.body as Record<string, unknown>;
  try {
    const { rows } = await pool.query(
      `INSERT INTO shifts (
        client_id, title, description, location, job_type, job_types,
        pay_rate, pay_period, start_time, end_time, spots_available,
        lat, lng, cover_image, company_name, requirements, dress_code,
        dress_code_items, point_of_contact, contact_phone,
        unit_info, parking_notes, special_instructions, repeat_type
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
      RETURNING *`,
      [
        req.userId, b.title, b.description ?? null, b.location ?? null,
        b.job_type, b.job_types ?? '{}', b.pay_rate ?? null,
        b.pay_period ?? 'hr', b.start_time, b.end_time,
        b.spots_available ?? 1, b.lat ?? null, b.lng ?? null,
        b.cover_image ?? null, b.company_name ?? null,
        b.requirements ?? '{}', b.dress_code ?? null,
        b.dress_code_items ?? '{}', b.point_of_contact ?? null,
        b.contact_phone ?? null, b.unit_info ?? null,
        b.parking_notes ?? null, b.special_instructions ?? null,
        b.repeat_type ?? 'once',
      ],
    );
    return res.status(201).json(rows[0]);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** PATCH /api/shifts/:id — update shift (owner only) */
router.patch('/:id', requireAuth, requireRole('client', 'staffer'), async (req, res) => {
  const allowed = [
    'title','description','location','job_type','job_types','pay_rate','pay_period',
    'start_time','end_time','spots_available','status','lat','lng','cover_image',
    'company_name','requirements','dress_code','dress_code_items',
    'point_of_contact','contact_phone','unit_info','parking_notes',
    'special_instructions','repeat_type',
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
  values.push(req.params.id, req.userId);
  try {
    const { rows } = await pool.query(
      `UPDATE shifts SET ${updates.join(', ')}
       WHERE id = $${idx} AND client_id = $${idx+1} RETURNING *`,
      values,
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found or not authorized' });
    return res.json(rows[0]);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

export default router;
