import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { broadcastToUser } from '../lib/sseManager.js';
import {
  memberFilter, participantsOf, conversationForUser, ensureShiftGroupChat,
  isBlockedEitherWay, blockedIdsFor, flushScheduledMessages, notifyConversationUpdate,
  type ConversationRow,
} from '../lib/chat.js';

const router = Router();

type Member = { id: string; username: string | null; photo_url: string | null; role: string | null };

/**
 * Attach the people and shift behind each conversation. DMs keep the flat
 * participant_a_* / participant_b_* fields the app already reads; every
 * conversation also gets a `members` list (used for groups).
 */
async function enrichConversations(convs: ConversationRow[], viewerId: string): Promise<Record<string, unknown>[]> {
  const userIds = new Set<string>();
  const shiftIds = new Set<string>();
  for (const c of convs) {
    for (const id of participantsOf(c)) userIds.add(id);
    if (c.shift_id) shiftIds.add(c.shift_id);
  }
  const userMap = new Map<string, Member>();
  if (userIds.size) {
    const { data: users } = await adminDb.from('users').select('id, username, photo_url, role').in('id', [...userIds]);
    for (const u of users ?? []) userMap.set(u.id, u as Member);
  }
  const shiftMap = new Map<string, any>();
  if (shiftIds.size) {
    const { data: shifts } = await adminDb.from('shifts').select('id, title, start_time, end_time, status, client_id').in('id', [...shiftIds]);
    for (const s of shifts ?? []) shiftMap.set(s.id, s);
  }

  return convs.map((c) => {
    const pa = c.participant_a_id ? userMap.get(c.participant_a_id) ?? null : null;
    const pb = c.participant_b_id ? userMap.get(c.participant_b_id) ?? null : null;
    const s = c.shift_id ? shiftMap.get(c.shift_id) ?? null : null;
    const members: Member[] = participantsOf(c).map((id) => userMap.get(id) ?? { id, username: null, photo_url: null, role: null });
    return {
      ...c,
      participant_a_username: pa?.username ?? null,
      participant_a_photo: pa?.photo_url ?? null,
      participant_a_role: pa?.role ?? null,
      participant_b_username: pb?.username ?? null,
      participant_b_photo: pb?.photo_url ?? null,
      participant_b_role: pb?.role ?? null,
      shift_title: s?.title ?? null,
      shift_start: s?.start_time ?? null,
      shift_end: s?.end_time ?? null,
      shift_status: s?.status ?? null,
      shift_owner_id: s?.client_id ?? null,
      members,
      is_muted: (c.muted_by ?? []).includes(viewerId),
      is_pinned: (c.pinned_by ?? []).includes(viewerId),
      is_archived: (c.archived_by ?? []).includes(viewerId),
    };
  });
}

/** Unread counts per conversation, from each member's read position. */
async function unreadCounts(convs: ConversationRow[], viewerId: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!convs.length) return out;
  const ids = convs.map((c) => c.id);
  const { data: reads } = await adminDb
    .from('conversation_reads').select('conversation_id, last_read_at').eq('user_id', viewerId).in('conversation_id', ids);
  const readMap = new Map<string, string>((reads ?? []).map((r) => [r.conversation_id, r.last_read_at]));
  // One query for all threads; count in JS (small volumes per user).
  const { data: msgs } = await adminDb
    .from('messages')
    .select('conversation_id, created_at, kind')
    .in('conversation_id', ids)
    .neq('sender_id', viewerId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(2000);
  for (const m of msgs ?? []) {
    if (m.kind === 'system') continue;
    const since = readMap.get(m.conversation_id);
    if (!since || m.created_at > since) out.set(m.conversation_id, (out.get(m.conversation_id) ?? 0) + 1);
  }
  return out;
}

