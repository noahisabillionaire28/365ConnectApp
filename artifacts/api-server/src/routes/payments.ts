import { Router } from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/** GET /api/payments — my payments */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, s.title AS shift_title, s.company_name
       FROM payments p LEFT JOIN shifts s ON s.id = p.shift_id
       WHERE p.worker_id = $1
       ORDER BY p.created_at DESC`,
      [req.userId],
    );
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** POST /api/payments — record a payment */
router.post('/', requireAuth, async (req, res) => {
  const { shift_id, amount, fee, net_amount, status, payment_type } = req.body as Record<string, unknown>;
  try {
    const { rows } = await pool.query(
      `INSERT INTO payments (shift_id, worker_id, amount, fee, net_amount, status, payment_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [shift_id ?? null, req.userId, amount, fee ?? 0, net_amount, status ?? 'completed', payment_type ?? 'shift_payment'],
    );
    return res.status(201).json(rows[0]);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

export default router;
