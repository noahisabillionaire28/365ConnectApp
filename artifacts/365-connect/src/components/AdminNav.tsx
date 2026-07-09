/**
 * Admin navigation — fixed top bar (60 px) + slide-out drawer on mobile.
 * Designed for 390 px mobile; works the same on wider viewports.
 */
import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, Users, Briefcase, AlertTriangle,
  DollarSign, Settings, LogOut, ShieldCheck, Menu, X,
} from 'lucide-react';
import { adminLogout } from '@/store/adminStore';

const NAVY   = '#0A1628';
const ACTIVE = '#1E3A5F';

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
  const [open, setOpen]      = useState(false);

  function handleLogout() {
    setOpen(false);
    adminLogout().then(() => navigate('/admin/login'));
  }

  return (
    <>
      {/* ── Fixed top bar ────────────────────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4"
        style={{ height: 60, background: NAVY }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0"
            style={{ background: ACTIVE }}
          >
            <ShieldCheck size={15} className="text-white" aria-hidden />
          </div>
          <div>
            <p className="text-white font-bold text-[14px] leading-tight tracking-tight">365 Connect</p>
            <p className="text-white/50 text-[10px] font-medium uppercase tracking-[0.14em]">Admin Panel</p>
          </div>
        </div>

        {/* Hamburger */}
        <button
          type="button"
          aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="w-10 h-10 rounded-[8px] flex items-center justify-center transition-colors"
          style={{ background: open ? ACTIVE : 'transparent' }}
        >
          {open
            ? <X    size={20} className="text-white" aria-hidden />
            : <Menu size={20} className="text-white" aria-hidden />}
        </button>
      </header>

      {/* ── Slide-out drawer ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              aria-hidden
              onClick={() => setOpen(false)}
            />

            {/* Drawer panel */}
            <motion.nav
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 36 }}
              className="fixed top-0 left-0 bottom-0 z-50 flex flex-col w-[280px]"
              style={{ background: NAVY }}
              aria-label="Admin navigation"
            >
              {/* Drawer header */}
              <div
                className="flex items-center justify-between px-5 flex-shrink-0"
                style={{ height: 60, borderBottom: `1px solid ${ACTIVE}` }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-[8px] flex items-center justify-center" style={{ background: ACTIVE }}>
                    <ShieldCheck size={15} className="text-white" aria-hidden />
                  </div>
                  <p className="text-white font-bold text-[14px]">365 Connect</p>
                </div>
                <button
                  type="button" aria-label="Close menu" onClick={() => setOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: ACTIVE }}
                >
                  <X size={14} className="text-white" aria-hidden />
                </button>
              </div>

              {/* Nav items */}
              <div className="flex-1 flex flex-col gap-1 px-3 py-4 overflow-y-auto">
                {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
                  const active = location === path || location.startsWith(path + '/');
                  return (
                    <Link
                      key={path} href={path}
                      onClick={() => setOpen(false)}
                      aria-label={label}
                      aria-current={active ? 'page' : undefined}
                      className="flex items-center gap-3 px-3 h-[48px] rounded-[10px] transition-colors"
                      style={{ background: active ? ACTIVE : 'transparent' }}
                    >
                      <Icon
                        size={18} aria-hidden
                        style={{ color: active ? '#FFFFFF' : 'rgba(255,255,255,0.55)', flexShrink: 0 }}
                      />
                      <span
                        className="text-[15px] font-semibold"
                        style={{ color: active ? '#FFFFFF' : 'rgba(255,255,255,0.55)' }}
                      >
                        {label}
                      </span>
                    </Link>
                  );
                })}
              </div>

              {/* Logout */}
              <div className="px-3 py-4 flex-shrink-0" style={{ borderTop: `1px solid ${ACTIVE}` }}>
                <button
                  type="button" aria-label="Log out" onClick={handleLogout}
                  className="flex items-center gap-3 px-3 h-[48px] w-full rounded-[10px] transition-colors"
                  style={{ background: 'transparent' }}
                >
                  <LogOut size={18} aria-hidden style={{ color: 'rgba(255,255,255,0.55)', flexShrink: 0 }} />
                  <span className="text-[15px] font-semibold" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    Log out
                  </span>
                </button>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
