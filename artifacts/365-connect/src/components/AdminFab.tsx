import { useLocation } from 'wouter';
import { ShieldCheck } from 'lucide-react';
import { useRole } from '@/contexts/RoleContext';

/**
 * Floating "Admin" button shown inside the app for admin-capable accounts.
 *
 * Lets an admin who is browsing the app as a normal user jump straight back to
 * the admin dashboard. Hidden on admin routes and on the auth/onboarding flow.
 */
export function AdminFab() {
  const { isAdmin } = useRole();
  const [location, navigate] = useLocation();

  if (!isAdmin) return null;

  // Hide within the admin panel and on pre-login / onboarding screens.
  const hiddenPrefixes = ['/admin', '/login', '/signup', '/phone-auth', '/reset-password', '/auth', '/role-select', '/onboarding'];
  if (location === '/' || hiddenPrefixes.some((p) => location === p || location.startsWith(p + '/'))) {
    return null;
  }

  return (
    <button type="button" onClick={() => navigate('/admin/dashboard')}
      aria-label="Go to admin dashboard"
      className="fixed bottom-[72px] left-4 z-40 h-11 pl-3 pr-4 rounded-full bg-[#0A1628] text-white shadow-lg flex items-center gap-2 active:scale-95 transition-transform">
      <ShieldCheck size={17} aria-hidden />
      <span className="text-[13px] font-bold">Admin</span>
    </button>
  );
}
