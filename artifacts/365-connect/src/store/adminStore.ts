/* ─── Admin auth (module-level, survives hot-reload in dev) ────────────────── */
let _authenticated = false;

export function isAdminAuthenticated(): boolean {
  return _authenticated;
}

export function adminLogin(email: string, password: string): boolean {
  if (email === 'admin@365connect.com' && password === 'Admin123!') {
    _authenticated = true;
    return true;
  }
  return false;
}

export function adminLogout(): void {
  _authenticated = false;
}
