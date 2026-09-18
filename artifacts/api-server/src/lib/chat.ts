/**
 * Shared chat helpers — conversations (DM + shift group chats), message
 * enrichment, previews, blocks, system messages, and scheduled-message flush.
 */
import { adminDb } from './supabaseAdmin.js';
import { broadcastToUser } from './sseManager.js';
import { pushToUsers } from './push.js';

export type ConversationRow = {
  id: string;
  shift_id: string | null;
  participant_a_id: string | null;
  participant_b_id: string | null;
  participant_ids: string[] | null;
  is_group: boolean;
  title: string | null;
  created_by: string | null;
  last_message: string | null;
  last_message_at: string | null;
  muted_by: string[] | null;
  pinned_by: string[] | null;
  archived_by: string[] | null;
  deleted_by: string[] | null;
  created_at: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  kind: string;
  text: string | null;
  image_url: string | null;
  video_url: string | null;
  voice_url: string | null;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  shift_card_id: string | null;
  reply_to_id: string | null;
  reactions: Record<string, string[]> | null;
  read_at: string | null;
  deleted_at: string | null;
  edited_at: string | null;
  client_key: string | null;
  created_at: string;
};

/** The PostgREST filter that matches every conversation a user belongs to. */
export function memberFilter(userId: string): string {
  return `participant_a_id.eq.${userId},participant_b_id.eq.${userId},participant_ids.cs.{${userId}}`;
}

/** Every user id in a conversation (DM pair or group members). */
export function participantsOf(conv: ConversationRow): string[] {
  if (conv.is_group) return [...new Set(conv.participant_ids ?? [])];
  return [conv.participant_a_id, conv.participant_b_id].filter((x): x is string => !!x);
}

export function isMember(conv: ConversationRow, userId: string): boolean {
  return participantsOf(conv).includes(userId);
}

/** Load a conversation only if the caller is a member of it. */
export async function conversationForUser(conversationId: string, userId: string): Promise<ConversationRow | null> {
  const { data } = await adminDb
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .or(memberFilter(userId))
    .maybeSingle();
  return (data as ConversationRow | null) ?? null;
}

/** One-line preview of a message for the conversation list. */
export function previewOf(m: Partial<MessageRow>, senderName?: string | null): string {
  const who = senderName ? `${senderName}: ` : '';
  if (m.kind === 'system') return m.text ?? '';
  if (m.deleted_at) return `${who}Message deleted`;
  if (m.text) return `${who}${m.text}`;
  if (m.image_url) return `${who}📷 Photo`;
  if (m.video_url) return `${who}🎥 Video`;
  if (m.voice_url) return `${who}🎤 Voice message`;
  if (m.file_url) return `${who}📎 ${m.file_name ?? 'File'}`;
  if (m.shift_card_id) return `${who}📋 Shared a shift`;
  return who.trim();
}

/** Keep conversations.last_message / last_message_at in step with the newest message. */
export async function refreshConversationPreview(conversationId: string, conv?: ConversationRow | null): Promise<void> {
  const { data: latest } = await adminDb
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) return;
  let senderName: string | null = null;
  if (conv?.is_group && latest.kind !== 'system') {
    const { data: u } = await adminDb.from('users').select('username').eq('id', latest.sender_id).maybeSingle();
    senderName = u?.username ? `@${u.username}` : null;
  }
  await adminDb
    .from('conversations')
    .update({ last_message: previewOf(latest as MessageRow, senderName), last_message_at: latest.created_at })
    .eq('id', conversationId);
}

/** Tell every member's open tabs that the conversation list changed. */
export function notifyConversationUpdate(conv: ConversationRow): void {
  for (const uid of participantsOf(conv)) {
    broadcastToUser(uid, 'conversation_update', { conversationId: conv.id });
  }
}

/** Has either user blocked the other? */
export async function isBlockedEitherWay(a: string, b: string): Promise<boolean> {
  const { count } = await adminDb
    .from('user_blocks')
    .select('*', { count: 'exact', head: true })
    .or(`and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`);
  return (count ?? 0) > 0;
}

/** Ids of everyone I've blocked or who blocked me. */
export async function blockedIdsFor(userId: string): Promise<Set<string>> {
  const { data } = await adminDb
    .from('user_blocks')
    .select('blocker_id, blocked_id')
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
  const out = new Set<string>();
  for (const r of data ?? []) out.add(r.blocker_id === userId ? r.blocked_id : r.blocker_id);
  return out;
}

/**
 * Attach display data to raw message rows: sender name/photo, the quoted
 * reply-to message, and the shift card (for shared shifts).
 */
