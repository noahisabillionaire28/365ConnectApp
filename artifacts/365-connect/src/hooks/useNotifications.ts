import { useEffect, useState, useCallback } from 'react';
import { supabase, type NotificationRow } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

/** "25m ago" / "3h ago" / "2d ago" relative-time formatter for a created_at ISO string. */
export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins   = Math.floor(diffMs / 60_000);
  if (mins < 1)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)   return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Notification types whose deep link should go to the sender's public profile. */
const PROFILE_LINK_TYPES = new Set(['new_review', 'new_follower']);
/** Notification types that should route to the "who applied" screen instead of plain shift detail. */
const APPLICANTS_LINK_TYPES = new Set(['application_received']);

/** Resolves where tapping a notification should navigate to, given a username lookup map. */
export function notificationDeepLink(item: NotificationRow, usernames: Map<string, string>): string | null {
  if (PROFILE_LINK_TYPES.has(item.type) && item.from_user_id) {
    const username = usernames.get(item.from_user_id);
    return username ? `/worker/${username}` : null;
  }
  // A worker was personally requested for a shift — they respond from the requests list,
  // since they could have several pending requests at once (not just this one shift).
  if (item.type === 'direct_shift_request') return '/requests';
  if (item.shift_id && APPLICANTS_LINK_TYPES.has(item.type)) return `/shift/${item.shift_id}/applicants`;
  if (item.shift_id) return `/shift/${item.shift_id}`;
  return null;
}

/** Real notifications for the current user, populated by DB triggers. */
export function useNotifications() {
  const { user } = useAuth();
  const [items, setItems]         = useState<NotificationRow[]>([]);
  const [usernames, setUsernames] = useState<Map<string, string>>(new Map());
  const [isLoading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) { setItems([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      console.error('[useNotifications] fetch failed:', error.message);
      setItems([]);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as NotificationRow[];
    setItems(rows);

    const fromIds = [...new Set(rows.map((n) => n.from_user_id).filter((id): id is string => !!id))];
    if (fromIds.length > 0) {
      const { data: users } = await supabase.from('users').select('id, username').in('id', fromIds);
      setUsernames(new Map((users ?? []).filter((u) => u.username).map((u) => [u.id, u.username as string])));
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on<NotificationRow>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => setItems((prev) => [payload.new, ...prev]),
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id]);

  const unreadCount = items.filter((n) => !n.read_at).length;

  async function markRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n)));
    const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null);
    if (error) console.error('[useNotifications] markRead failed:', error.message);
  }

  async function markAllRead() {
    if (!user?.id || unreadCount === 0) return;
    const nowIso = new Date().toISOString();
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? nowIso })));
    const { error } = await supabase.from('notifications').update({ read_at: nowIso }).eq('user_id', user.id).is('read_at', null);
    if (error) console.error('[useNotifications] markAllRead failed:', error.message);
  }

  return { items, usernames, isLoading, unreadCount, markRead, markAllRead, refetch: load };
}
