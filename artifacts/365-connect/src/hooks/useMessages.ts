/**
 * Messages for one conversation: paging, live updates (SSE + polling
 * fallback), optimistic sends with retry and an offline outbox, edits,
 * reactions, deletes, read receipts and group read positions.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { onSSE } from '@/lib/sseEmitter';
import type { MessageRow } from '@/lib/supabase';

export type SendPayload = {
  text?: string;
  image_url?: string; imageUrl?: string;
  video_url?: string; videoUrl?: string;
  voice_url?: string; voiceUrl?: string;
  file_url?: string; file_name?: string; file_size?: number;
  shift_card_id?: string;
  reply_to_id?: string;
};

const PAGE = 30;
const OUTBOX_KEY = '365connect:chat-outbox';

type OutboxItem = { conversationId: string; clientKey: string; body: Record<string, unknown> };

function readOutbox(): OutboxItem[] {
  try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? '[]') as OutboxItem[]; } catch { return []; }
}
function writeOutbox(items: OutboxItem[]) {
  try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(items)); } catch { /* ignore */ }
}

function mergeById(prev: MessageRow[], incoming: MessageRow[]): MessageRow[] {
  const map = new Map(prev.map((m) => [m.id, m]));
  let changed = false;
  for (const m of incoming) {
    const old = map.get(m.id);
    if (!old) { map.set(m.id, m); changed = true; continue; }
    // Server wins on fields that change after send.
    if (old.read_at !== m.read_at || old.deleted_at !== m.deleted_at || old.edited_at !== m.edited_at ||
        JSON.stringify(old.reactions ?? {}) !== JSON.stringify(m.reactions ?? {}) || old.text !== m.text) {
      map.set(m.id, { ...old, ...m }); changed = true;
    }
  }
  if (!changed) return prev;
  return [...map.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function useMessages(conversationId: string | null | undefined) {
  const { user } = useAuth();
  const [messages, setMessages]   = useState<MessageRow[]>([]);
  const [isLoading, setLoading]   = useState(true);
  const [hasMore, setHasMore]     = useState(false);
  /** Group read positions: userId → lastReadAt ISO. */
  const [readers, setReaders]     = useState<Record<string, string>>({});
  const oldestRef                 = useRef<string | undefined>(undefined);
  const messagesRef               = useRef<MessageRow[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const loadReaders = useCallback(async () => {
    if (!conversationId || !user?.id) return;
    try {
      const rows = await apiClient(user.id).get<{ user_id: string; last_read_at: string }[]>(`/messages/${conversationId}/readers`);
      setReaders(Object.fromEntries(rows.map((r) => [r.user_id, r.last_read_at])));
    } catch { /* ignore */ }
  }, [conversationId, user?.id]);

  const load = useCallback(async () => {
    if (!conversationId || !user?.id) { setMessages([]); setLoading(false); return; }
    setLoading(true);
    try {
      const rows = await apiClient(user.id).get<MessageRow[]>(`/messages/${conversationId}?limit=${PAGE}`);
      setMessages((prev) => {
        // Keep any optimistic (sending/failed) rows that the server doesn't know yet.
        const pending = prev.filter((m) => m._status && m.conversation_id === conversationId);
        return [...rows, ...pending.filter((p) => !rows.some((r) => r.client_key && r.client_key === p.client_key))];
      });
      setHasMore(rows.length === PAGE);
      oldestRef.current = rows[0]?.created_at;
      void loadReaders();
    } catch (e) {
      console.error('[useMessages] load failed:', e);
    } finally {
      setLoading(false);
    }
  }, [conversationId, user?.id, loadReaders]);

  useEffect(() => { void load(); }, [load]);

  // Polling fallback (SSE can drop on serverless hosts): refresh the latest page while visible.
  useEffect(() => {
    if (!conversationId || !user?.id) return;
    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const rows = await apiClient(user.id).get<MessageRow[]>(`/messages/${conversationId}?limit=${PAGE}`);
        setMessages((prev) => mergeById(prev.filter((m) => !(m._status && rows.some((r) => r.client_key === m.client_key))), rows));
      } catch { /* ignore */ }
    };
    const t = setInterval(() => { void tick(); }, 5000);
    return () => clearInterval(t);
  }, [conversationId, user?.id]);

  // ── Live updates ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!conversationId) return;
    const offs = [
      onSSE<{ conversationId: string; message: MessageRow }>('new_message', ({ conversationId: cid, message }) => {
        if (cid !== conversationId) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          // Replace my optimistic copy if this is its server row.
          const withoutTmp = message.client_key ? prev.filter((m) => !(m._status && m.client_key === message.client_key)) : prev;
          return [...withoutTmp, message];
        });
      }),
      onSSE<{ conversationId: string; messageIds: string[]; readAt: string }>('messages_read', ({ conversationId: cid, messageIds, readAt }) => {
        if (cid !== conversationId) return;
        const ids = new Set(messageIds);
        setMessages((prev) => prev.map((m) => (ids.has(m.id) && !m.read_at ? { ...m, read_at: readAt } : m)));
      }),
      onSSE<{ conversationId: string; messageId: string; deletedAt: string }>('message_deleted', ({ conversationId: cid, messageId, deletedAt }) => {
        if (cid !== conversationId) return;
        setMessages((prev) => prev.map((m) => (m.id === messageId
          ? { ...m, deleted_at: deletedAt, text: null, image_url: null, video_url: null, voice_url: null, file_url: null, file_name: null, shift_card: null, shift_card_id: null, reactions: {} }
          : m)));
      }),
      onSSE<{ conversationId: string; message: MessageRow }>('message_updated', ({ conversationId: cid, message }) => {
        if (cid !== conversationId) return;
        setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, ...message } : m)));
      }),
      onSSE<{ conversationId: string; messageId: string; reactions: Record<string, string[]> }>('message_reaction', ({ conversationId: cid, messageId, reactions }) => {
        if (cid !== conversationId) return;
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
      }),
      onSSE<{ conversationId: string; userId: string; lastReadAt: string }>('reader_update', ({ conversationId: cid, userId, lastReadAt }) => {
        if (cid !== conversationId) return;
        setReaders((prev) => ({ ...prev, [userId]: lastReadAt }));
      }),
    ];
    return () => { for (const off of offs) off(); };
  }, [conversationId]);

  const loadOlder = useCallback(async () => {
    if (!conversationId || !user?.id || !oldestRef.current) return;
    try {
      const older = await apiClient(user.id).get<MessageRow[]>(
        `/messages/${conversationId}?limit=${PAGE}&before=${encodeURIComponent(oldestRef.current)}`,
      );
      if (older.length === 0) { setHasMore(false); return; }
      setMessages((prev) => [...older.filter((o) => !prev.some((p) => p.id === o.id)), ...prev]);
      setHasMore(older.length === PAGE);
      oldestRef.current = older[0]?.created_at;
    } catch (e) {
      console.error('[useMessages] loadOlder failed:', e);
    }
  }, [conversationId, user?.id]);

  /** Mark the thread read up to now (sends DM receipts + records my read position). */
  const markRead = useCallback(async (messageIds: string[]) => {
    if (!user?.id || !conversationId) return;
    try {
      const r = await apiClient(user.id).patch<{ read_at: string; message_ids: string[] }>(
        '/messages/read', { message_ids: messageIds, conversation_id: conversationId },
      );
      const ids = new Set(r.message_ids ?? messageIds);
      setMessages((prev) => prev.map((m) => (ids.has(m.id) && !m.read_at ? { ...m, read_at: r.read_at } : m)));
    } catch (e) {
      console.error('[useMessages] markRead failed:', e);
    }
  }, [user?.id, conversationId]);

  // ── Sending (optimistic + retry + offline outbox) ───────────────────────────
  const postMessage = useCallback(async (cid: string, clientKey: string, body: Record<string, unknown>) => {
    if (!user?.id) throw new Error('Not signed in');
    const msg = await apiClient(user.id).post<MessageRow>('/messages', { ...body, conversation_id: cid, client_key: clientKey });
    setMessages((prev) => {
      const without = prev.filter((m) => !(m.client_key === clientKey && m._status));
      if (without.some((m) => m.id === msg.id)) return without;
      return [...without, msg];
    });
    writeOutbox(readOutbox().filter((o) => o.clientKey !== clientKey));
    return msg;
  }, [user?.id]);

  const sendMessage = useCallback(async (payload: SendPayload): Promise<{ data: MessageRow | null; error: string | null }> => {
    if (!conversationId || !user?.id) return { data: null, error: 'Not authenticated' };
    const body: Record<string, unknown> = {
      text:        payload.text,
      image_url:   payload.image_url ?? payload.imageUrl,
      video_url:   payload.video_url ?? payload.videoUrl,
      voice_url:   payload.voice_url ?? payload.voiceUrl,
      file_url:    payload.file_url, file_name: payload.file_name, file_size: payload.file_size,
      shift_card_id: payload.shift_card_id,
      reply_to_id: payload.reply_to_id,
    };
    if (!body.text && !body.image_url && !body.video_url && !body.voice_url && !body.file_url && !body.shift_card_id) {
      return { data: null, error: 'Empty message' };
    }
    const clientKey = (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const replyTo = payload.reply_to_id ? messagesRef.current.find((m) => m.id === payload.reply_to_id) : undefined;
    const optimistic: MessageRow = {
      id: `tmp-${clientKey}`, conversation_id: conversationId, sender_id: user.id, kind: 'user',
      text: (body.text as string) ?? null, image_url: (body.image_url as string) ?? null,
      video_url: (body.video_url as string) ?? null, voice_url: (body.voice_url as string) ?? null,
      file_url: (body.file_url as string) ?? null, file_name: (body.file_name as string) ?? null,
      file_size: (body.file_size as number) ?? null, shift_card_id: (body.shift_card_id as string) ?? null,
      reply_to_id: payload.reply_to_id ?? null,
      reply_to: replyTo ? { id: replyTo.id, sender_id: replyTo.sender_id, sender_username: replyTo.sender_username ?? null, preview: replyTo.text ?? (replyTo.image_url ? '📷 Photo' : replyTo.video_url ? '🎥 Video' : replyTo.voice_url ? '🎤 Voice message' : replyTo.file_name ? `📎 ${replyTo.file_name}` : 'Message') } : null,
      reactions: {}, read_at: null, created_at: new Date().toISOString(), client_key: clientKey, _status: 'sending',
    };
    setMessages((prev) => [...prev, optimistic]);

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      writeOutbox([...readOutbox(), { conversationId, clientKey, body }]);
      setMessages((prev) => prev.map((m) => (m.client_key === clientKey ? { ...m, _status: 'failed' } : m)));
      return { data: null, error: 'offline' };
    }
    try {
      const msg = await postMessage(conversationId, clientKey, body);
      return { data: msg, error: null };
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      writeOutbox([...readOutbox().filter((o) => o.clientKey !== clientKey), { conversationId, clientKey, body }]);
      setMessages((prev) => prev.map((m) => (m.client_key === clientKey ? { ...m, _status: 'failed' } : m)));
      return { data: null, error: err };
    }
  }, [conversationId, user?.id, postMessage]);

  /** Retry a failed optimistic message (same client_key, so no duplicates). */
  const retryMessage = useCallback(async (tmpId: string): Promise<string | null> => {
    const m = messagesRef.current.find((x) => x.id === tmpId);
    if (!m?.client_key || !conversationId) return 'Nothing to retry';
    const item = readOutbox().find((o) => o.clientKey === m.client_key);
    const body = item?.body ?? {
      text: m.text, image_url: m.image_url, video_url: m.video_url, voice_url: m.voice_url,
      file_url: m.file_url, file_name: m.file_name, file_size: m.file_size, shift_card_id: m.shift_card_id, reply_to_id: m.reply_to_id,
    };
    setMessages((prev) => prev.map((x) => (x.id === tmpId ? { ...x, _status: 'sending' } : x)));
    try { await postMessage(conversationId, m.client_key, body); return null; }
    catch (e) {
      setMessages((prev) => prev.map((x) => (x.id === tmpId ? { ...x, _status: 'failed' } : x)));
      return e instanceof Error ? e.message : 'Still could not send.';
    }
  }, [conversationId, postMessage]);

  const discardFailed = useCallback((tmpId: string) => {
    const m = messagesRef.current.find((x) => x.id === tmpId);
    if (m?.client_key) writeOutbox(readOutbox().filter((o) => o.clientKey !== m.client_key));
    setMessages((prev) => prev.filter((x) => x.id !== tmpId));
  }, []);

  // When the connection comes back, flush the outbox for this thread.
  useEffect(() => {
    if (!conversationId) return;
    const flush = async () => {
      for (const item of readOutbox().filter((o) => o.conversationId === conversationId)) {
        try { await postMessage(item.conversationId, item.clientKey, item.body); } catch { /* keep in outbox */ }
      }
    };
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [conversationId, postMessage]);

  /** Delete one of my own messages (soft delete — leaves a note in place). */
  const deleteMessage = useCallback(async (messageId: string): Promise<string | null> => {
    if (!user?.id) return 'Not signed in.';
    const snapshot = messagesRef.current;
    setMessages((prev) => prev.map((m) => (m.id === messageId
      ? { ...m, deleted_at: new Date().toISOString(), text: null, image_url: null, video_url: null, voice_url: null, file_url: null, file_name: null, shift_card: null, reactions: {} }
      : m)));
    try {
      await apiClient(user.id).delete(`/messages/${messageId}`);
      return null;
    } catch (e) {
      setMessages(snapshot);
      return e instanceof Error ? e.message : 'Could not delete the message.';
    }
  }, [user?.id]);

  const editMessage = useCallback(async (messageId: string, text: string): Promise<string | null> => {
    if (!user?.id) return 'Not signed in.';
    const snapshot = messagesRef.current;
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, text, edited_at: new Date().toISOString() } : m)));
    try {
      await apiClient(user.id).patch(`/messages/${messageId}`, { text });
      return null;
    } catch (e) {
      setMessages(snapshot);
      return e instanceof Error ? e.message : 'Could not edit the message.';
    }
  }, [user?.id]);

  const react = useCallback(async (messageId: string, emoji: string): Promise<string | null> => {
    if (!user?.id) return 'Not signed in.';
    const me = user.id;
    setMessages((prev) => prev.map((m) => {
      if (m.id !== messageId) return m;
      const next: Record<string, string[]> = {};
      const had = (m.reactions?.[emoji] ?? []).includes(me);
      for (const [k, ids] of Object.entries(m.reactions ?? {})) {
        const rest = ids.filter((id) => id !== me);
        if (rest.length) next[k] = rest;
      }
      if (!had) next[emoji] = [...(next[emoji] ?? []), me];
      return { ...m, reactions: next };
    }));
    try {
      const r = await apiClient(user.id).post<{ reactions: Record<string, string[]> }>(`/messages/${messageId}/react`, { emoji });
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions: r.reactions } : m)));
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Could not react.';
    }
  }, [user?.id]);

  const search = useCallback(async (q: string): Promise<MessageRow[]> => {
    if (!conversationId || !user?.id || !q.trim()) return [];
    try {
      return await apiClient(user.id).get<MessageRow[]>(`/messages/${conversationId}?limit=50&q=${encodeURIComponent(q.trim())}`);
    } catch { return []; }
  }, [conversationId, user?.id]);

  return {
    messages, isLoading, hasMore, readers,
    loadOlder, markRead, sendMessage, retryMessage, discardFailed,
    deleteMessage, editMessage, react, search, refetch: load,
  };
}
