/**
 * useSSE — opens a Server-Sent Events connection for the current user and
 * forwards all events to the shared sseEmitter so other hooks can react.
 *
 * Mount once at the top of the authenticated app tree (e.g. HomeScreen or a
 * layout wrapper). The connection is torn down when the component unmounts or
 * the user signs out.
 */
import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { emitSSE } from '@/lib/sseEmitter';

// Same base as apiClient — proxied to the api-server by Replit
export function useSSE(): void {
  const { user } = useAuth();
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    // Close any existing connection before opening a new one
    esRef.current?.close();

    const url = `/api/sse?userId=${encodeURIComponent(user.id)}`;
    const es = new EventSource(url, { withCredentials: true });
    esRef.current = es;

    es.addEventListener('connected', () => {
      console.debug('[SSE] connected');
    });

    es.addEventListener('new_message', (e: MessageEvent) => {
      try { emitSSE('new_message', JSON.parse(e.data)); } catch { /* noop */ }
    });

    es.addEventListener('new_notification', (e: MessageEvent) => {
      try { emitSSE('new_notification', JSON.parse(e.data)); } catch { /* noop */ }
    });

    es.addEventListener('conversation_update', (e: MessageEvent) => {
      try { emitSSE('conversation_update', JSON.parse(e.data)); } catch { /* noop */ }
    });

    es.onerror = () => {
      // EventSource auto-reconnects on error; log quietly
      console.debug('[SSE] connection error — browser will retry');
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [user?.id]);
}
