import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { broadcastToUser } from '../lib/sseManager.js';
import {
  conversationForUser, participantsOf, previewOf, refreshConversationPreview,
  enrichMessages, fanOutMessage, isBlockedEitherWay, flushScheduledMessages,
  type ConversationRow, type MessageRow,
} from '../lib/chat.js';

const router = Router();

const ALLOWED_REACTIONS = ['👍', '❤️', '😂', '‼️', '❓', '🙌', '👏', '🔥', '✅', '👀'];

/**
 * GET /api/messages/:conversationId — paginated messages (chronological).
 *   ?before=<iso>   older than this timestamp (infinite scroll)
 *   ?q=<text>       search within the thread
 *   ?limit=30
 */
router.get('/:conversationId', requireAuth, async (req, res) => {
  const { before, limit = '30', q } = req.query as Record<string, string>;
  const conv = await conversationForUser(String(req.params.conversationId), req.userId!);
  if (!conv) return res.status(403).json({ error: 'Not a participant' });
  void flushScheduledMessages().catch(() => {});

  try {
    let query = adminDb
      .from('messages')
      .select('*')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: false })
      .limit(Math.min(100, parseInt(limit) || 30));
    if (before) query = query.lt('created_at', before);
    if (q?.trim()) query = query.ilike('text', `%${q.trim().replace(/[%_]/g, '')}%`);
    const { data: msgs, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    const rows = await enrichMessages((msgs ?? []) as MessageRow[]);
    return res.json(rows.reverse());
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** GET /api/messages/:conversationId/media — photos and videos shared in a thread (gallery). */
router.get('/:conversationId/media', requireAuth, async (req, res) => {
  const conv = await conversationForUser(String(req.params.conversationId), req.userId!);
  if (!conv) return res.status(403).json({ error: 'Not a participant' });
  const { data, error } = await adminDb
    .from('messages')
    .select('id, sender_id, image_url, video_url, file_url, file_name, file_size, created_at')
    .eq('conversation_id', conv.id)
    .is('deleted_at', null)
    .or('image_url.not.is.null,video_url.not.is.null,file_url.not.is.null')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data ?? []);
});

/** GET /api/messages/:conversationId/readers — per-member read positions (group "Read by"). */
router.get('/:conversationId/readers', requireAuth, async (req, res) => {
  const conv = await conversationForUser(String(req.params.conversationId), req.userId!);
  if (!conv) return res.status(403).json({ error: 'Not a participant' });
  const { data } = await adminDb
    .from('conversation_reads')
    .select('user_id, last_read_at')
    .eq('conversation_id', conv.id);
  return res.json(data ?? []);
});

/** POST /api/messages — send a message */
router.post('/', requireAuth, async (req, res) => {
  const b = req.body as Record<string, unknown>;
  const conversation_id = typeof b.conversation_id === 'string' ? b.conversation_id : null;
  if (!conversation_id) return res.status(400).json({ error: 'conversation_id required' });
  const text       = typeof b.text === 'string' && b.text.trim() ? b.text.trim().slice(0, 4000) : null;
  const image_url  = typeof b.image_url === 'string' ? b.image_url : null;
  const video_url  = typeof b.video_url === 'string' ? b.video_url : null;
  const voice_url  = typeof b.voice_url === 'string' ? b.voice_url : null;
  const file_url   = typeof b.file_url === 'string' ? b.file_url : null;
  const file_name  = typeof b.file_name === 'string' ? b.file_name.slice(0, 200) : null;
  const file_size  = typeof b.file_size === 'number' ? Math.round(b.file_size) : null;
  const shift_card_id = typeof b.shift_card_id === 'string' ? b.shift_card_id : null;
  const reply_to_id   = typeof b.reply_to_id === 'string' ? b.reply_to_id : null;
  const client_key    = typeof b.client_key === 'string' ? b.client_key.slice(0, 80) : null;
  if (!text && !image_url && !video_url && !voice_url && !file_url && !shift_card_id) {
    return res.status(400).json({ error: 'Message must have content' });
  }

  const conv = await conversationForUser(conversation_id, req.userId!);
  if (!conv) return res.status(403).json({ error: 'Not a participant' });
  if (!conv.is_group) {
    const other = participantsOf(conv).find((id) => id !== req.userId);
    if (other && (await isBlockedEitherWay(req.userId!, other))) {
      return res.status(403).json({ error: "You can't message this person." });
    }
  }
  if (reply_to_id) {
    const { data: parent } = await adminDb.from('messages').select('conversation_id').eq('id', reply_to_id).maybeSingle();
    if (!parent || parent.conversation_id !== conv.id) return res.status(400).json({ error: 'Invalid reply target' });
  }

  try {
    // Idempotent retries: the same client_key from the same sender returns the original.
    if (client_key) {
      const { data: dup } = await adminDb
        .from('messages').select('*').eq('sender_id', req.userId).eq('client_key', client_key).maybeSingle();
      if (dup) { const [row] = await enrichMessages([dup as MessageRow]); return res.status(200).json(row); }
    }

    const { data: msg, error } = await adminDb
      .from('messages')
      .insert({
        conversation_id, sender_id: req.userId, text, image_url, video_url, voice_url,
        file_url, file_name, file_size, shift_card_id, reply_to_id, client_key,
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    let senderName: string | null = null;
    if (conv.is_group) {
      const { data: u } = await adminDb.from('users').select('username').eq('id', req.userId).maybeSingle();
      senderName = u?.username ? `@${u.username}` : null;
    }
    await adminDb
      .from('conversations')
      .update({ last_message: previewOf(msg as MessageRow, senderName), last_message_at: msg.created_at })
      .eq('id', conversation_id);

    const [enriched] = await enrichMessages([msg as MessageRow]);
    await fanOutMessage(conv, enriched, req.userId!);
    return res.status(201).json(enriched);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/**
 * PATCH /api/messages/read — mark a thread (or specific messages) as read.
 * DMs: stamps read_at per message and sends the sender a live receipt.
 * Everyone: records my read position for unread counts and group "Read by".
 */
router.patch('/read', requireAuth, async (req, res) => {
  const { message_ids, conversation_id } = req.body as { message_ids?: string[]; conversation_id?: string };
  try {
    const readAt = new Date().toISOString();
    let convId = conversation_id ?? null;

    if (!message_ids?.length && !convId) return res.json({ ok: true, read_at: readAt, message_ids: [] });
    const base = adminDb.from('messages').update({ read_at: readAt }).neq('sender_id', req.userId).is('read_at', null);
    const { data: updated, error } = message_ids?.length
      ? await base.in('id', message_ids).select('id, conversation_id, sender_id')
      : await base.eq('conversation_id', convId!).select('id, conversation_id, sender_id');
    if (error) return res.status(500).json({ error: error.message });
    if (!convId && updated?.length) convId = updated[0].conversation_id;
    if (!convId && message_ids?.length) {
      const { data: any1 } = await adminDb.from('messages').select('conversation_id').eq('id', message_ids[0]).maybeSingle();
      convId = any1?.conversation_id ?? null;
    }

    let conv: ConversationRow | null = null;
    if (convId) {
      conv = await conversationForUser(convId, req.userId!);
      if (conv) {
        await adminDb.from('conversation_reads').upsert(
          { conversation_id: convId, user_id: req.userId!, last_read_at: readAt },
          { onConflict: 'conversation_id,user_id' },
        );
      }
    }

    // Per-sender receipts (DM read_at) …
    const bySender = new Map<string, { conversationId: string; ids: string[] }>();
    for (const m of updated ?? []) {
      const key = `${m.sender_id}:${m.conversation_id}`;
      const entry = bySender.get(key) ?? { conversationId: m.conversation_id, ids: [] };
      entry.ids.push(m.id);
      bySender.set(key, entry);
    }
    for (const [key, entry] of bySender) {
      broadcastToUser(key.split(':')[0], 'messages_read', {
        conversationId: entry.conversationId, messageIds: entry.ids, readAt, readerId: req.userId,
      });
    }
    // … and a read-position update for group members.
    if (conv?.is_group) {
      for (const uid of participantsOf(conv)) {
        if (uid !== req.userId) broadcastToUser(uid, 'reader_update', { conversationId: conv.id, userId: req.userId, lastReadAt: readAt });
      }
    }
    if (convId) broadcastToUser(req.userId!, 'conversation_update', { conversationId: convId });

    return res.json({ ok: true, read_at: readAt, message_ids: (updated ?? []).map((m) => m.id) });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** POST /api/messages/schedule — send a text later. */
router.post('/schedule', requireAuth, async (req, res) => {
  const { conversation_id, text, send_at } = req.body as Record<string, unknown>;
  if (typeof conversation_id !== 'string' || typeof text !== 'string' || !text.trim() || typeof send_at !== 'string') {
    return res.status(400).json({ error: 'conversation_id, text and send_at are required' });
  }
  const when = Date.parse(send_at);
  if (!Number.isFinite(when) || when < Date.now() + 30_000) return res.status(400).json({ error: 'Pick a time in the future' });
  const conv = await conversationForUser(conversation_id, req.userId!);
  if (!conv) return res.status(403).json({ error: 'Not a participant' });
  const { data, error } = await adminDb
    .from('scheduled_messages')
    .insert({ conversation_id, sender_id: req.userId, text: text.trim().slice(0, 4000), send_at: new Date(when).toISOString() })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json(data);
});

/** GET /api/messages/schedule/:conversationId — my pending scheduled messages in a thread. */
router.get('/schedule/:conversationId', requireAuth, async (req, res) => {
  const { data } = await adminDb
    .from('scheduled_messages')
    .select('*')
    .eq('conversation_id', String(req.params.conversationId))
    .eq('sender_id', req.userId)
    .is('sent_message_id', null)
    .order('send_at', { ascending: true });
  return res.json(data ?? []);
});

/** DELETE /api/messages/schedule/:id — cancel a scheduled message. */
router.delete('/schedule/:id', requireAuth, async (req, res) => {
  const { error } = await adminDb
    .from('scheduled_messages').delete().eq('id', String(req.params.id)).eq('sender_id', req.userId).is('sent_message_id', null);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

/** POST /api/messages/flush-scheduled — cron / manual delivery of due scheduled messages. */
router.post('/flush-scheduled', async (_req, res) => {
  const n = await flushScheduledMessages(100);
  return res.json({ ok: true, sent: n });
});
router.get('/flush-scheduled', async (_req, res) => {
  const n = await flushScheduledMessages(100);
  return res.json({ ok: true, sent: n });
});

/** PATCH /api/messages/:id — edit the text of one of my messages. */
router.patch('/:id', requireAuth, async (req, res) => {
  const { text } = req.body as { text?: string };
  if (typeof text !== 'string' || !text.trim()) return res.status(400).json({ error: 'Text is required' });
  const { data: msg } = await adminDb.from('messages').select('*').eq('id', String(req.params.id)).maybeSingle();
  if (!msg) return res.status(404).json({ error: 'Message not found' });
  if (msg.sender_id !== req.userId) return res.status(403).json({ error: 'You can only edit your own messages' });
  if (msg.deleted_at) return res.status(400).json({ error: 'This message was deleted' });
  if (msg.kind === 'system') return res.status(400).json({ error: 'Cannot edit this message' });

  const editedAt = new Date().toISOString();
  const { data: updated, error } = await adminDb
    .from('messages')
    .update({ text: text.trim().slice(0, 4000), edited_at: editedAt })
    .eq('id', msg.id)
    .select().single();
  if (error) return res.status(500).json({ error: error.message });

  const conv = await conversationForUser(msg.conversation_id, req.userId!);
  if (conv) {
    await refreshConversationPreview(conv.id, conv);
    const [enriched] = await enrichMessages([updated as MessageRow]);
    for (const uid of participantsOf(conv)) {
      broadcastToUser(uid, 'message_updated', { conversationId: conv.id, message: enriched });
      broadcastToUser(uid, 'conversation_update', { conversationId: conv.id });
    }
  }
  return res.json(updated);
});

/** POST /api/messages/:id/react { emoji } — toggle my reaction on a message. */
router.post('/:id/react', requireAuth, async (req, res) => {
  const { emoji } = req.body as { emoji?: string };
  if (!emoji || !ALLOWED_REACTIONS.includes(emoji)) return res.status(400).json({ error: 'Unsupported reaction' });
  const { data: msg } = await adminDb.from('messages').select('id, conversation_id, reactions, deleted_at').eq('id', String(req.params.id)).maybeSingle();
  if (!msg) return res.status(404).json({ error: 'Message not found' });
  if (msg.deleted_at) return res.status(400).json({ error: 'This message was deleted' });
  const conv = await conversationForUser(msg.conversation_id, req.userId!);
  if (!conv) return res.status(403).json({ error: 'Not a participant' });

  const reactions: Record<string, string[]> = { ...((msg.reactions as Record<string, string[]>) ?? {}) };
  const me = req.userId!;
  const had = (reactions[emoji] ?? []).includes(me);
  // iMessage-style: one reaction per person — swap if they pick a different one.
  for (const k of Object.keys(reactions)) {
    reactions[k] = (reactions[k] ?? []).filter((id) => id !== me);
    if (!reactions[k].length) delete reactions[k];
  }
  if (!had) reactions[emoji] = [...(reactions[emoji] ?? []), me];

  const { error } = await adminDb.from('messages').update({ reactions }).eq('id', msg.id);
  if (error) return res.status(500).json({ error: error.message });
  for (const uid of participantsOf(conv)) {
    broadcastToUser(uid, 'message_reaction', { conversationId: conv.id, messageId: msg.id, reactions });
  }
  return res.json({ ok: true, reactions });
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
      .eq('id', String(req.params.id))
      .maybeSingle();
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    if (msg.sender_id !== req.userId) return res.status(403).json({ error: 'You can only delete your own messages' });

    const deletedAt = msg.deleted_at ?? new Date().toISOString();
    const conv = await conversationForUser(msg.conversation_id, req.userId!);
    if (!msg.deleted_at) {
      const { error } = await adminDb
        .from('messages')
        .update({ deleted_at: deletedAt, text: null, image_url: null, video_url: null, voice_url: null, file_url: null, file_name: null, shift_card_id: null, reactions: {} })
        .eq('id', msg.id);
      if (error) return res.status(500).json({ error: error.message });
      await refreshConversationPreview(msg.conversation_id, conv);
    }

    const payload = { conversationId: msg.conversation_id, messageId: msg.id, deletedAt, deletedBy: req.userId };
    const recipients = new Set<string>([req.userId!, ...(conv ? participantsOf(conv) : [])]);
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
