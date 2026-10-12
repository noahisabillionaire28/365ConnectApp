import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { initAdminSession, isAdminAuthenticated } from '@/store/adminStore';

/**
 * Admin page guard. Renders straight away when the admin check already passed
 * in this tab (in-app navigation), and otherwise re-checks the session on mount
 * and re-renders once it resolves, so a page opened by URL or refreshed shows
 * up instead of staying blank. Non-admins are sent to the admin login.
 */
export function useAdminGate(): boolean {
  const [, navigate] = useLocation();
  const [ready, setReady] = useState(isAdminAuthenticated);

  useEffect(() => {
    let alive = true;
    void initAdminSession().then((ok) => {
      if (!alive) return;
      if (ok) setReady(true);
      else navigate('/admin/login');
    });
    return () => { alive = false; };
  }, [navigate]);

  return ready;
}
