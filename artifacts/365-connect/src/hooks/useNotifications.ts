import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { onSSE } from '@/lib/sseEmitter';
import type { NotificationRow } from '@/lib/supabase';

type NotificationWithSender = NotificationRow & {
  from_username?: string | null;
  from_photo_url?: string | null;
};

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
  if (n.shift_id) return `/shift/${n.shift_id}`;
  if (n.type === 'new_message') return '/messages';
  return '/notifications';
}

export function useNotifications() {
  const { user } = useAuth();
  const [items, setItems]         = useState<NotificationWithSender[]>([]);
  const [isLoading, setLoading]   = useState(true);
  // Map of user_id → username for sender display
  const [usernames, setUsernames] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!user?.id) { setItems([]); setLoading(false); return; }
    setLoading(true);
    try {
      const rows = await apiClient(user.id).get<NotificationWithSender[]>('/notifications');
      setItems(rows);
      // Build username map from sender info included in response
      const map: Record<string, string> = {};
      for (const r of rows) {
        if (r.from_user_id && r.from_username) {
          map[r.from_user_id] = r.from_username;
        }
      }
      setUsernames(map);
    } catch (e) {
      console.error('[useNotifications] load failed:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  // Live updates: prepend incoming notifications
  useEffect(() => {
    return onSSE<NotificationWithSender>('new_notification', (notification) => {
      setItems((prev) => {
        if (prev.some((n) => n.id === notification.id)) return prev;
        return [notification, ...prev];
      });
    });
  }, []);

  const unreadCount = items.filter((n) => !n.read_at).length;

  const markRead = useCallback(async (id: string) => {
    try {
      await apiClient(user?.id).patch(`/notifications/${id}/read`, {});
      setItems((prev) => prev.map((n) =>
        n.id === id ? { ...n, read_at: new Date().toISOString(), read: true } : n,
      ));
    } catch (e) {
      console.error('[useNotifications] markRead failed:', e);
    }
  }, [user?.id]);

  const markAllRead = useCallback(async () => {
    try {
      await apiClient(user?.id).patch('/notifications/read-all', {});
      setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString(), read: true })));
    } catch (e) {
      console.error('[useNotifications] markAllRead failed:', e);
    }
  }, [user?.id]);

  return { items, isLoading, unreadCount, markRead, markAllRead, refetch: load, usernames };
}
