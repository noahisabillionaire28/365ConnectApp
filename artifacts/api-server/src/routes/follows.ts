import { Router } from 'express';
import { pool } from '@workspace/db';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/** GET /api/follows/roster — all users I follow (my roster) */
router.get('/roster', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.photo_url, u.role, u.rating, u.job_types,
              u.primary_job_type, u.certifications, u.is_pro, u.company_name,
              f.created_at AS followed_at
       FROM follows f JOIN users u ON u.id = f.following_id
       WHERE f.follower_id = $1
       ORDER BY f.created_at DESC`,
      [req.userId],
    );
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** GET /api/follows/status/:userId — am I following this user? */
router.get('/status/:userId', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2`,
      [req.userId, req.params.userId],
    );
    return res.json({ following: rows.length > 0 });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** GET /api/follows/followers/:userId — who follows this user */
router.get('/followers/:userId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.photo_url, u.role
       FROM follows f JOIN users u ON u.id = f.follower_id
       WHERE f.following_id = $1`,
      [req.params.userId],
    );
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** POST /api/follows — follow a user */
router.post('/', requireAuth, async (req, res) => {
  const { following_id } = req.body as { following_id: string };
  try {
    await pool.query(
      `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.userId, following_id],
    );
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** DELETE /api/follows/:userId — unfollow */
router.delete('/:userId', requireAuth, async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM follows WHERE follower_id = $1 AND following_id = $2`,
      [req.userId, req.params.userId],
    );
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

export default router;
