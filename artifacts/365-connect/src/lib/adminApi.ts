/**
 * Thin client for the admin API endpoints on the api-server.
 * Auth: the admin's Supabase session access token is attached as a Bearer
 * header (and X-Supabase-Token as a proxy-safe fallback), matching lib/api.ts.
 * The server verifies the token and checks the user has role='admin'.
 */
import { supabase, getCachedAccessToken } from '@/lib/supabase';

const BASE = '/api/admin';

/**
 * Same token strategy as lib/api.ts: the module-level cache first (kept
 * fresh by onAuthStateChange, never touches the auth lock), then a bounded
 * getSession() only when the cache is empty.
 */
async function accessToken(): Promise<string | null> {
  const cached = getCachedAccessToken();
  if (cached) return cached;
  try {
    return await Promise.race<string | null>([
      supabase.auth.getSession().then(({ data }) => data.session?.access_token ?? null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
    ]);
  } catch {
    return null;
  }
}

async function makeHeaders(): Promise<HeadersInit> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = await accessToken();
  if (token) {
    h['Authorization'] = `Bearer ${token}`;
    h['X-Supabase-Token'] = token;
  }
  return h;
}

/** The server's own error text (and status) when it sent one, for the UI. */
async function apiError(res: Response, what: string): Promise<Error> {
  const b = await res.json().catch(() => null) as { error?: string } | null;
  return new Error(b?.error ? `${b.error} (${res.status})` : `Admin API ${what} → ${res.status}`);
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: await makeHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw await apiError(res, path);
  return res.json() as Promise<T>;
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: await makeHeaders(),
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await apiError(res, `PATCH ${path}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: await makeHeaders(),
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await apiError(res, `POST ${path}`);
  return res.json() as Promise<T>;
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: await makeHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw await apiError(res, `DELETE ${path}`);
  return res.json() as Promise<T>;
}

/* ── Shapes ──────────────────────────────────────────────────────────────── */

export type AdminStats = {
  totalUsers:      number;
  totalShifts:     number;
  totalApps:       number;
  totalRevenue:    number;
  platformFeeRev:  number;
  newSignupsToday: number;
  activeShifts:    number;
  openDisputes:    number;
};

export type AdminUserRow = {
  id:         string;
  email:      string;
  role:       'worker' | 'client' | 'admin' | 'staffer';
  username:   string | null;
  photo_url:  string | null;
  is_pro:     boolean;
  rating:     number;
  status:     'active' | 'suspended' | 'flagged';
  created_at: string;
};

export type AdminShiftRow = {
  id:              string;
  title:           string;
  job_type:        string;
  company_name:    string | null;
  status:          'open' | 'filled' | 'cancelled' | 'completed';
  pay_rate:        number | null;
  pay_period?:     string | null;
  spots_available: number;
  spots_filled:    number;
  created_at:      string;
  client_id:       string;
  start_time:      string;
  end_time:        string;
  date:            string | null;
  location:        string | null;
};

export type AdminPaymentRow = {
  id:           string;
  shift_id:     string | null;
  worker_id:    string;
  payment_type: string;
  amount:       number;
  fee:          number;
  net_amount:   number;
  status:       string;
  created_at:   string;
};

export type AdminDisputeUser = {
  username:  string | null;
  email:     string | null;
  photo_url: string | null;
  role:      string | null;
};

export type AdminDisputeRow = {
  id:                  string;
  type:                string;
  reported_user_id:    string | null;
  reported_by_user_id: string | null;
  /** Who the case is about / who filed it (null when the account is gone). */
  reported_user?:      AdminDisputeUser | null;
  reported_by_user?:   AdminDisputeUser | null;
  reason:              string;
  status:              'open' | 'resolved' | 'warned' | 'banned';
  created_at:          string;
  resolution_note:     string | null;
};

/* ── Queries ─────────────────────────────────────────────────────────────── */

export const adminApi = {
  getStats:    ()                              => get<AdminStats>('/stats'),
  getUsers:    ()                              => get<AdminUserRow[]>('/users'),
  getShifts:   ()                              => get<AdminShiftRow[]>('/shifts'),
  getPayments: ()                              => get<AdminPaymentRow[]>('/payments'),
  getDisputes: ()                              => get<AdminDisputeRow[]>('/disputes'),

  updateUser:    (id: string, body: Partial<Pick<AdminUserRow, 'role' | 'status' | 'is_pro'>>) =>
    patch<{ ok: boolean }>(`/users/${id}`, body),
  cancelShift:   (id: string) =>
    patch<{ ok: boolean }>(`/shifts/${id}/cancel`, {}),
  reopenShift:   (id: string) =>
    patch<{ ok: boolean; released?: number }>(`/shifts/${id}/reopen`, {}),
  backfillShiftCoords: (updates: Array<{ id: string; lat: number; lng: number }>) =>
    post<{ updated: number }>(`/shifts/backfill-coords`, { updates }),
  sendTestEmail: (to?: string) =>
    post<{ sent: boolean; to: string; configured: boolean; reason?: string | null }>(`/test-email`, to ? { to } : {}),
  deleteUser:    (id: string) =>
    del<{ ok: boolean }>(`/users/${id}`),
  updateDispute: (id: string, status: string, note?: string) =>
    patch<{ ok: boolean }>(`/disputes/${id}`, { status, resolution_note: note }),
};
