import { Router } from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/** GET /api/reviews/:userId — reviews for a user */
router.get('/:userId', async (req, res) => {
  try {
    const viewerRole = req.userId
      ? (await pool.query('SELECT role FROM users WHERE id = $1', [req.userId])).rows[0]?.role
      : null;
    const isClientOrStaffer = viewerRole === 'client' || viewerRole === 'staffer';

    const { rows } = await pool.query(
      `SELECT r.id, r.shift_id, r.reviewer_id, r.reviewee_id, r.rating, r.comment,
              r.positive_tags,
              ${isClientOrStaffer ? 'r.negative_tags' : "'{}'::text[] AS negative_tags"},
              r.created_at,
              u.username AS reviewer_username, u.photo_url AS reviewer_photo
       FROM reviews r LEFT JOIN users u ON u.id = r.reviewer_id
       WHERE r.reviewee_id = $1
       ORDER BY r.created_at DESC`,
      [req.params.userId],
    );
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** POST /api/reviews — create review */
router.post('/', requireAuth, async (req, res) => {
  const { shift_id, reviewee_id, rating, comment, positive_tags, negative_tags } = req.body as Record<string, unknown>;
  try {
    const { rows } = await pool.query(
      `INSERT INTO reviews (shift_id, reviewer_id, reviewee_id, rating, comment, positive_tags, negative_tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (shift_id, reviewer_id, reviewee_id) DO NOTHING
       RETURNING *`,
      [shift_id, req.userId, reviewee_id, rating, comment ?? null, positive_tags ?? '{}', negative_tags ?? '{}'],
    );
    if (!rows[0]) return res.status(409).json({ error: 'Review already submitted' });
    return res.status(201).json(rows[0]);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

export default router;
