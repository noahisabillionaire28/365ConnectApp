import { Router } from 'express';
import { pool } from '@workspace/db';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/** GET /api/applications?shift_id=&worker_id= */
router.get('/', requireAuth, async (req, res) => {
  const { shift_id, worker_id } = req.query as Record<string, string>;
  try {
    if (shift_id) {
      // Shift owner sees applicants for their shift
      const { rows } = await pool.query(
        `SELECT a.*, u.username, u.photo_url, u.rating, u.job_types,
                u.primary_job_type, u.certifications, u.bio
         FROM applications a JOIN users u ON u.id = a.worker_id
         WHERE a.shift_id = $1
         ORDER BY a.created_at DESC`,
        [shift_id],
      );
      return res.json(rows);
    }
    if (worker_id) {
      const { rows } = await pool.query(
        `SELECT a.*, s.title, s.job_type, s.start_time, s.end_time, s.location,
                s.pay_rate, s.pay_period, s.company_name
         FROM applications a JOIN shifts s ON s.id = a.shift_id
         WHERE a.worker_id = $1
         ORDER BY a.created_at DESC`,
        [worker_id === 'me' ? req.userId : worker_id],
      );
      return res.json(rows);
    }
    // Default: own applications
    const { rows } = await pool.query(
      `SELECT a.*, s.title, s.job_type, s.start_time, s.end_time, s.location,
              s.pay_rate, s.pay_period, s.company_name
       FROM applications a JOIN shifts s ON s.id = a.shift_id
       WHERE a.worker_id = $1
       ORDER BY a.created_at DESC`,
      [req.userId],
    );
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** GET /api/applications/status/:shiftId — did I apply? */
router.get('/status/:shiftId', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT status FROM applications WHERE shift_id = $1 AND worker_id = $2`,
      [req.params.shiftId, req.userId],
    );
    return res.json({ status: rows[0]?.status ?? null });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** GET /api/applications/my-shift-ids — set of shift IDs I've applied to */
router.get('/my-shift-ids', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT shift_id, status FROM applications WHERE worker_id = $1`,
      [req.userId],
    );
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** POST /api/applications — apply to a shift */
router.post('/', requireAuth, async (req, res) => {
  const { shift_id, match_score, message } = req.body as Record<string, unknown>;
  try {
    const { rows } = await pool.query(
      `INSERT INTO applications (shift_id, worker_id, status, match_score, message)
       VALUES ($1, $2, 'pending', $3, $4)
       ON CONFLICT (shift_id, worker_id) DO NOTHING
       RETURNING *`,
      [shift_id, req.userId, match_score ?? null, message ?? null],
    );
    if (!rows[0]) return res.status(409).json({ error: 'Already applied' });
    return res.status(201).json(rows[0]);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** PATCH /api/applications/:id — update status (accept/decline/withdraw) */
router.patch('/:id', requireAuth, async (req, res) => {
  const { status } = req.body as { status: string };
  const validStatuses = ['pending','accepted','rejected','declined','withdrawn'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  try {
    const { rows } = await pool.query(
      `UPDATE applications SET status = $1
       WHERE id = $2
         AND (worker_id = $3 OR shift_id IN (SELECT id FROM shifts WHERE client_id = $3))
       RETURNING *`,
      [status, req.params.id, req.userId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found or not authorized' });
    return res.json(rows[0]);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** POST /api/applications/assign — direct assign from roster (client/staffer) */
router.post('/assign', requireAuth, async (req, res) => {
  const { shift_id, worker_id } = req.body as Record<string, string>;
  try {
    const { rows } = await pool.query(
      `INSERT INTO applications (shift_id, worker_id, status)
       VALUES ($1, $2, 'accepted')
       ON CONFLICT (shift_id, worker_id) DO UPDATE SET status = 'accepted'
       RETURNING *`,
      [shift_id, worker_id],
    );
    return res.status(201).json(rows[0]);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

export default router;
