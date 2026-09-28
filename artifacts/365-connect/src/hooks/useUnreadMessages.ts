/**
 * Total unread messages across all threads — drives the Messages tab badge
 * and the app icon badge. One react-query entry shared by every mount (the
 * tab bar and the badge hook both read it, so it is fetched once), refreshed
 * on SSE conversation updates and polled every 30 s while the tab is visible.
 */
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { onSSE } from '@/lib/sseEmitter';

const UNREAD_KEY = 'unread-count';

export function useUnreadMessages(): number {
  const { user } = useAuth();
  const qc = useQueryClient();

  const q = useQuery<number>({
    queryKey:  [UNREAD_KEY, user?.id ?? 'anon'],
    enabled:   !!user?.id,
    staleTime: 30_000,
    refetchInterval: () => (typeof document !== 'undefined' && document.visibilityState === 'visible' ? 30_000 : false),
    queryFn: async () => {
      const r = await apiClient(user!.id).get<{ total: number }>('/conversations/unread-count');
      return r.total ?? 0;
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    const refresh = () => { void qc.invalidateQueries({ queryKey: [UNREAD_KEY] }); };
    const off  = onSSE('conversation_update', refresh);
    const off2 = onSSE('new_message', refresh);
    return () => { off(); off2(); };
  }, [qc, user?.id]);

  return user?.id ? (q.data ?? 0) : 0;
}
