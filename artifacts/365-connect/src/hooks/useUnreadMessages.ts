/**
 * Total unread messages across all threads — drives the Messages tab badge.
 * Refreshes on SSE conversation updates and polls as a fallback.
 */
import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { onSSE } from '@/lib/sseEmitter';

let cached = 0;
const listeners = new Set<(n: number) => void>();
function publish(n: number) { cached = n; for (const l of listeners) l(n); }

export function useUnreadMessages(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(cached);

  const load = useCallback(async () => {
    if (!user?.id) { publish(0); return; }
    try {
      const r = await apiClient(user.id).get<{ total: number }>('/conversations/unread-count');
      publish(r.total ?? 0);
    } catch { /* keep last value */ }
  }, [user?.id]);

  useEffect(() => {
    listeners.add(setCount);
    void load();
    const off = onSSE('conversation_update', () => { void load(); });
    const off2 = onSSE('new_message', () => { void load(); });
    const t = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 30_000);
    return () => { listeners.delete(setCount); off(); off2(); clearInterval(t); };
  }, [load]);

  return count;
}
