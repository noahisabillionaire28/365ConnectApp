import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { broadcastToUser } from '../lib/sseManager.js';

const router = Router();

type ConversationRow = { id: string; participant_a_id: string | null; participant_b_id: string | null };

/** Load a conversation only if the caller is one of its two participants. */
async function participantConversation(conversationId: string, userId: string): Promise<ConversationRow | null> {
  const { data } = await adminDb
    .from('conversations')
    .select('id, participant_a_id, participant_b_id')
    .eq('id', conversationId)
    .or(`participant_a_id.eq.${userId},participant_b_id.eq.${userId}`)
    .maybeSingle();
  return (data as ConversationRow | null) ?? null;
}

function otherParticipant(conv: ConversationRow, userId: string): string | null {
  return conv.participant_a_id === userId ? conv.participant_b_id : conv.participant_a_id;
}

/** One-line preview of a message for the conversation list. */
function previewOf(m: {
  text?: string | null; image_url?: string | null; video_url?: string | null;
  voice_url?: string | null; deleted_at?: string | null;
}): string {
  if (m.deleted_at) return 'Message deleted';
  if (m.text) return m.text;
  if (m.image_url) return '📷 Photo';
  if (m.video_url) return '🎥 Video';
  if (m.voice_url) return '🎤 Voice message';
  return '';
}

/**
 * Keep conversations.last_message / last_message_at in step with the newest
 * message. (The DB has no trigger for this, so the API owns it.)
 */
async function refreshConversationPreview(conversationId: string): Promise<void> {
  const { data: latest } = await adminDb
    .from('messages')
    .select('text, image_url, video_url, voice_url, deleted_at, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) return;
  await adminDb
    .from('conversations')
    .update({ last_message: previewOf(latest), last_message_at: latest.created_at })
    .eq('id', conversationId);
}

/** GET /api/messages/:conversationId — paginated messages */
router.get('/:conversationId', requireAuth, async (req, res) => {
  const { before, limit = '30' } = req.query as Record<string, string>;
  const conv = await participantConversation(req.params.conversationId, req.userId!);
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
  if (!conversation_id || typeof conversation_id !== 'string') {
    return res.status(400).json({ error: 'conversation_id required' });
  }
  if (!text && !image_url && !video_url && !voice_url) {
    return res.status(400).json({ error: 'Message must have content' });
  }
  const conv = await participantConversation(conversation_id, req.userId!);
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

    await adminDb
      .from('conversations')
      .update({ last_message: previewOf(msg), last_message_at: msg.created_at })
      .eq('id', conversation_id);

    // Push the new message to the other participant via SSE
    const recipientId = otherParticipant(conv, req.userId!);
    if (recipientId) {
      broadcastToUser(recipientId, 'new_message', { conversationId: conversation_id, message: msg });
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

/**
 * PATCH /api/messages/read — mark messages as read.
 * Stamps read_at on the other person's unread messages and tells them, live,
 * which messages were read and when (read receipts).
 */
router.patch('/read', requireAuth, async (req, res) => {
  const { message_ids, conversation_id } = req.body as {
    message_ids?: string[];
    conversation_id?: string;
  };
  try {
    const readAt = new Date().toISOString();
    let q = adminDb
      .from('messages')
      .update({ read_at: readAt })
      .neq('sender_id', req.userId)
      .is('read_at', null);
    if (message_ids?.length) q = q.in('id', message_ids);
    else if (conversation_id) q = q.eq('conversation_id', conversation_id);
    else return res.json({ ok: true, read_at: readAt, message_ids: [] });

    const { data: updated, error } = await q.select('id, conversation_id, sender_id');
    if (error) return res.status(500).json({ error: error.message });

    // Group by (sender, conversation) so each sender gets one receipt event.
    const bySender = new Map<string, { conversationId: string; ids: string[] }>();
    for (const m of updated ?? []) {
      const key = `${m.sender_id}:${m.conversation_id}`;
      const entry = bySender.get(key) ?? { conversationId: m.conversation_id, ids: [] };
      entry.ids.push(m.id);
      bySender.set(key, entry);
    }
    for (const [key, entry] of bySender) {
      const senderId = key.split(':')[0];
      broadcastToUser(senderId, 'messages_read', {
        conversationId: entry.conversationId,
        messageIds: entry.ids,
        readAt,
        readerId: req.userId,
      });
    }
    // The reader's own unread badge changed.
    if (updated?.length) broadcastToUser(req.userId!, 'conversation_update', { conversationId: updated[0].conversation_id });

    return res.json({ ok: true, read_at: readAt, message_ids: (updated ?? []).map((m) => m.id) });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/**
 * DELETE /api/messages/:id — delete one of your own messages.
 * Soft delete: the row stays (so both sides see a "deleted this message"
 * note in place), but its text and attachments are wiped immediately.
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { data: msg } = await adminDb
      .from('messages')
      .select('id, conversation_id, sender_id, deleted_at')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    if (msg.sender_id !== req.userId) return res.status(403).json({ error: 'You can only delete your own messages' });

    const deletedAt = msg.deleted_at ?? new Date().toISOString();
    if (!msg.deleted_at) {
      const { error } = await adminDb
        .from('messages')
        .update({ deleted_at: deletedAt, text: null, image_url: null, video_url: null, voice_url: null })
        .eq('id', msg.id);
      if (error) return res.status(500).json({ error: error.message });
      await refreshConversationPreview(msg.conversation_id);
    }

    const conv = await participantConversation(msg.conversation_id, req.userId!);
    const payload = { conversationId: msg.conversation_id, messageId: msg.id, deletedAt, deletedBy: req.userId };
    const recipients = new Set<string>([req.userId!]);
    if (conv) { const o = otherParticipant(conv, req.userId!); if (o) recipients.add(o); }
    for (const uid of recipients) {
      broadcastToUser(uid, 'message_deleted', payload);
      broadcastToUser(uid, 'conversation_update', { conversationId: msg.conversation_id });
    }
    return res.json({ ok: true, deleted_at: deletedAt });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

export default router;
