import { Router } from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/** GET /api/posts/:userId — posts by a user */
router.get('/:userId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM posts WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.params.userId],
    );
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** POST /api/posts — create post */
router.post('/', requireAuth, async (req, res) => {
  const { image_url, caption } = req.body as Record<string, unknown>;
  try {
    const { rows } = await pool.query(
      `INSERT INTO posts (user_id, image_url, caption) VALUES ($1, $2, $3) RETURNING *`,
      [req.userId, image_url ?? null, caption ?? null],
    );
    return res.status(201).json(rows[0]);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

export default router;
