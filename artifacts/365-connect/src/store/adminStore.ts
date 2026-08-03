/* ─── Admin auth (backed by Clerk JWT + role check via API) ─────────────────── */

let _adminAuthenticated = false;

/** Synchronous read — reflects the last resolved session check. */
export function isAdminAuthenticated(): boolean {
  return _adminAuthenticated;
}

/**
 * Call on every admin page mount to restore session state after a hard refresh.
 * Returns true if the current Clerk session belongs to a user with role='admin'.
 */
export async function initAdminSession(): Promise<boolean> {
  try {
    const res = await fetch('/api/users/me', { credentials: 'include' });
    if (!res.ok) { _adminAuthenticated = false; return false; }
    const profile = await res.json() as { role?: string };
    _adminAuthenticated = profile?.role === 'admin';
    return _adminAuthenticated;
  } catch {
    _adminAuthenticated = false;
    return false;
  }
}

/**
 * Admin users now sign in via the standard Clerk flow (/sign-in).
 * This helper navigates to sign-in and returns false — kept for
 * backwards compat with AdminLogin.tsx.
 */
export async function adminLogin(_email: string, _password: string): Promise<boolean> {
  window.location.href = '/sign-in';
  return false;
}

/** Signs out via Clerk and clears local admin session state. */
export async function adminLogout(): Promise<void> {
  _adminAuthenticated = false;
  // Use Clerk's global instance if available
  const clerkGlobal = (window as unknown as { Clerk?: { signOut: () => Promise<void> } }).Clerk;
  if (clerkGlobal?.signOut) {
    await clerkGlobal.signOut();
  }
}
