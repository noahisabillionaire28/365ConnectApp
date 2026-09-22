import { useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { onSSE } from '@/lib/sseEmitter';
import type { NotificationRow } from '@/lib/supabase';

type NotificationWithSender = NotificationRow & {
  from_username?: string | null;
  from_photo_url?: string | null;
};

export const NOTIFICATIONS_KEY = 'notifications';

/** ms → human-readable relative time */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60)  return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Map a notification type + metadata to a deep-link path */
export function notificationDeepLink(
  n: NotificationRow,
  /** optional usernames map (ignored — route is built from n.shift_id / n.type) */
  _usernames?: Record<string, string>,
): string {
  // A booking (worker accepted for a shift) sends the worker to their home.
  if (n.type === 'booking') return '/home';
  // A shift offer is accepted/declined on the Home → Requests tab, not on the
  // shift page (which would only show "Apply").
  if (n.type === 'shift_invite' || n.type === 'direct_shift_request') return '/home?tab=requests';
  if (n.post_id) return `/post/${n.post_id}`;
  // A new applicant is handled on the applicants list, not the shift page.
  if (n.shift_id && (n.type === 'application_received' || n.type === 'new_application' || n.type === 'application')) {
    return `/shift/${n.shift_id}/applicants`;
  }
  if (n.shift_id) return `/shift/${n.shift_id}`;
  if (n.type === 'new_message') return '/messages';
  return '/notifications';
}

/**
 * The viewer's notifications, cached in react-query so the screen paints
 * instantly from the last snapshot and refreshes in the background.
 */
export function useNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = [NOTIFICATIONS_KEY, user?.id];

  const q = useQuery<NotificationWithSender[], Error>({
    queryKey: key,
    enabled: !!user?.id,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
    queryFn: () => apiClient(user!.id).get<NotificationWithSender[]>('/notifications'),
  });
  const items = useMemo(() => q.data ?? [], [q.data]);

  const setItems = useCallback((fn: (prev: NotificationWithSender[]) => NotificationWithSender[]) => {
    qc.setQueryData<NotificationWithSender[]>(key, (prev) => fn(prev ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Map of user_id → username for sender display
  const usernames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of items) {
      if (r.from_user_id && r.from_username) map[r.from_user_id] = r.from_username;
    }
    return map;
  }, [items]);

  // Live updates: prepend incoming notifications
  useEffect(() => {
    return onSSE<NotificationWithSender>('new_notification', (notification) => {
      setItems((prev) => {
        if (prev.some((n) => n.id === notification.id)) return prev;
        return [notification, ...prev];
      });
    });
  }, [setItems]);

  const unreadCount = items.filter((n) => !n.read_at).length;

  const markRead = useCallback(async (id: string) => {
    setItems((prev) => prev.map((n) =>
      n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString(), read: true } : n,
    ));
    try {
      await apiClient(user?.id).patch(`/notifications/${id}/read`, {});
    } catch (e) {
      console.error('[useNotifications] markRead failed:', e);
    }
  }, [user?.id, setItems]);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString(), read: true })));
    try {
      await apiClient(user?.id).patch('/notifications/read-all', {});
    } catch (e) {
      console.error('[useNotifications] markAllRead failed:', e);
    }
  }, [user?.id, setItems]);

  const refetch = useCallback(async () => { await q.refetch(); }, [q.refetch]);

  return {
    items,
    isLoading: !!user?.id && q.isLoading,
    unreadCount,
    markRead,
    markAllRead,
    refetch,
    usernames,
  };
}
