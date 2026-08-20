/* ─── Admin auth (backed by the Supabase JWT + role check via API) ──────────── */
import { apiClient } from '@/lib/api';
import { supabase } from '@/lib/supabase';

let _adminAuthenticated = false;

/** Synchronous read — reflects the last resolved session check. */
export function isAdminAuthenticated(): boolean {
  return _adminAuthenticated;
}

/**
 * Call on every admin page mount to restore session state after a hard refresh.
 * Returns true if the current Supabase session belongs to a user with role='admin'.
 */
export async function initAdminSession(): Promise<boolean> {
  try {
    const profile = await apiClient(null).get<{ role?: string }>('/users/me');
    _adminAuthenticated = profile?.role === 'admin';
    return _adminAuthenticated;
  } catch {
    _adminAuthenticated = false;
    return false;
  }
}

/**
 * Admin users sign in via the standard Supabase flow (/login).
 * Kept for backwards compat with AdminLogin.tsx.
 */
export async function adminLogin(_email: string, _password: string): Promise<boolean> {
  window.location.href = '/login';
  return false;
}

/** Signs out via Supabase and clears local admin session state. */
export async function adminLogout(): Promise<void> {
  _adminAuthenticated = false;
  try { await supabase.auth.signOut(); } catch { /* ignore */ }
}