export async function enrichMessages(msgs: MessageRow[]): Promise<Record<string, unknown>[]> {
  if (!msgs.length) return [];
  const senderIds = [...new Set(msgs.map((m) => m.sender_id).filter(Boolean))];
  const replyIds  = [...new Set(msgs.map((m) => m.reply_to_id).filter((x): x is string => !!x))];
  const shiftIds  = [...new Set(msgs.map((m) => m.shift_card_id).filter((x): x is string => !!x))];

  const [senders, replies, shifts] = await Promise.all([
    senderIds.length ? adminDb.from('users').select('id, username, photo_url').in('id', senderIds) : Promise.resolve({ data: [] }),
    replyIds.length  ? adminDb.from('messages').select('id, sender_id, text, image_url, video_url, voice_url, file_name, shift_card_id, deleted_at').in('id', replyIds) : Promise.resolve({ data: [] }),
    shiftIds.length  ? adminDb.from('shifts').select('id, title, job_type, start_time, end_time, pay_rate, pay_period, location, status, spots_available, spots_filled').in('id', shiftIds) : Promise.resolve({ data: [] }),
  ]);
  const senderMap = new Map<string, any>((senders.data ?? []).map((u: any) => [u.id, u]));
  const replyMap  = new Map<string, any>((replies.data ?? []).map((r: any) => [r.id, r]));
  const shiftMap  = new Map<string, any>((shifts.data ?? []).map((s: any) => [s.id, s]));

  // Reply previews need the quoted sender's name too.
  const replySenderIds = [...new Set((replies.data ?? []).map((r: any) => r.sender_id).filter((id: string) => !senderMap.has(id)))];
  if (replySenderIds.length) {
    const { data: more } = await adminDb.from('users').select('id, username, photo_url').in('id', replySenderIds as string[]);
    for (const u of more ?? []) senderMap.set(u.id, u);
  }

  return msgs.map((m) => {
    const u = senderMap.get(m.sender_id) ?? null;
    const r = m.reply_to_id ? replyMap.get(m.reply_to_id) ?? null : null;
    const ru = r ? senderMap.get(r.sender_id) ?? null : null;
    return {
      ...m,
      sender_username: u?.username ?? null,
      sender_photo: u?.photo_url ?? null,
      reply_to: r ? {
        id: r.id,
        sender_id: r.sender_id,
        sender_username: ru?.username ?? null,
        preview: previewOf(r),
      } : null,
      shift_card: m.shift_card_id ? shiftMap.get(m.shift_card_id) ?? null : null,
    };
  });
}

/** Insert a system line ("@maria joined the shift chat") and push it live. */
export async function insertSystemMessage(conv: ConversationRow, text: string, actorId?: string | null): Promise<void> {
  const senderId = actorId ?? conv.created_by ?? participantsOf(conv)[0];
  if (!senderId) return;
  const { data: msg } = await adminDb
    .from('messages')
    .insert({ conversation_id: conv.id, sender_id: senderId, kind: 'system', text })
    .select()
    .single();
  if (!msg) return;
  await adminDb
    .from('conversations')
    .update({ last_message: text, last_message_at: msg.created_at })
    .eq('id', conv.id);
  for (const uid of participantsOf(conv)) {
    broadcastToUser(uid, 'new_message', { conversationId: conv.id, message: { ...msg, sender_username: null, sender_photo: null } });
    broadcastToUser(uid, 'conversation_update', { conversationId: conv.id });
  }
}

/** Load (or create) the group chat for a shift. The shift owner is always a member. */
export async function ensureShiftGroupChat(shiftId: string): Promise<ConversationRow | null> {
  const { data: existing } = await adminDb
    .from('conversations').select('*').eq('shift_id', shiftId).eq('is_group', true).maybeSingle();
  if (existing) return existing as ConversationRow;

  const { data: shift } = await adminDb
    .from('shifts').select('id, title, client_id, job_type').eq('id', shiftId).maybeSingle();
  if (!shift?.client_id) return null;

  const { data: created, error } = await adminDb
    .from('conversations')
    .insert({
      shift_id: shiftId,
      is_group: true,
      title: shift.title || shift.job_type || 'Shift chat',
      created_by: shift.client_id,
      participant_ids: [shift.client_id],
      participant_a_id: null,
      participant_b_id: null,
    })
    .select()
    .maybeSingle();
  if (error) {
    // Unique index race: someone else created it first.
    const { data: raced } = await adminDb
      .from('conversations').select('*').eq('shift_id', shiftId).eq('is_group', true).maybeSingle();
    return (raced as ConversationRow | null) ?? null;
  }
  return (created as ConversationRow | null) ?? null;
}

