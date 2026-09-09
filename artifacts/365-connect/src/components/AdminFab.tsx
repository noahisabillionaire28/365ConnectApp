import { useState } from 'react';
import { useLocation } from 'wouter';
import { ShieldCheck, LayoutDashboard, X, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRole, type PreviewRole } from '@/contexts/RoleContext';

const ROLES: { key: PreviewRole; label: string }[] = [
  { key: 'worker',  label: 'Worker'  },
  { key: 'client',  label: 'Client'  },
  { key: 'staffer', label: 'Staffer' },
];

/**
 * Floating admin control shown inside the app for admin accounts.
 *
 * Collapsed: a small "Admin" pill. Expanded: switch which role the app is
 * viewed as (worker / client / staffer) and jump back to the admin dashboard.
 * Hidden on admin routes and on the auth / onboarding flow.
 */
export function AdminFab() {
  const { isAdmin, previewRole, setPreviewRole } = useRole();
  const [location, navigate] = useLocation();
  const [open, setOpen] = useState(false);

  if (!isAdmin) return null;

  const hiddenPrefixes = ['/admin', '/login', '/signup', '/phone-auth', '/reset-password', '/auth', '/role-select', '/onboarding'];
  if (location === '/' || hiddenPrefixes.some((p) => location === p || location.startsWith(p + '/'))) {
    return null;
  }

  return (
    <div className="fixed bottom-[72px] left-4 z-40">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.16 }}
            className="absolute bottom-[52px] left-0 w-[210px] bg-white border border-[#DBDBDB] rounded-[14px] shadow-xl overflow-hidden"
          >
            <div className="px-3.5 pt-3 pb-2">
              <p className="text-[#737373] text-[10px] font-bold uppercase tracking-[0.14em]">Viewing app as</p>
            </div>
            <div className="px-2 pb-2 flex flex-col">
              {ROLES.map((r) => {
                const active = previewRole === r.key;
                return (
                  <button key={r.key} type="button"
                    onClick={() => setPreviewRole(r.key)}
                    className={`flex items-center justify-between px-2.5 h-[40px] rounded-[8px] text-[14px] font-semibold ${
                      active ? 'bg-[#0A1628] text-white' : 'text-[#111827] hover:bg-[#FAFAFA]'
                    }`}>
                    {r.label}
                    {active && <Check size={15} aria-hidden />}
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={() => navigate('/admin/dashboard')}
              className="w-full flex items-center gap-2 px-3.5 h-[46px] border-t border-[#EFEFEF] text-[#2563EB] text-[14px] font-bold">
              <LayoutDashboard size={16} aria-hidden />
              Admin Dashboard
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <button type="button" onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close admin menu' : 'Open admin menu'} aria-expanded={open}
        className="h-11 pl-3 pr-4 rounded-full bg-[#0A1628] text-white shadow-lg flex items-center gap-2 active:scale-95 transition-transform">
        {open ? <X size={17} aria-hidden /> : <ShieldCheck size={17} aria-hidden />}
        <span className="text-[13px] font-bold capitalize">
          {open ? 'Close' : `Admin · ${previewRole}`}
        </span>
      </button>
    </div>
  );
}
