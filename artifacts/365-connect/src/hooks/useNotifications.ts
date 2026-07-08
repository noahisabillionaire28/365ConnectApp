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

/** Real notifications for the current user, populated by DB triggers on `applications`. */
export function useNotifications() {
  const { user } = useAuth();
  const [items, setItems]       = useState<NotificationRow[]>([]);
  const [isLoading, setLoading] = useState(true);

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
    } else {
      setItems((data ?? []) as NotificationRow[]);
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

  const unreadCount = items.filter((n) => !n.read).length;

  async function markAllRead() {
    if (!user?.id || unreadCount === 0) return;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    if (error) console.error('[useNotifications] markAllRead failed:', error.message);
  }

  return { items, isLoading, unreadCount, markAllRead, refetch: load };
}
