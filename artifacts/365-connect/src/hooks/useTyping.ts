/**
 * Typing indicator over Supabase Realtime broadcast (no table, no server hop).
 * Each open chat joins a channel named after the conversation; a member sends
 * a "typing" ping while they type and a "stop" when they send or go idle.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const IDLE_MS = 4000;

type TypingPayload = { userId: string; username: string | null; typing: boolean };

export function useTyping(conversationId: string | null | undefined, myUsername: string | null) {
  const { user } = useAuth();
  const [typers, setTypers] = useState<Map<string, { username: string | null; at: number }>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastPingRef = useRef(0);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!conversationId || !user?.id) return;
    const channel = supabase.channel(`typing:${conversationId}`, { config: { broadcast: { self: false } } });
    channel.on('broadcast', { event: 'typing' }, ({ payload }) => {
      const p = payload as TypingPayload;
      if (!p?.userId || p.userId === user.id) return;
      setTypers((prev) => {
        const next = new Map(prev);
        if (p.typing) next.set(p.userId, { username: p.username, at: Date.now() });
        else next.delete(p.userId);
        return next;
      });
    });
    channel.subscribe();
    channelRef.current = channel;

    // Expire stale typers (a ping that never got a "stop").
    const sweep = setInterval(() => {
      setTypers((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [id, v] of next) if (Date.now() - v.at > IDLE_MS + 1000) { next.delete(id); changed = true; }
        return changed ? next : prev;
      });
    }, 1500);

    return () => {
      clearInterval(sweep);
      void supabase.removeChannel(channel);
      channelRef.current = null;
      setTypers(new Map());
    };
  }, [conversationId, user?.id]);

  const send = useCallback((typing: boolean) => {
    const ch = channelRef.current;
    if (!ch || !user?.id) return;
    void ch.send({ type: 'broadcast', event: 'typing', payload: { userId: user.id, username: myUsername, typing } satisfies TypingPayload });
  }, [user?.id, myUsername]);

  /** Call on every keystroke; throttled to one ping per 2s, auto-stops when idle. */
  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastPingRef.current > 2000) { lastPingRef.current = now; send(true); }
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(() => { lastPingRef.current = 0; send(false); }, IDLE_MS);
  }, [send]);

  /** Call when a message is sent or the field is cleared. */
  const stopTyping = useCallback(() => {
    if (stopTimerRef.current) { clearTimeout(stopTimerRef.current); stopTimerRef.current = null; }
    if (lastPingRef.current) { lastPingRef.current = 0; send(false); }
  }, [send]);

  const typingUsers = [...typers.values()].map((t) => t.username);
  return { typingUsers, notifyTyping, stopTyping };
}
