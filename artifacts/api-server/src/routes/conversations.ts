import { Router } from 'express';
import { pool } from '@workspace/db';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/** GET /api/conversations — my conversations with user+shift info */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*,
        pa.username AS participant_a_username, pa.photo_url AS participant_a_photo,
        pa.role AS participant_a_role,
        pb.username AS participant_b_username, pb.photo_url AS participant_b_photo,
        pb.role AS participant_b_role,
        s.title AS shift_title
       FROM conversations c
       LEFT JOIN users pa ON pa.id = c.participant_a_id
       LEFT JOIN users pb ON pb.id = c.participant_b_id
       LEFT JOIN shifts s ON s.id = c.shift_id
       WHERE c.participant_a_id = $1 OR c.participant_b_id = $1
       ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC`,
      [req.userId],
    );
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** POST /api/conversations — get or create a DM between two users */
router.post('/', requireAuth, async (req, res) => {
  const { other_user_id, shift_id } = req.body as Record<string, string | undefined>;
  const myId = req.userId!;
  const otherId = other_user_id;
  if (!otherId) return res.status(400).json({ error: 'other_user_id required' });
  try {
    // Try to find existing
    const findQ = shift_id
      ? `SELECT * FROM conversations WHERE shift_id = $1
           AND ((participant_a_id = $2 AND participant_b_id = $3)
             OR (participant_a_id = $3 AND participant_b_id = $2))`
      : `SELECT * FROM conversations WHERE shift_id IS NULL
           AND ((participant_a_id = $1 AND participant_b_id = $2)
             OR (participant_a_id = $2 AND participant_b_id = $1))`;
    const findVals = shift_id ? [shift_id, myId, otherId] : [myId, otherId];
    const { rows: existing } = await pool.query(findQ, findVals);
    if (existing[0]) return res.json(existing[0]);

    // Create new
    const { rows } = await pool.query(
      `INSERT INTO conversations (participant_a_id, participant_b_id, shift_id)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [myId, otherId, shift_id ?? null],
    );
    // If conflict (race), fetch it
    if (!rows[0]) {
      const { rows: r2 } = await pool.query(findQ, findVals);
      return res.json(r2[0]);
    }
    return res.status(201).json(rows[0]);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** GET /api/conversations/:id — single conversation */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*,
        pa.username AS participant_a_username, pa.photo_url AS participant_a_photo,
        pb.username AS participant_b_username, pb.photo_url AS participant_b_photo,
        s.title AS shift_title
       FROM conversations c
       LEFT JOIN users pa ON pa.id = c.participant_a_id
       LEFT JOIN users pb ON pb.id = c.participant_b_id
       LEFT JOIN shifts s ON s.id = c.shift_id
       WHERE c.id = $1 AND (c.participant_a_id = $2 OR c.participant_b_id = $2)`,
      [req.params.id, req.userId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    return res.json(rows[0]);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

export default router;
