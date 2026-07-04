import { Link, useLocation } from 'wouter';
import { LayoutDashboard, Users, Briefcase, AlertTriangle, LogOut, ShieldCheck } from 'lucide-react';
import { adminLogout } from '@/store/adminStore';

const TABS = [
  { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/admin/users',     icon: Users,           label: 'Users'     },
  { path: '/admin/shifts',    icon: Briefcase,       label: 'Shifts'    },
  { path: '/admin/disputes',  icon: AlertTriangle,   label: 'Disputes'  },
];

export function AdminNav() {
  const [location, navigate] = useLocation();

  function handleLogout() {
    adminLogout();
    navigate('/admin/login');
  }

  return (
    <header className="sticky top-0 z-50 bg-[#020202] border-b border-[#1A1A1A]">
      {/* Brand row */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-[#111]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-[5px] bg-primary flex items-center justify-center">
            <ShieldCheck size={13} aria-hidden className="text-black" />
          </div>
          <span className="text-white font-bold text-[14px] tracking-tight">
            365 <span className="text-primary">Admin</span>
          </span>
        </div>
        <button
          type="button"
          aria-label="Log out of admin panel"
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-[#555] text-[12px] font-medium active:text-[#888] transition-colors"
        >
          <LogOut size={13} aria-hidden />
          Logout
        </button>
      </div>

      {/* Tab row */}
      <nav aria-label="Admin navigation" className="flex">
        {TABS.map(({ path, icon: Icon, label }) => {
          const active = location === path || location.startsWith(path);
          return (
            <Link
              key={path}
              href={path}
              aria-label={`Go to ${label}`}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-12 relative transition-colors ${
                active ? 'text-primary' : 'text-[#444] hover:text-[#666]'
              }`}
            >
              {active && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-primary rounded-t-full" />
              )}
              <Icon size={17} aria-hidden />
              <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
