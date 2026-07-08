import { motion } from 'framer-motion';
import { MapPin, CheckCheck, XCircle, Bell } from 'lucide-react';
import { useLocation } from 'wouter';
import { BottomTabNav } from '@/components/BottomTabNav';
import { useNotifications, relativeTime } from '@/hooks/useNotifications';
import type { NotificationRow as NotificationRowType } from '@/lib/supabase';

type IconColor = 'blue' | 'green' | 'red';

const ICON_META: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; color: IconColor }> = {
  application_received: { icon: MapPin,     color: 'blue'  },
  application_accepted: { icon: CheckCheck, color: 'green' },
  application_declined: { icon: XCircle,    color: 'red'   },
};

const COLOR_CLASSES: Record<IconColor, { bg: string; icon: string }> = {
  blue:  { bg: 'bg-blue-50 border-blue-200',       icon: 'text-[#0095F6]' },
  green: { bg: 'bg-emerald-50 border-emerald-200', icon: 'text-emerald-600' },
  red:   { bg: 'bg-red-50 border-red-200',         icon: 'text-[#EF4444]' },
};

function SystemAvatar({ type }: { type: string }) {
  const meta   = ICON_META[type] ?? ICON_META.application_received;
  const styles = COLOR_CLASSES[meta.color];
  const Icon   = meta.icon;
  return (
    <div className={`w-11 h-11 rounded-full border flex items-center justify-center flex-shrink-0 ${styles.bg}`} aria-hidden>
      <Icon size={19} className={styles.icon} />
    </div>
  );
}

function NotificationCard({ item, index, onOpen }: { item: NotificationRowType; index: number; onOpen: () => void }) {
  return (
    <motion.button
      type="button" onClick={onOpen}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: index * 0.04, ease: 'easeOut' }}
      className={`w-full flex items-start gap-3 px-4 py-3.5 border-b border-[#DBDBDB] text-left transition-colors ${
        item.read ? 'bg-white' : 'bg-[#F0F7FF]'
      }`}
      role="listitem" aria-label={item.title}
    >
      <div className="w-2 flex-shrink-0 flex items-center justify-center self-center">
        {!item.read && <div aria-label="Unread" className="w-2 h-2 rounded-full bg-[#0095F6]" />}
      </div>
      <SystemAvatar type={item.type} />
      <div className="flex-1 min-w-0">
        <p className="text-black font-semibold text-[14px] leading-[1.4]">{item.title}</p>
        {item.body && <p className="text-[#737373] text-[13px] leading-[1.4] mt-0.5">{item.body}</p>}
        <p className="text-[#AAAAAA] text-[12px] font-medium mt-1">{relativeTime(item.created_at)}</p>
      </div>
    </motion.button>
  );
}

function SectionHeader({ label, showMarkRead, onMarkRead }: {
  label: string; showMarkRead?: boolean; onMarkRead?: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 pt-5 pb-2">
      <p className="text-[#737373] text-[11px] font-bold uppercase tracking-[0.18em]">{label}</p>
      {showMarkRead && (
        <button type="button" aria-label="Mark all notifications as read" onClick={onMarkRead}
          className="text-[#0095F6] text-[12px] font-semibold active:opacity-60 transition-opacity">
          Mark all as read
        </button>
      )}
    </div>
  );
}

function NotificationsSkeleton() {
  return (
    <div className="flex flex-col gap-0" aria-hidden>
      {[1, 2, 3, 4].map((n) => (
        <div key={n} className="flex items-start gap-3 px-4 py-3.5 border-b border-[#DBDBDB]">
          <div className="w-11 h-11 rounded-full bg-[#EFEFEF] animate-pulse flex-shrink-0" />
          <div className="flex-1 flex flex-col gap-2 pt-1">
            <div className="w-3/4 h-3.5 rounded bg-[#EFEFEF] animate-pulse" />
            <div className="w-1/3 h-3 rounded bg-[#EFEFEF] animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function isThisWeek(iso: string): boolean {
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  return days >= 1;
}

export function NotificationsScreen() {
  const [, navigate] = useLocation();
  const { items, isLoading, unreadCount, markAllRead } = useNotifications();

  const today = items.filter((n) => !isThisWeek(n.created_at));
  const week  = items.filter((n) => isThisWeek(n.created_at));

  function handleOpen(item: NotificationRowType) {
    if (item.related_shift_id) navigate(`/shift/${item.related_shift_id}`);
  }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      {/* Header */}
      <div className="px-4 pt-[52px] pb-3 border-b border-[#DBDBDB] bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-black font-bold text-[22px] tracking-tight">Notifications</h1>
            {unreadCount > 0 && (
              <span aria-label={`${unreadCount} unread notifications`}
                className="min-w-[20px] h-5 rounded-full bg-[#0095F6] flex items-center justify-center px-1.5">
                <span className="text-white text-[11px] font-bold leading-none">{unreadCount}</span>
              </span>
            )}
          </div>
          <button type="button" aria-label="Notification settings"
            className="w-9 h-9 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center active:opacity-60 transition-opacity">
            <Bell size={15} aria-hidden className="text-[#737373]" />
          </button>
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto pb-[64px]" role="list" aria-label="Notifications">
        {isLoading ? (
          <NotificationsSkeleton />
        ) : items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center">
              <Bell size={26} aria-hidden className="text-[#737373]" />
            </div>
            <p className="text-black font-semibold text-[16px]">No notifications yet</p>
            <p className="text-[#737373] text-[13px]">
              You'll see updates here when someone messages you or reviews your applications.
            </p>
          </div>
        ) : (
          <>
            {today.length > 0 && (
              <>
                <SectionHeader label="Today" showMarkRead={unreadCount > 0} onMarkRead={markAllRead} />
                {today.map((item, i) => (
                  <NotificationCard key={item.id} item={item} index={i} onOpen={() => handleOpen(item)} />
                ))}
              </>
            )}
            {week.length > 0 && (
              <>
                <SectionHeader label="This Week" showMarkRead={today.length === 0 && unreadCount > 0} onMarkRead={markAllRead} />
                {week.map((item, i) => (
                  <NotificationCard key={item.id} item={item} index={today.length + i} onOpen={() => handleOpen(item)} />
                ))}
              </>
            )}
          </>
        )}
      </div>

      <BottomTabNav />
    </div>
  );
}
