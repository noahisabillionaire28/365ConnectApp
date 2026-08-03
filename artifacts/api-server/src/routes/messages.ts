import { Router } from 'express';
import { pool } from '@workspace/db';
import { requireAuth } from '../middleware/auth.js';
import { broadcastToUser } from '../lib/sseManager.js';

const router = Router();

/** GET /api/messages/:conversationId — paginated messages */
router.get('/:conversationId', requireAuth, async (req, res) => {
  const { before, limit = '30' } = req.query as Record<string, string>;
  // Verify participation
  const { rows: conv } = await pool.query(
    `SELECT id, participant_a_id, participant_b_id FROM conversations
     WHERE id = $1 AND (participant_a_id = $2 OR participant_b_id = $2)`,
    [req.params.conversationId, req.userId],
  );
  if (!conv[0]) return res.status(403).json({ error: 'Not a participant' });

  try {
    const conditions = ['m.conversation_id = $1'];
    const values: unknown[] = [req.params.conversationId];
    let idx = 2;
    if (before) {
      conditions.push(`m.created_at < $${idx++}`);
      values.push(before);
    }
    const { rows } = await pool.query(
      `SELECT m.*, u.username AS sender_username, u.photo_url AS sender_photo
       FROM messages m LEFT JOIN users u ON u.id = m.sender_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY m.created_at DESC LIMIT $${idx}`,
      [...values, parseInt(limit)],
    );
    return res.json(rows.reverse()); // return in chronological order
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** POST /api/messages — send a message */
router.post('/', requireAuth, async (req, res) => {
  const { conversation_id, text, image_url, video_url, voice_url } = req.body as Record<string, unknown>;
  if (!conversation_id) return res.status(400).json({ error: 'conversation_id required' });
  if (!text && !image_url && !video_url && !voice_url) {
    return res.status(400).json({ error: 'Message must have content' });
  }
  // Verify participation and get the other participant
  const { rows: conv } = await pool.query(
    `SELECT id, participant_a_id, participant_b_id FROM conversations
     WHERE id = $1 AND (participant_a_id = $2 OR participant_b_id = $2)`,
    [conversation_id, req.userId],
  );
  if (!conv[0]) return res.status(403).json({ error: 'Not a participant' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, text, image_url, video_url, voice_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [conversation_id, req.userId, text ?? null, image_url ?? null, video_url ?? null, voice_url ?? null],
    );
    const msg = rows[0];

    // Push the new message to the other participant via SSE
    const c = conv[0];
    const recipientId = c.participant_a_id === req.userId ? c.participant_b_id : c.participant_a_id;
    if (recipientId) {
      broadcastToUser(recipientId, 'new_message', {
        conversationId: conversation_id,
        message: msg,
      });
      // Also tell the recipient's conversation list to refresh
      broadcastToUser(recipientId, 'conversation_update', { conversationId: conversation_id });
    }
    // Also update the sender's own conversation list (last_message sort)
    broadcastToUser(req.userId!, 'conversation_update', { conversationId: conversation_id });

    return res.status(201).json(msg);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** PATCH /api/messages/read — mark messages as read */
router.patch('/read', requireAuth, async (req, res) => {
  const { message_ids, conversation_id } = req.body as {
    message_ids?: string[];
    conversation_id?: string;
  };
  try {
    if (message_ids?.length) {
      await pool.query(
        `UPDATE messages SET read_at = NOW()
         WHERE id = ANY($1::uuid[]) AND sender_id <> $2 AND read_at IS NULL`,
        [message_ids, req.userId],
      );
    } else if (conversation_id) {
      await pool.query(
        `UPDATE messages SET read_at = NOW()
         WHERE conversation_id = $1 AND sender_id <> $2 AND read_at IS NULL`,
        [conversation_id, req.userId],
      );
    }
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

export default router;
