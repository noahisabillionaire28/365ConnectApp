import { Router } from 'express';
import { pool } from '@workspace/db';
import { requireAuth } from '../middleware/auth.js';
import { broadcastToUser } from '../lib/sseManager.js';

const router = Router();

/** GET /api/notifications — my notifications */
router.get('/', requireAuth, async (req, res) => {
  const { limit = '50' } = req.query as Record<string, string>;
  try {
    const { rows } = await pool.query(
      `SELECT n.*, u.username AS from_username, u.photo_url AS from_photo_url
       FROM notifications n LEFT JOIN users u ON u.id = n.from_user_id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC LIMIT $2`,
      [req.userId, parseInt(limit)],
    );
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** PATCH /api/notifications/:id/read — mark one read */
router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET read_at = NOW(), read = true
       WHERE id = $1 AND user_id = $2 AND read_at IS NULL`,
      [req.params.id, req.userId],
    );
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** PATCH /api/notifications/read-all — mark all read */
router.patch('/read-all', requireAuth, async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET read_at = NOW(), read = true
       WHERE user_id = $1 AND read_at IS NULL`,
      [req.userId],
    );
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/**
 * Internal helper: insert a notification row and push it to the recipient via SSE.
 * Call from any route that needs to notify a user (applications, shift-requests, etc.)
 */
export async function createNotification(params: {
  userId:      string;
  fromUserId?: string | null;
  type:        string;
  title:       string;
  body:        string;
  shiftId?:    string | null;
}): Promise<void> {
  const { userId, fromUserId, type, title, body, shiftId } = params;
  try {
    const { rows } = await pool.query(
      `INSERT INTO notifications (user_id, from_user_id, type, title, body, shift_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, fromUserId ?? null, type, title, body, shiftId ?? null],
    );
    // Push live to the recipient if they're online
    broadcastToUser(userId, 'new_notification', rows[0]);
  } catch (e) {
    // Notifications are non-critical — log but don't throw
    console.error('[createNotification] failed:', e);
  }
}

export default router;
