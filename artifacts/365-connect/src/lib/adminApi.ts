/**
 * Thin client for the admin API endpoints on the api-server.
 * Auth: the admin's Supabase session access token is attached as a Bearer
 * header (and X-Supabase-Token as a proxy-safe fallback), matching lib/api.ts.
 * The server verifies the token and checks the user has role='admin'.
 */
import { supabase } from '@/lib/supabase';

const BASE = '/api/admin';

async function makeHeaders(): Promise<HeadersInit> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      h['Authorization'] = `Bearer ${token}`;
      h['X-Supabase-Token'] = token;
    }
  } catch { /* signed out — request will 401 */ }
  return h;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: await makeHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Admin API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: await makeHeaders(),
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Admin API PATCH ${path} → ${res.status}`);
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

export type AdminDisputeRow = {
  id:                  string;
  type:                string;
  reported_user_id:    string | null;
  reported_by_user_id: string | null;
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
  updateDispute: (id: string, status: string, note?: string) =>
    patch<{ ok: boolean }>(`/disputes/${id}`, { status, resolution_note: note }),
};