/** Add a booked worker to the shift's group chat (creating it on first booking). */
export async function addWorkerToShiftChat(shiftId: string, workerId: string): Promise<void> {
  try {
    const conv = await ensureShiftGroupChat(shiftId);
    if (!conv) return;
    const members = new Set(conv.participant_ids ?? []);
    if (members.has(workerId)) return;
    members.add(workerId);
    const updated = { ...conv, participant_ids: [...members] };
    await adminDb.from('conversations').update({ participant_ids: [...members] }).eq('id', conv.id);
    const { data: u } = await adminDb.from('users').select('username').eq('id', workerId).maybeSingle();
    await insertSystemMessage(updated, `${u?.username ? `@${u.username}` : 'A worker'} joined the shift chat`, workerId);
    broadcastToUser(workerId, 'conversation_update', { conversationId: conv.id });
  } catch (e) {
    console.error('[chat] addWorkerToShiftChat failed:', e);
  }
}

/** Remove a worker from the shift chat when they drop or are removed. */
export async function removeWorkerFromShiftChat(shiftId: string, workerId: string): Promise<void> {
  try {
    const { data } = await adminDb
      .from('conversations').select('*').eq('shift_id', shiftId).eq('is_group', true).maybeSingle();
    const conv = data as ConversationRow | null;
    if (!conv || !(conv.participant_ids ?? []).includes(workerId)) return;
    const members = (conv.participant_ids ?? []).filter((id) => id !== workerId);
    await adminDb.from('conversations').update({ participant_ids: members }).eq('id', conv.id);
    const { data: u } = await adminDb.from('users').select('username').eq('id', workerId).maybeSingle();
    await insertSystemMessage({ ...conv, participant_ids: members }, `${u?.username ? `@${u.username}` : 'A worker'} left the shift chat`, conv.created_by ?? members[0]);
    broadcastToUser(workerId, 'conversation_update', { conversationId: conv.id });
  } catch (e) {
    console.error('[chat] removeWorkerFromShiftChat failed:', e);
  }
}

/**
 * Deliver a stored message to everyone else in the thread: SSE for open tabs,
 * push for closed ones (skipping people who muted the thread).
 */
export async function fanOutMessage(conv: ConversationRow, msg: Record<string, unknown>, senderId: string): Promise<void> {
  const others = participantsOf(conv).filter((id) => id !== senderId);
  for (const uid of others) {
    broadcastToUser(uid, 'new_message', { conversationId: conv.id, message: msg });
    broadcastToUser(uid, 'conversation_update', { conversationId: conv.id });
  }
  broadcastToUser(senderId, 'conversation_update', { conversationId: conv.id });

  // Re-surface the thread for anyone who had "deleted" it for themselves.
  if (conv.deleted_by?.length) {
    await adminDb.from('conversations').update({ deleted_by: [] }).eq('id', conv.id);
  }

  const muted = new Set(conv.muted_by ?? []);
  const pushTo = others.filter((id) => !muted.has(id));
  if (pushTo.length) {
    const { data: sender } = await adminDb.from('users').select('username').eq('id', senderId).maybeSingle();
    const name = sender?.username ? `@${sender.username}` : 'New message';
    const title = conv.is_group ? `${conv.title ?? 'Shift chat'}` : name;
    const body = conv.is_group ? previewOf(msg as Partial<MessageRow>, name) : previewOf(msg as Partial<MessageRow>);
    await pushToUsers(pushTo, { title, body: body.slice(0, 140), url: `/messages/${conv.id}`, tag: `conv-${conv.id}` });
  }
}

/**
 * Turn any due scheduled messages into real messages. Called opportunistically
 * from the conversation/message reads (and a daily cron), so delivery happens
 * within moments of the first app activity after the send time.
 */
export async function flushScheduledMessages(limit = 25): Promise<number> {
  const { data: due } = await adminDb
    .from('scheduled_messages')
    .select('*')
    .is('sent_message_id', null)
    .lte('send_at', new Date().toISOString())
    .order('send_at', { ascending: true })
    .limit(limit);
  let sent = 0;
  for (const s of due ?? []) {
    const { data: conv } = await adminDb.from('conversations').select('*').eq('id', s.conversation_id).maybeSingle();
    if (!conv || !isMember(conv as ConversationRow, s.sender_id)) {
      await adminDb.from('scheduled_messages').delete().eq('id', s.id);
      continue;
    }
    const { data: msg } = await adminDb
      .from('messages')
      .insert({ conversation_id: s.conversation_id, sender_id: s.sender_id, text: s.text, client_key: `sched-${s.id}` })
      .select()
      .maybeSingle();
    if (!msg) continue;
    await adminDb.from('scheduled_messages').update({ sent_message_id: msg.id }).eq('id', s.id);
    await refreshConversationPreview(s.conversation_id, conv as ConversationRow);
    const [enriched] = await enrichMessages([msg as MessageRow]);
    await fanOutMessage(conv as ConversationRow, enriched, s.sender_id);
    sent += 1;
  }
  return sent;
}