/** GET /api/conversations — my conversations (DMs + shift group chats). ?archived=1 for the archive. */
router.get('/', requireAuth, async (req, res) => {
  try {
    void flushScheduledMessages().catch(() => {});
    const { data, error } = await adminDb
      .from('conversations')
      .select('*')
      .or(memberFilter(req.userId!))
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    const me = req.userId!;
    const blocked = await blockedIdsFor(me);
    const wantArchived = req.query.archived === '1';
    const convs = ((data ?? []) as ConversationRow[]).filter((c) => {
      if ((c.deleted_by ?? []).includes(me)) return false;
      const archived = (c.archived_by ?? []).includes(me);
      if (wantArchived !== archived) return false;
      if (!c.is_group) {
        const other = participantsOf(c).find((id) => id !== me);
        if (other && blocked.has(other)) return false;
      }
      return true;
    });

    const [rows, unread] = await Promise.all([enrichConversations(convs, me), unreadCounts(convs, me)]);
    const withUnread = rows.map((c) => ({ ...c, unread_count: unread.get(c.id as string) ?? 0 })) as Array<Record<string, unknown> & { is_pinned?: boolean }>;
    // Pinned threads float to the top.
    withUnread.sort((a, b) => Number(!!b.is_pinned) - Number(!!a.is_pinned));
    return res.json(withUnread);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** GET /api/conversations/unread-count — total unread across all threads (tab badge). */
router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const { data } = await adminDb.from('conversations').select('*').or(memberFilter(req.userId!));
    const me = req.userId!;
    const convs = ((data ?? []) as ConversationRow[]).filter((c) =>
      !(c.deleted_by ?? []).includes(me) && !(c.archived_by ?? []).includes(me) && !(c.muted_by ?? []).includes(me));
    const unread = await unreadCounts(convs, me);
    let total = 0; for (const n of unread.values()) total += n;
    return res.json({ total, threads: unread.size });
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
  if (otherId === myId) return res.status(400).json({ error: "You can't message yourself" });
  if (await isBlockedEitherWay(myId, otherId)) return res.status(403).json({ error: "You can't message this person." });

  const findConversation = async () => {
    let q = adminDb.from('conversations').select('*').eq('is_group', false);
    q = shift_id ? q.eq('shift_id', shift_id) : q.is('shift_id', null);
    q = q.or(
      `and(participant_a_id.eq.${myId},participant_b_id.eq.${otherId}),` +
        `and(participant_a_id.eq.${otherId},participant_b_id.eq.${myId})`,
    );
    const { data } = await q.limit(1).maybeSingle();
    return data;
  };

  try {
    const existing = await findConversation();
    if (existing) {
      // Re-surface a thread I had deleted for myself.
      if ((existing.deleted_by ?? []).includes(myId)) {
        await adminDb.from('conversations').update({ deleted_by: (existing.deleted_by as string[]).filter((id: string) => id !== myId) }).eq('id', existing.id);
      }
      return res.json(existing);
    }
    const { data: inserted, error } = await adminDb
      .from('conversations')
      .insert({ participant_a_id: myId, participant_b_id: otherId, shift_id: shift_id ?? null, is_group: false, created_by: myId })
      .select()
      .maybeSingle();
    if (error || !inserted) {
      const raced = await findConversation();
      if (raced) return res.json(raced);
      return res.status(500).json({ error: error?.message ?? 'Could not create conversation' });
    }
    return res.status(201).json(inserted);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/**
 * POST /api/conversations/shift/:shiftId — open the shift's group chat.
 * Owner/staffer: created on demand with every confirmed worker. Confirmed
 * workers: returned if they're already a member.
 */
router.post('/shift/:shiftId', requireAuth, async (req, res) => {
  const me = req.userId!;
  const shiftId = String(req.params.shiftId);
  const { data: shift } = await adminDb.from('shifts').select('id, client_id').eq('id', shiftId).maybeSingle();
  if (!shift) return res.status(404).json({ error: 'Shift not found' });
  const isOwner = shift.client_id === me || req.userRole === 'staffer' || req.userRole === 'admin';

  const conv = await ensureShiftGroupChat(shiftId);
  if (!conv) return res.status(500).json({ error: 'Could not open the shift chat' });

  if (isOwner) {
    // Sync membership with the confirmed roster (+ the caller).
    const { data: booked } = await adminDb.from('applications').select('worker_id').eq('shift_id', shiftId).eq('status', 'accepted');
    const members = new Set<string>([...(conv.participant_ids ?? []), me, shift.client_id, ...(booked ?? []).map((b) => b.worker_id)]);
    if (members.size !== (conv.participant_ids ?? []).length) {
      await adminDb.from('conversations').update({ participant_ids: [...members] }).eq('id', conv.id);
      conv.participant_ids = [...members];
    }
  } else if (!(conv.participant_ids ?? []).includes(me)) {
    return res.status(403).json({ error: 'Only confirmed workers can join the shift chat' });
  }
  const [row] = await enrichConversations([conv], me);
  return res.json(row);
});

/** GET /api/conversations/:id — single conversation (with members) */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const conv = await conversationForUser(String(req.params.id), req.userId!);
    if (!conv) return res.status(404).json({ error: 'Not found' });
    const [row] = await enrichConversations([conv], req.userId!);
    return res.json(row);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** PATCH /api/conversations/:id/prefs { muted?, pinned?, archived? } — per-user thread settings. */
router.patch('/:id/prefs', requireAuth, async (req, res) => {
  const conv = await conversationForUser(String(req.params.id), req.userId!);
  if (!conv) return res.status(404).json({ error: 'Not found' });
  const me = req.userId!;
  const b = req.body as { muted?: boolean; pinned?: boolean; archived?: boolean };
  const toggle = (arr: string[] | null, on: boolean | undefined) => {
    const set = new Set(arr ?? []);
    if (on === true) set.add(me); else if (on === false) set.delete(me);
    return [...set];
  };
  const updates = {
    muted_by:    toggle(conv.muted_by, b.muted),
    pinned_by:   toggle(conv.pinned_by, b.pinned),
    archived_by: toggle(conv.archived_by, b.archived),
  };
  const { error } = await adminDb.from('conversations').update(updates).eq('id', conv.id);
  if (error) return res.status(500).json({ error: error.message });
  broadcastToUser(me, 'conversation_update', { conversationId: conv.id });
  return res.json({ ok: true, is_muted: updates.muted_by.includes(me), is_pinned: updates.pinned_by.includes(me), is_archived: updates.archived_by.includes(me) });
});

/** DELETE /api/conversations/:id — remove the thread from MY list (the other side keeps it). */
router.delete('/:id', requireAuth, async (req, res) => {
  const conv = await conversationForUser(String(req.params.id), req.userId!);
  if (!conv) return res.status(404).json({ error: 'Not found' });
  const me = req.userId!;
  const deleted = new Set(conv.deleted_by ?? []); deleted.add(me);
  const { error } = await adminDb.from('conversations').update({ deleted_by: [...deleted] }).eq('id', conv.id);
  if (error) return res.status(500).json({ error: error.message });
  broadcastToUser(me, 'conversation_update', { conversationId: conv.id });
  return res.json({ ok: true });
});

/** POST /api/conversations/:id/members { user_id } — owner adds someone to a group chat. */
router.post('/:id/members', requireAuth, requireRole('client', 'staffer'), async (req, res) => {
  const conv = await conversationForUser(String(req.params.id), req.userId!);
  if (!conv || !conv.is_group) return res.status(404).json({ error: 'Group not found' });
  const { user_id } = req.body as { user_id?: string };
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  const members = new Set(conv.participant_ids ?? []); members.add(user_id);
  await adminDb.from('conversations').update({ participant_ids: [...members] }).eq('id', conv.id);
  notifyConversationUpdate({ ...conv, participant_ids: [...members] });
  return res.json({ ok: true });
});

export default router;
