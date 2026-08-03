import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { onSSE } from '@/lib/sseEmitter';
import type { MessageRow } from '@/lib/supabase';

export function useMessages(conversationId: string | null | undefined) {
  const { user } = useAuth();
  const [messages, setMessages]       = useState<MessageRow[]>([]);
  const [isLoading, setLoading]       = useState(true);
  const [hasMore, setHasMore]         = useState(false);
  const oldestRef                     = useRef<string | undefined>(undefined);

  const load = useCallback(async () => {
    if (!conversationId || !user?.id) { setMessages([]); setLoading(false); return; }
    setLoading(true);
    try {
      const rows = await apiClient(user.id).get<MessageRow[]>(`/messages/${conversationId}?limit=30`);
      setMessages(rows);
      setHasMore(rows.length === 30);
      oldestRef.current = rows[0]?.created_at;
    } catch (e) {
      console.error('[useMessages] load failed:', e);
    } finally {
      setLoading(false);
    }
  }, [conversationId, user?.id]);

  useEffect(() => { void load(); }, [load]);

  // Live updates: append incoming messages for this conversation
  useEffect(() => {
    if (!conversationId) return;
    return onSSE<{ conversationId: string; message: MessageRow }>(
      'new_message',
      ({ conversationId: cid, message }) => {
        if (cid !== conversationId) return;
        setMessages((prev) => {
          // Avoid duplicates if the sender already appended optimistically
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
      },
    );
  }, [conversationId]);

  const loadOlder = useCallback(async () => {
    if (!conversationId || !user?.id || !oldestRef.current) return;
    try {
      const older = await apiClient(user.id).get<MessageRow[]>(
        `/messages/${conversationId}?limit=30&before=${encodeURIComponent(oldestRef.current)}`,
      );
      if (older.length === 0) { setHasMore(false); return; }
      setMessages((prev) => [...older, ...prev]);
      setHasMore(older.length === 30);
      oldestRef.current = older[0]?.created_at;
    } catch (e) {
      console.error('[useMessages] loadOlder failed:', e);
    }
  }, [conversationId, user?.id]);

  const markRead = useCallback(async (messageIds: string[]) => {
    if (!user?.id || !messageIds.length) return;
    try {
      await apiClient(user.id).patch('/messages/read', { message_ids: messageIds });
      setMessages((prev) => prev.map((m) =>
        messageIds.includes(m.id) ? { ...m, read_at: new Date().toISOString() } : m,
      ));
    } catch (e) {
      console.error('[useMessages] markRead failed:', e);
    }
  }, [user?.id]);

  /**
   * Send a message. Accepts camelCase or snake_case media URL keys.
   * Returns { data: MessageRow | null, error: string | null }.
   */
  const sendMessage = useCallback(async (payload: {
    text?: string;
    image_url?: string;
    imageUrl?: string;
    video_url?: string;
    videoUrl?: string;
    voice_url?: string;
    voiceUrl?: string;
  }): Promise<{ data: MessageRow | null; error: string | null }> => {
    if (!conversationId || !user?.id) return { data: null, error: 'Not authenticated' };
    const body = {
      conversation_id: conversationId,
      text:       payload.text,
      image_url:  payload.image_url ?? payload.imageUrl,
      video_url:  payload.video_url ?? payload.videoUrl,
      voice_url:  payload.voice_url ?? payload.voiceUrl,
    };
    if (!body.text && !body.image_url && !body.video_url && !body.voice_url) {
      return { data: null, error: 'Empty message' };
    }
    try {
      const msg = await apiClient(user.id).post<MessageRow>('/messages', body);
      setMessages((prev) => [...prev, msg]);
      return { data: msg, error: null };
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      console.error('[useMessages] sendMessage failed:', err);
      return { data: null, error: err };
    }
  }, [conversationId, user?.id]);

  return { messages, isLoading, hasMore, loadOlder, markRead, sendMessage, refetch: load };
}
