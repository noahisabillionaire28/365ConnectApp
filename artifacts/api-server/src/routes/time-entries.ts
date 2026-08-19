import { Router } from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/** GET /api/time-entries/:shiftId — time entry for this shift+worker */
router.get('/:shiftId', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM time_entries WHERE shift_id = $1 AND worker_id = $2`,
      [req.params.shiftId, req.userId],
    );
    return res.json(rows[0] ?? null);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** POST /api/time-entries — clock in */
router.post('/', requireAuth, async (req, res) => {
  const { shift_id } = req.body as Record<string, unknown>;
  try {
    const { rows } = await pool.query(
      `INSERT INTO time_entries (shift_id, worker_id)
       VALUES ($1, $2)
       ON CONFLICT (shift_id, worker_id) DO NOTHING
       RETURNING *`,
      [shift_id, req.userId],
    );
    if (!rows[0]) return res.status(409).json({ error: 'Already clocked in' });
    return res.status(201).json(rows[0]);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** PATCH /api/time-entries/:id — clock out / update */
router.patch('/:id', requireAuth, async (req, res) => {
  const { clock_out, break_minutes, total_hours, total_pay, fee } = req.body as Record<string, unknown>;
  try {
    const { rows } = await pool.query(
      `UPDATE time_entries
       SET clock_out = COALESCE($1, clock_out),
           break_minutes = COALESCE($2, break_minutes),
           total_hours = COALESCE($3, total_hours),
           total_pay = COALESCE($4, total_pay),
           fee = COALESCE($5, fee)
       WHERE id = $6 AND worker_id = $7
       RETURNING *`,
      [clock_out ?? null, break_minutes ?? null, total_hours ?? null, total_pay ?? null, fee ?? null, req.params.id, req.userId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    return res.json(rows[0]);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

export default router;
