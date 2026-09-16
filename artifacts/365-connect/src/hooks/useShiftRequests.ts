import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export type ShiftRequestRow = {
  id: string;
  shift_id: string;
  client_id: string;
  worker_id: string;
  status: 'pending' | 'accepted' | 'declined';
  message: string | null;
  created_at: string;
  // Snake_case joined fields
  shift_title?: string;
  job_type?: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  pay_rate?: number;
  pay_period?: string;
  company_name?: string;
  worker_username?: string;
  worker_photo?: string;
  client_username?: string;
  client_photo?: string;
  // camelCase aliases for pages expecting them
  shiftTitle?: string;
  jobType?: string;
  startTime?: string;
  endTime?: string;
  payRate?: number;
  payPeriod?: string;
  companyName?: string;
  workerUsername?: string;
  workerPhoto?: string;
  clientUsername?: string;
  clientPhotoUrl?: string;
};

/** Standalone named export for direct use in page components */
export async function createShiftRequest(
  userId: string,
  shiftId: string,
  workerId: string,
  message?: string,
): Promise<{ ok: boolean; message?: string }> {
  try {
    await apiClient(userId).post('/shift-requests', { shift_id: shiftId, worker_id: workerId, message });
    return { ok: true };
  } catch (e) {
    console.error('[createShiftRequest] failed:', e);
    const msg = e instanceof Error ? e.message : 'Failed to send request';
    return { ok: false, message: msg };
  }
}

/** Invite every worker on the platform to a shift (Nowsta-style blast). */
export async function broadcastShiftRequest(
  userId: string,
  shiftId: string,
  message?: string,
): Promise<{ ok: boolean; invited?: number; message?: string }> {
  try {
    const r = await apiClient(userId).post<{ invited: number }>(
      '/shift-requests/broadcast', { shift_id: shiftId, message },
    );
    return { ok: true, invited: r.invited };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Failed to send invites' };
  }
}

function mapRow(r: ShiftRequestRow): ShiftRequestRow {
  return {
    ...r,
    shiftTitle:    r.shift_title   ?? r.shiftTitle,
    jobType:       r.job_type      ?? r.jobType,
    startTime:     r.start_time    ?? r.startTime,
    endTime:       r.end_time      ?? r.endTime,
    payRate:       r.pay_rate      ?? r.payRate,
    payPeriod:     r.pay_period    ?? r.payPeriod,
    companyName:   r.company_name  ?? r.companyName,
    workerUsername:r.worker_username ?? r.workerUsername,
    workerPhoto:   r.worker_photo  ?? r.workerPhoto,
    clientUsername:r.client_username ?? r.clientUsername,
    clientPhotoUrl:r.client_photo  ?? r.clientPhotoUrl,
  };
}

export function useShiftRequests(
  /** Optional userId override — if omitted, reads from AuthContext */
  _userId?: string,
) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ShiftRequestRow[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) { setRequests([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const rows = await apiClient(user.id).get<ShiftRequestRow[]>('/shift-requests');
      setRequests(rows.map(mapRow));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  const sendRequest = useCallback(async (shiftId: string, workerId: string, message?: string): Promise<boolean> => {
    if (!user?.id) return false;
    const result = await createShiftRequest(user.id, shiftId, workerId, message);
    return result.ok;
  }, [user?.id]);

  /** Accept an offer. Resolves to the booking outcome: booked, or waitlisted (standby). */
  const accept = useCallback(async (id: string): Promise<{ ok: boolean; status?: 'accepted' | 'standby' }> => {
    if (!user?.id) return { ok: false };
    try {
      const r = await apiClient(user.id).patch<{ status?: 'accepted' | 'standby' }>(
        `/shift-requests/${id}`, { status: 'accepted' },
      );
      setRequests((prev) => prev.map((x) => x.id === id ? { ...x, status: 'accepted' as const } : x));
      return { ok: true, status: r?.status ?? 'accepted' };
    } catch (e) {
      console.error('[useShiftRequests] accept failed:', e);
      return { ok: false };
    }
  }, [user?.id]);

  const decline = useCallback(async (id: string): Promise<boolean> => {
    if (!user?.id) return false;
    try {
      await apiClient(user.id).patch(`/shift-requests/${id}`, { status: 'declined' });
      setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: 'declined' as const } : r));
      return true;
    } catch (e) {
      console.error('[useShiftRequests] decline failed:', e);
      return false;
    }
  }, [user?.id]);

  const respondToRequest = useCallback(async (id: string, status: 'accepted' | 'declined'): Promise<boolean> => {
    return status === 'accepted' ? (await accept(id)).ok : decline(id);
  }, [accept, decline]);

  return { requests, isLoading, error, sendRequest, accept, decline, respondToRequest, refetch: load };
}
