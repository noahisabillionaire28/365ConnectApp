/**
 * Admin left sidebar — full-height dark navy #0A1628.
 * Items: Dashboard | Users | Shifts | Disputes | Revenue | Settings
 * Active item background: #1E3A5F
 * All text/icons: white (dimmed when inactive)
 */
import { Link, useLocation } from 'wouter';
import {
  LayoutDashboard, Users, Briefcase, AlertTriangle,
  DollarSign, Settings, LogOut, ShieldCheck,
} from 'lucide-react';
import { adminLogout } from '@/store/adminStore';

const NAVY   = '#0A1628';
const ACTIVE = '#1E3A5F';
const WHITE  = '#FFFFFF';
const DIM    = 'rgba(255,255,255,0.55)';

const NAV_ITEMS = [
  { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/admin/users',     icon: Users,           label: 'Users'     },
  { path: '/admin/shifts',    icon: Briefcase,       label: 'Shifts'    },
  { path: '/admin/disputes',  icon: AlertTriangle,   label: 'Disputes'  },
  { path: '/admin/revenue',   icon: DollarSign,      label: 'Revenue'   },
  { path: '/admin/settings',  icon: Settings,        label: 'Settings'  },
];

export function AdminNav() {
  const [location, navigate] = useLocation();

  function handleLogout() {
    adminLogout();
    navigate('/admin/login');
  }

  return (
    <aside
      className="flex flex-col h-screen w-[220px] flex-shrink-0 sticky top-0"
      style={{ background: NAVY, fontFamily: "'Space Grotesk', sans-serif" }}
      aria-label="Admin sidebar"
    >
      {/* Brand */}
      <div
        className="flex items-center gap-3 px-5 h-[64px] flex-shrink-0"
        style={{ borderBottom: `1px solid ${ACTIVE}` }}
      >
        <div
          className="w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0"
          style={{ background: ACTIVE }}
        >
          <ShieldCheck size={16} style={{ color: WHITE }} aria-hidden />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-[15px] leading-tight truncate" style={{ color: WHITE }}>
            365 Connect
          </div>
          <div className="text-[11px] font-medium" style={{ color: DIM }}>
            Admin Panel
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 px-3 py-4 overflow-y-auto" aria-label="Admin navigation">
        {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
          const active = location === path || location.startsWith(path + '/');
          return (
            <Link
              key={path}
              href={path}
              className="flex items-center gap-3 px-3 h-[44px] rounded-[8px] transition-colors"
              style={{ background: active ? ACTIVE : 'transparent' }}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
            >
              <Icon
                size={18}
                aria-hidden
                style={{ color: active ? WHITE : DIM, flexShrink: 0 }}
              />
              <span
                className="text-[14px] font-semibold truncate"
                style={{ color: active ? WHITE : DIM }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 flex-shrink-0" style={{ borderTop: `1px solid ${ACTIVE}` }}>
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 h-[44px] w-full rounded-[8px] transition-colors"
          style={{ background: 'transparent' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = ACTIVE)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          aria-label="Log out of admin panel"
        >
          <LogOut size={18} aria-hidden style={{ color: DIM, flexShrink: 0 }} />
          <span className="text-[14px] font-semibold" style={{ color: DIM }}>
            Log out
          </span>
        </button>
      </div>
    </aside>
  );
}
