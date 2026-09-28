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
    const profile = await apiClient(null).get<{ role?: string; is_admin?: boolean }>('/users/me');
    // Admin is a capability: the is_admin flag OR the legacy role='admin'.
    _adminAuthenticated = profile?.is_admin === true || profile?.role === 'admin';
    return _adminAuthenticated;
  } catch {
    _adminAuthenticated = false;
    return false;
  }
}

export type AdminLoginResult =
  | { ok: true }
  | { ok: false; reason: 'credentials' | 'not_admin' | 'network' };

/**
 * Sign in with email + password on the admin login form, then confirm the
 * account can use the panel. A valid login that is not an admin is signed
 * out again so the session never lingers on the panel's origin.
 */
export async function adminLogin(email: string, password: string): Promise<AdminLoginResult> {
  let signedIn = false;
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { ok: false, reason: /invalid login credentials|invalid_grant/i.test(error.message) ? 'credentials' : 'network' };
    }
    signedIn = true;
  } catch {
    return { ok: false, reason: 'network' };
  }
  const isAdmin = await initAdminSession();
  if (isAdmin) return { ok: true };
  if (signedIn) { try { await supabase.auth.signOut(); } catch { /* ignore */ } }
  return { ok: false, reason: 'not_admin' };
}

/** Signs out via Supabase and clears local admin session state. */
export async function adminLogout(): Promise<void> {
  _adminAuthenticated = false;
  try { await supabase.auth.signOut(); } catch { /* ignore */ }
}
