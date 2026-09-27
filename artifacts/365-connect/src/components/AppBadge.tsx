/**
 * Keeps the installed app's icon badge in step with what the tab badges show:
 * unread messages + unread notifications. Uses the Badging API where the
 * browser offers it (installed PWAs on desktop, iOS 16.4+ home-screen apps);
 * everywhere else it is a silent no-op. Renders nothing.
 */
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { useNotifications } from '@/hooks/useNotifications';

type BadgingNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export function setAppBadgeCount(count: number): void {
  const nav = navigator as BadgingNavigator;
  try {
    if (count > 0) void nav.setAppBadge?.(count)?.catch(() => {});
    else void nav.clearAppBadge?.()?.catch(() => {});
  } catch { /* unsupported */ }
}

export function AppBadge() {
  const { user } = useAuth();
  const unreadMessages = useUnreadMessages();
  const { unreadCount: unreadNotifications } = useNotifications();

  useEffect(() => {
    setAppBadgeCount(user ? unreadMessages + unreadNotifications : 0);
  }, [user?.id, unreadMessages, unreadNotifications]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
