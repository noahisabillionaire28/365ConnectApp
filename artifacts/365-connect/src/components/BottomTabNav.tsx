/**
 * Role-driven bottom tab bar.
 * Workers  → Home | Jobs | Explore | Messages | Profile
 * Clients  → Home | Post Shift | Explore | Messages | Profile
 * Staffers → Home | Post Shift | Explore | Messages | Profile
 * Admin    → null (admin uses the left sidebar instead)
 */
import { Link, useLocation } from 'wouter';
import { Home, Briefcase, Compass, MessageSquare, User, PlusCircle } from 'lucide-react';
import type { ComponentType } from 'react';
import { useRole } from '@/contexts/RoleContext';

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
  { name: 'Post Shift', path: '/post-shift/step1', activeFor: '/post-shift',  icon: PlusCircle    },
  { name: 'Explore',    path: '/explore',           activeFor: '/explore',     icon: Compass       },
  { name: 'Messages',   path: '/messages',          activeFor: '/messages',    icon: MessageSquare },
  { name: 'Profile',    path: '/profile',           activeFor: '/profile',     icon: User          },
];

const STAFFER_TABS: Tab[] = [
  { name: 'Home',       path: '/home',                activeFor: '/home',           icon: Home          },
  { name: 'Post Shift', path: '/staffer-shift/step1', activeFor: '/staffer-shift',  icon: PlusCircle    },
  { name: 'Explore',    path: '/explore',              activeFor: '/explore',        icon: Compass       },
  { name: 'Messages',   path: '/messages',             activeFor: '/messages',       icon: MessageSquare },
  { name: 'Profile',    path: '/profile',              activeFor: '/profile',        icon: User          },
];

const ACTIVE_COLOR   = '#0A1628';
const INACTIVE_COLOR = '#6B7280';

export function BottomTabNav() {
  const [location]   = useLocation();
  const { role }     = useRole();

  // Admin has a sidebar — no bottom bar
  if (role === 'admin') return null;

  const tabs =
    role === 'staffer' ? STAFFER_TABS :
    role === 'client'  ? CLIENT_TABS  :
    WORKER_TABS;

  return (
    <div
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] pb-safe z-50"
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
              aria-label={tab.name}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={22} style={{ color }} />
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
