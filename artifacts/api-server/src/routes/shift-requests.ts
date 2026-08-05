import { Router } from 'express';
import { pool } from '@workspace/db';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

/** GET /api/shift-requests — my shift requests (worker or client) */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT sr.*, s.title AS shift_title, s.job_type, s.start_time, s.end_time,
              s.location, s.pay_rate, s.company_name,
              w.username AS worker_username, w.photo_url AS worker_photo
       FROM shift_requests sr
       JOIN shifts s ON s.id = sr.shift_id
       JOIN users w ON w.id = sr.worker_id
       WHERE sr.worker_id = $1 OR sr.client_id = $1
       ORDER BY sr.created_at DESC`,
      [req.userId],
    );
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** POST /api/shift-requests — create a shift request (client invites worker) */
router.post('/', requireAuth, requireRole('client', 'staffer'), async (req, res) => {
  const { shift_id, worker_id, message } = req.body as Record<string, string>;
  try {
    const { rows } = await pool.query(
      `INSERT INTO shift_requests (shift_id, client_id, worker_id, message)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (shift_id, worker_id) DO NOTHING
       RETURNING *`,
      [shift_id, req.userId, worker_id, message ?? null],
    );
    if (!rows[0]) return res.status(409).json({ error: 'Request already exists' });
    return res.status(201).json(rows[0]);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** PATCH /api/shift-requests/:id — accept or decline (worker only) */
router.patch('/:id', requireAuth, async (req, res) => {
  const { status } = req.body as { status: 'accepted' | 'declined' };
  if (!['accepted','declined'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE shift_requests SET status = $1
       WHERE id = $2 AND worker_id = $3 AND status = 'pending'
       RETURNING *`,
      [status, req.params.id, req.userId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found, already decided, or not authorized' });
    return res.json(rows[0]);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

export default router;
