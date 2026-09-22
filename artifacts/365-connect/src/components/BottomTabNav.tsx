/**
 * Role-driven bottom tab bar.
 * Workers  → Home | Jobs | Explore | Messages | Profile
 * Clients  → Home | Post Shift | Explore | Messages | Profile
 * Staffers → Home | Post Shift | Explore | Messages | Profile
 * Admin    → null (admin uses the left sidebar instead)
 */
import { Link, useLocation } from 'wouter';
import { Home, Briefcase, Compass, MessageSquare, User, PlusCircle, Users } from 'lucide-react';
import type { ComponentType } from 'react';
import { useRole } from '@/contexts/RoleContext';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { preloadScreen } from '@/lib/lazyRoutes';

/** Which lazy screen each tab opens, so a touch can warm it before the tap lands. */
const SCREEN_FOR_PATH: Record<string, string> = {
  '/jobs':            'JobsScreen',
  '/explore':         'ExploreScreen',
  '/messages':        'MessagesScreen',
  '/profile':         'ProfileScreen',
  '/post-shift/name': 'PostShiftNameScreen',
  '/roster':          'RosterScreen',
};

type Tab = {
  name:        string;
  path:        string;
  /** Path prefix used to determine the active state (covers wizard sub-steps). */
  activeFor:   string;
  icon:        ComponentType<{ size: number; style?: React.CSSProperties }>;
};

const WORKER_TABS: Tab[] = [
  { name: 'Home',     path: '/home',     activeFor: '/home',         icon: Home          },
  { name: 'Jobs',     path: '/jobs',     activeFor: '/jobs',         icon: Briefcase     },
  { name: 'Explore',  path: '/explore',  activeFor: '/explore',      icon: Compass       },
  { name: 'Messages', path: '/messages', activeFor: '/messages',     icon: MessageSquare },
  { name: 'Profile',  path: '/profile',  activeFor: '/profile',      icon: User          },
];

const CLIENT_TABS: Tab[] = [
  { name: 'Home',       path: '/home',             activeFor: '/home',        icon: Home          },
  { name: 'Post Shift', path: '/post-shift/name', activeFor: '/post-shift',  icon: PlusCircle    },
  { name: 'Explore',    path: '/explore',           activeFor: '/explore',     icon: Compass       },
  { name: 'Messages',   path: '/messages',          activeFor: '/messages',    icon: MessageSquare },
  { name: 'Profile',    path: '/profile',           activeFor: '/profile',     icon: User          },
];

// An agency runs on its roster, so it gets a Roster tab; worker discovery
// lives on Home → Browse Workers (and /explore stays reachable from there).
const STAFFER_TABS: Tab[] = [
  { name: 'Home',       path: '/home',                activeFor: '/home',           icon: Home          },
  { name: 'Post Shift', path: '/post-shift/name', activeFor: '/post-shift',  icon: PlusCircle    },
  { name: 'Roster',     path: '/roster',               activeFor: '/roster',         icon: Users         },
  { name: 'Messages',   path: '/messages',             activeFor: '/messages',       icon: MessageSquare },
  { name: 'Profile',    path: '/profile',              activeFor: '/profile',        icon: User          },
];

const ACTIVE_COLOR   = '#0A1628';
const INACTIVE_COLOR = '#6B7280';

export function BottomTabNav() {
  const [location]   = useLocation();
  const { role }     = useRole();
  const unreadMessages = useUnreadMessages();

  // Admin has a sidebar — no bottom bar
  if (role === 'admin') return null;

  const tabs =
    role === 'staffer' ? STAFFER_TABS :
    role === 'client'  ? CLIENT_TABS  :
    WORKER_TABS;

  return (
    <div
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-app pb-safe z-50"
      style={{ background: '#FFFFFF', borderTop: '1px solid #E5E7EB' }}
    >
      <div className="flex justify-around items-center h-[56px]">
        {tabs.map((tab) => {
          const isActive =
            location === tab.activeFor ||
            location.startsWith(tab.activeFor + '/');
          const Icon  = tab.icon;
          const color = isActive ? ACTIVE_COLOR : INACTIVE_COLOR;

          return (
            <Link
              key={tab.path}
              href={tab.path}
              className="flex-1 h-full flex flex-col items-center justify-center gap-[3px] select-none"
              onPointerDown={() => { const s = SCREEN_FOR_PATH[tab.path]; if (s) preloadScreen(s); }}
              aria-label={tab.name}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="relative">
                <Icon size={22} style={{ color }} />
                {tab.path === '/messages' && unreadMessages > 0 && (
                  <span aria-label={`${unreadMessages} unread messages`}
                    className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
                    {unreadMessages > 99 ? '99+' : unreadMessages}
                  </span>
                )}
              </span>
              <span
                className="text-[10px] font-semibold leading-none tracking-wide"
                style={{ color }}
              >
                {tab.name}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
