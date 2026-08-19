import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { broadcastToUser } from '../lib/sseManager.js';

const router = Router();

/** GET /api/messages/:conversationId — paginated messages */
router.get('/:conversationId', requireAuth, async (req, res) => {
  const { before, limit = '30' } = req.query as Record<string, string>;
  // Verify participation
  const { data: conv } = await adminDb
    .from('conversations')
    .select('id, participant_a_id, participant_b_id')
    .eq('id', req.params.conversationId)
    .or(`participant_a_id.eq.${req.userId},participant_b_id.eq.${req.userId}`)
    .maybeSingle();
  if (!conv) return res.status(403).json({ error: 'Not a participant' });

  try {
    let q = adminDb
      .from('messages')
      .select('*')
      .eq('conversation_id', req.params.conversationId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));
    if (before) q = q.lt('created_at', before);
    const { data: msgs, error } = await q;
    if (error) return res.status(500).json({ error: error.message });

    // Flatten the sender's user row onto each message (LEFT JOIN users) via a
    // second query + merge to keep the flat sender_username / sender_photo shape.
    const senderIds = [
      ...new Set((msgs ?? []).map((m) => m.sender_id).filter(Boolean)),
    ] as string[];
    const senderMap = new Map<string, any>();
    if (senderIds.length) {
      const { data: senders } = await adminDb
        .from('users')
        .select('id, username, photo_url')
        .in('id', senderIds);
      for (const u of senders ?? []) senderMap.set(u.id, u);
    }
    const rows = (msgs ?? []).map((m) => {
      const u = m.sender_id ? senderMap.get(m.sender_id) ?? null : null;
      return {
        ...m,
        sender_username: u?.username ?? null,
        sender_photo: u?.photo_url ?? null,
      };
    });
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
  const { data: conv } = await adminDb
    .from('conversations')
    .select('id, participant_a_id, participant_b_id')
    .eq('id', conversation_id as string)
    .or(`participant_a_id.eq.${req.userId},participant_b_id.eq.${req.userId}`)
    .maybeSingle();
  if (!conv) return res.status(403).json({ error: 'Not a participant' });

  try {
    const { data: msg, error } = await adminDb
      .from('messages')
      .insert({
        conversation_id,
        sender_id: req.userId,
        text: text ?? null,
        image_url: image_url ?? null,
        video_url: video_url ?? null,
        voice_url: voice_url ?? null,
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    // Push the new message to the other participant via SSE
    const c = conv;
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
      const { error } = await adminDb
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', message_ids)
        .neq('sender_id', req.userId)
        .is('read_at', null);
      if (error) return res.status(500).json({ error: error.message });
    } else if (conversation_id) {
      const { error } = await adminDb
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversation_id)
        .neq('sender_id', req.userId)
        .is('read_at', null);
      if (error) return res.status(500).json({ error: error.message });
    }
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

export default router;
