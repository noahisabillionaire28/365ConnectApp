/* ─── Admin auth (backed by Supabase JWT + role check) ─────────────────────── */
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
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { _adminAuthenticated = false; return false; }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', session.user.id)
    .single();

  _adminAuthenticated = profile?.role === 'admin';
  return _adminAuthenticated;
}

/**
 * Signs in via Supabase and verifies the admin role.
 * Signs out and returns false if the user lacks the admin role.
 */
export async function adminLogin(email: string, password: string): Promise<boolean> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) return false;

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', data.user.id)
    .single();

  if (profile?.role !== 'admin') {
    await supabase.auth.signOut();
    _adminAuthenticated = false;
    return false;
  }

  _adminAuthenticated = true;
  return true;
}

/** Signs out from Supabase and clears local admin session state. */
export async function adminLogout(): Promise<void> {
  _adminAuthenticated = false;
  await supabase.auth.signOut();
}
