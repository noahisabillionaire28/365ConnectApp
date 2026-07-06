import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  MapPin, AlarmClock, DollarSign, Star,
  CheckCheck, UserPlus, Bell,
} from 'lucide-react';
import { BottomTabNav } from '@/components/BottomTabNav';
import {
  MOCK_NOTIFICATIONS,
  type NotificationItem,
  type Segment,
  type NotificationType,
} from '@/data/mockNotifications';

/* ── Rich text renderer ────────────────────────────────────────────────────── */
function RichDescription({ segments }: { segments: Segment[] }) {
  return (
    <span>
      {segments.map((seg, i) => {
        if (seg.mention) {
          return <span key={i} className="text-[#0095F6] font-semibold">{seg.text}</span>;
        }
        if (seg.strong) {
          return <span key={i} className="text-black font-bold">{seg.text}</span>;
        }
        return <span key={i} className="text-[#737373]">{seg.text}</span>;
      })}
    </span>
  );
}

/* ── Icon avatar ────────────────────────────────────────────────────────────── */
type IconColor = 'amber' | 'green' | 'gold' | 'blue';

const ICON_META: Record<
  NotificationType,
  { icon: React.ComponentType<{ size?: number; className?: string }>; color: IconColor }
> = {
  'new-shift':      { icon: MapPin,     color: 'gold'  },
  'shift-accepted': { icon: CheckCheck, color: 'green' },
  'shift-applied':  { icon: UserPlus,   color: 'blue'  },
  'shift-reminder': { icon: AlarmClock, color: 'amber' },
  'payment':        { icon: DollarSign, color: 'green' },
  'review':         { icon: Star,       color: 'gold'  },
};

const COLOR_CLASSES: Record<IconColor, { bg: string; icon: string }> = {
  amber: { bg: 'bg-amber-50  border-amber-200',  icon: 'text-amber-500'   },
  green: { bg: 'bg-emerald-50 border-emerald-200', icon: 'text-emerald-600' },
  gold:  { bg: 'bg-black/5   border-black/10',    icon: 'text-black'       },
  blue:  { bg: 'bg-blue-50   border-blue-200',    icon: 'text-[#0095F6]'   },
};

function SystemAvatar({ type, colorOverride }: { type: NotificationType; colorOverride?: string }) {
  const meta   = ICON_META[type];
  const color  = (colorOverride as IconColor) ?? meta.color;
  const styles = COLOR_CLASSES[color] ?? COLOR_CLASSES.gold;
  const Icon   = meta.icon;
  return (
    <div className={`w-11 h-11 rounded-full border flex items-center justify-center flex-shrink-0 ${styles.bg}`} aria-hidden>
      <Icon size={19} className={styles.icon} />
    </div>
  );
}

function PersonAvatar({ url, alt }: { url: string; alt: string }) {
  return (
    <img src={url} alt={alt} loading="lazy" decoding="async"
      className="w-11 h-11 rounded-full object-cover border border-[#DBDBDB] flex-shrink-0" />
  );
}

/* ── Star strip ─────────────────────────────────────────────────────────────── */
function StarStrip({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5 flex-shrink-0" aria-label={`${count} stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={11} aria-hidden
          className={i < count ? 'text-amber-400 fill-amber-400' : 'text-[#DBDBDB] fill-[#DBDBDB]'} />
      ))}
    </div>
  );
}

/* ── Notification row ───────────────────────────────────────────────────────── */
function NotificationRow({ item, index }: { item: NotificationItem; index: number }) {
  const hasPerson = !!item.actorPhoto;
  const hasThumb  = !!item.shiftThumb;
  const hasStars  = typeof item.stars === 'number';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: index * 0.04, ease: 'easeOut' }}
      className={`flex items-start gap-3 px-4 py-3.5 border-b border-[#DBDBDB] transition-colors ${
        item.unread ? 'bg-[#F0F7FF]' : 'bg-white'
      }`}
      role="listitem"
      aria-label={item.segments.map((s) => s.text).join('')}
    >
      {/* Unread dot */}
      <div className="w-2 flex-shrink-0 flex items-center justify-center self-center">
        {item.unread && <div aria-label="Unread" className="w-2 h-2 rounded-full bg-[#0095F6]" />}
      </div>

      {hasPerson
        ? <PersonAvatar url={item.actorPhoto!} alt="Sender" />
        : <SystemAvatar type={item.type} colorOverride={item.iconColor} />}

      <div className="flex-1 min-w-0">
        <p className="text-[14px] leading-[1.5]">
          <RichDescription segments={item.segments} />
        </p>
        <p className="text-[#737373] text-[12px] font-medium mt-1">{item.timestamp}</p>
        {hasStars && (
          <div className="mt-1.5"><StarStrip count={item.stars!} /></div>
        )}
      </div>

      {hasThumb && (
        <div className="flex-shrink-0 w-[52px] h-[52px] rounded-[8px] overflow-hidden border border-[#DBDBDB]">
          <img src={item.shiftThumb} alt="Shift venue" loading="lazy" decoding="async"
            className="w-full h-full object-cover" />
        </div>
      )}
    </motion.div>
  );
}

/* ── Section header ─────────────────────────────────────────────────────────── */
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

/* ── NotificationsScreen ────────────────────────────────────────────────────── */
export function NotificationsScreen() {
  const [readAll, setReadAll] = useState(false);

  const today = MOCK_NOTIFICATIONS.filter((n) => n.section === 'today');
  const week  = MOCK_NOTIFICATIONS.filter((n) => n.section === 'week');

  const todayUnread = !readAll && today.some((n) => n.unread);
  const totalUnread = readAll ? 0 : MOCK_NOTIFICATIONS.filter((n) => n.unread).length;

  function withReadState(item: NotificationItem): NotificationItem {
    return readAll ? { ...item, unread: false } : item;
  }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      {/* Header */}
      <div className="px-4 pt-[52px] pb-3 border-b border-[#DBDBDB] bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-black font-bold text-[22px] tracking-tight">Notifications</h1>
            {totalUnread > 0 && (
              <span aria-label={`${totalUnread} unread notifications`}
                className="min-w-[20px] h-5 rounded-full bg-[#0095F6] flex items-center justify-center px-1.5">
                <span className="text-white text-[11px] font-bold leading-none">{totalUnread}</span>
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
        <SectionHeader label="Today" showMarkRead={todayUnread} onMarkRead={() => setReadAll(true)} />
        {today.map((item, i) => (
          <NotificationRow key={item.id} item={withReadState(item)} index={i} />
        ))}

        <SectionHeader label="This Week" />
        {week.map((item, i) => (
          <NotificationRow key={item.id} item={withReadState(item)} index={today.length + i} />
        ))}
      </div>

      <BottomTabNav />
    </div>
  );
}
