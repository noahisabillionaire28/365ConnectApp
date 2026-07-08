import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, type MessageRow } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const PAGE_SIZE = 30;

/** Messages for a single conversation: initial page, "load older", live INSERTs, read receipts. */
export function useMessages(conversationId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages]   = useState<MessageRow[]>([]);
  const [isLoading, setLoading]   = useState(true);
  const [hasMore, setHasMore]     = useState(false);
  const oldestLoaded = useRef<string | null>(null);
  const isLoadingOlder = useRef(false);

  const load = useCallback(async () => {
    if (!conversationId) { setMessages([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (error) {
      console.error('[useMessages] fetch failed:', error.message);
      setMessages([]);
    } else {
      const rows = ((data ?? []) as MessageRow[]).reverse();
      setMessages(rows);
      oldestLoaded.current = rows[0]?.created_at ?? null;
      setHasMore(rows.length === PAGE_SIZE);
    }
    setLoading(false);
  }, [conversationId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on<MessageRow>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => setMessages((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new])),
      )
      .on<MessageRow>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => setMessages((prev) => prev.map((m) => (m.id === payload.new.id ? payload.new : m))),
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [conversationId]);

  const loadOlder = useCallback(async () => {
    if (!conversationId || !oldestLoaded.current || !hasMore || isLoadingOlder.current) return;
    isLoadingOlder.current = true;
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .lt('created_at', oldestLoaded.current)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      if (error) { console.error('[useMessages] loadOlder failed:', error.message); return; }
      const older = ((data ?? []) as MessageRow[]).reverse();
      if (older.length > 0) oldestLoaded.current = older[0].created_at;
      setHasMore(older.length === PAGE_SIZE);
      setMessages((prev) => [...older, ...prev]);
    } finally {
      isLoadingOlder.current = false;
    }
  }, [conversationId, hasMore]);

  const markRead = useCallback(async () => {
    if (!conversationId || !user?.id) return;
    const unread = messages.filter((m) => m.sender_id !== user.id && !m.read_at);
    if (unread.length === 0) return;
    const nowIso = new Date().toISOString();
    setMessages((prev) => prev.map((m) => (unread.some((u) => u.id === m.id) ? { ...m, read_at: nowIso } : m)));
    const { error } = await supabase
      .from('messages')
      .update({ read_at: nowIso })
      .in('id', unread.map((m) => m.id));
    if (error) console.error('[useMessages] markRead failed:', error.message);
  }, [conversationId, user?.id, messages]);

  async function sendMessage(payload: { text?: string; imageUrl?: string; videoUrl?: string; voiceUrl?: string }) {
    if (!conversationId || !user?.id) return { error: 'Missing conversation or session' };
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id:       user.id,
        text:             payload.text ?? null,
        image_url:        payload.imageUrl ?? null,
        video_url:        payload.videoUrl ?? null,
        voice_url:        payload.voiceUrl ?? null,
      })
      .select('*')
      .single();
    if (error) {
      console.error('[useMessages] send failed:', error.message);
      return { error: error.message };
    }
    setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data as MessageRow]));
    return { error: null };
  }

  return { messages, isLoading, hasMore, loadOlder, markRead, sendMessage, refetch: load };
}
