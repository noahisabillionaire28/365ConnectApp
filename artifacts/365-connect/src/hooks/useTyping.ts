/**
 * Typing indicator over Supabase Realtime broadcast (no table, no server hop).
 * Each open chat joins a channel named after the conversation; a member sends
 * a "typing" ping while they type and a "stop" when they send or go idle.
 *
 * The Realtime client is loaded on demand (it is not part of the first-paint
 * bundle) and only while a chat is open on a visible tab with a real project
 * configured. It is best-effort: a socket that cannot connect simply means no
 * typing indicator, never an error on screen.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import type { RealtimeChannel, RealtimeClient } from '@supabase/realtime-js';
import { isSupabaseConfigured, supabaseConfig, getCachedAccessToken } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const IDLE_MS = 4000;

type TypingPayload = { userId: string; username: string | null; typing: boolean };

export function useTyping(conversationId: string | null | undefined, myUsername: string | null) {
  const { user } = useAuth();
  const [typers, setTypers] = useState<Map<string, { username: string | null; at: number }>>(new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastPingRef = useRef(0);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!conversationId || !user?.id || !isSupabaseConfigured) return;
    let cancelled = false;
    let client: RealtimeClient | null = null;

    const onVisibility = () => {
      if (!client) return;
      try {
        if (document.visibilityState === 'visible') client.connect();
        else void client.disconnect();
      } catch { /* best-effort */ }
    };

    const start = async () => {
      try {
        const { RealtimeClient: Client } = await import('@supabase/realtime-js');
        if (cancelled) return;
        client = new Client(supabaseConfig.realtimeUrl, {
          params: { apikey: supabaseConfig.anonKey },
          accessToken: async () => getCachedAccessToken(),
        });
        const channel = client.channel(`typing:${conversationId}`, { config: { broadcast: { self: false } } });
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
        // Status callbacks (CHANNEL_ERROR / TIMED_OUT) are deliberately ignored.
        channel.subscribe(() => {});
        channelRef.current = channel;
        document.addEventListener('visibilitychange', onVisibility);
        if (document.visibilityState !== 'visible') void client.disconnect();
      } catch { /* Realtime unavailable — typing stays hidden */ }
    };
    void start();

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
      cancelled = true;
      clearInterval(sweep);
      document.removeEventListener('visibilitychange', onVisibility);
      channelRef.current = null;
      if (client) { try { void client.disconnect(); } catch { /* ignore */ } }
      setTypers(new Map());
    };
  }, [conversationId, user?.id]);

  const send = useCallback((typing: boolean) => {
    const ch = channelRef.current;
    if (!ch || !user?.id) return;
    try {
      void ch.send({ type: 'broadcast', event: 'typing', payload: { userId: user.id, username: myUsername, typing } satisfies TypingPayload }).catch(() => {});
    } catch { /* not connected */ }
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
