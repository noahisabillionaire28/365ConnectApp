/**
 * useSSE — opens a Server-Sent Events connection for the current user and
 * forwards all events to the shared sseEmitter so other hooks can react.
 *
 * Auth: EventSource cannot send headers, so the Supabase access token is
 * passed as `?token=`; the server verifies it and binds the stream to the
 * token's user. A stale token (after a refresh) makes the server answer 401 and
 * the browser stops retrying, so on error we reopen with a fresh token.
 *
 * Mount once at the top of the authenticated app tree (e.g. HomeScreen or a
 * layout wrapper). The connection is torn down when the component unmounts or
 * the user signs out.
 */
import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { emitSSE } from '@/lib/sseEmitter';
import { supabase, getCachedAccessToken } from '@/lib/supabase';

const FORWARDED_EVENTS = [
  'new_message',
  'new_notification',
  'conversation_update',
  'messages_read',      // read receipts: the other person opened my messages
  'message_deleted',    // a message in an open thread was deleted by its sender
  'message_updated',
  'message_reaction',
  'reader_update',
] as const;

/** The current Supabase access token (cache first, then getSession). */
async function resolveAccessToken(): Promise<string | null> {
  const cached = getCachedAccessToken();
  if (cached) return cached;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

// Same base as apiClient — proxied to the api-server by Replit
export function useSSE(): void {
  const { user } = useAuth();
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let backoffMs = 1_000;

    const connect = async () => {
      if (cancelled) return;
      const token = await resolveAccessToken();
      if (cancelled) return;
      if (!token) {
        // Signed-in user but no token yet (hydration) — try again shortly.
        retryTimer = setTimeout(connect, backoffMs);
        backoffMs = Math.min(backoffMs * 2, 30_000);
        return;
      }

      // Close any existing connection before opening a new one
      esRef.current?.close();

      const url = `/api/sse?token=${encodeURIComponent(token)}`;
      const es = new EventSource(url, { withCredentials: true });
      esRef.current = es;

      es.addEventListener('connected', () => {
        backoffMs = 1_000;
        console.debug('[SSE] connected');
      });

      for (const name of FORWARDED_EVENTS) {
        es.addEventListener(name, (e: MessageEvent) => {
          try { emitSSE(name, JSON.parse(e.data)); } catch { /* noop */ }
        });
      }

      es.onerror = () => {
        // A rejected token (401) closes the stream for good; a network blip
        // leaves it CONNECTING and the browser retries on its own. Either way,
        // reopen with a fresh token after a backoff so a refreshed session
        // reconnects instead of hammering the old token.
        console.debug('[SSE] connection error — reconnecting with a fresh token');
        es.close();
        if (esRef.current === es) esRef.current = null;
        if (cancelled) return;
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(connect, backoffMs);
        backoffMs = Math.min(backoffMs * 2, 30_000);
      };
    };

    void connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [user?.id]);
}
