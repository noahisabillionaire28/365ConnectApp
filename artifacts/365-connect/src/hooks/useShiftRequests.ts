import { useCallback } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { MY_APPLICATIONS_KEY } from './useMyApplications';

export type ShiftRequestRow = {
  id: string;
  shift_id: string;
  client_id: string;
  worker_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'standby' | 'cancelled' | 'expired';
  message: string | null;
  created_at: string;
  // Snake_case joined fields
  shift_title?: string;
  /** The shift's own lifecycle — an offer on a cancelled shift is dead. */
  shift_status?: 'open' | 'filled' | 'cancelled' | 'completed' | null;
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

export const SHIFT_REQUESTS_KEY = 'shift-requests';

/**
 * An offer the worker can still act on: pending, for a shift that is still
 * open or filling, and that has not started yet (same rule as the server).
 */
export function isLiveOffer(r: Pick<ShiftRequestRow, 'status' | 'shift_status' | 'start_time' | 'startTime'>): boolean {
  if (r.status !== 'pending') return false;
  if (r.shift_status === 'cancelled' || r.shift_status === 'completed') return false;
  const start = r.startTime ?? r.start_time;
  if (!start) return true;
  const t = Date.parse(start);
  return !Number.isFinite(t) || t > Date.now();
}

export function useShiftRequests(
  /** Optional userId override — if omitted, reads from AuthContext */
  _userId?: string,
) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = [SHIFT_REQUESTS_KEY, user?.id];

  const q = useQuery<ShiftRequestRow[], Error>({
    queryKey: key,
    enabled: !!user?.id,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const rows = await apiClient(user!.id).get<ShiftRequestRow[]>('/shift-requests');
      return rows.map(mapRow);
    },
  });

  const patchLocal = useCallback((id: string, status: ShiftRequestRow['status']) => {
    qc.setQueryData<ShiftRequestRow[]>(key, (prev) => (prev ?? []).map((x) => (x.id === id ? { ...x, status } : x)));
  }, [qc, key]);

  const sendRequest = useCallback(async (shiftId: string, workerId: string, message?: string): Promise<boolean> => {
    if (!user?.id) return false;
    const result = await createShiftRequest(user.id, shiftId, workerId, message);
    if (result.ok) void qc.invalidateQueries({ queryKey: [SHIFT_REQUESTS_KEY] });
    return result.ok;
  }, [user?.id, qc]);

  /**
   * Accept an offer. Resolves to the booking outcome: booked, or waitlisted
   * (standby). On failure `message` carries the server's reason (a time
   * conflict, a full or cancelled shift, an expired offer).
   */
  const accept = useCallback(async (id: string): Promise<{ ok: boolean; status?: 'accepted' | 'standby'; message?: string }> => {
    if (!user?.id) return { ok: false, message: 'Not signed in.' };
    try {
      const r = await apiClient(user.id).patch<{ status?: 'accepted' | 'standby' }>(
        `/shift-requests/${id}`, { status: 'accepted' },
      );
      patchLocal(id, r?.status === 'standby' ? 'standby' : 'accepted');
      // The worker's schedule, applied-set and the shift itself changed too.
      const shiftId = qc.getQueryData<ShiftRequestRow[]>(key)?.find((x) => x.id === id)?.shift_id;
      void qc.invalidateQueries({ queryKey: [MY_APPLICATIONS_KEY] });
      void qc.invalidateQueries({ queryKey: ['my-shift-ids'] });
      void qc.invalidateQueries({ queryKey: ['worker-home-shifts'] });
      void qc.invalidateQueries({ queryKey: ['application-status'] });
      void qc.invalidateQueries({ queryKey: shiftId ? ['shift', shiftId] : ['shift'] });
      return { ok: true, status: r?.status ?? 'accepted' };
    } catch (e) {
      console.error('[useShiftRequests] accept failed:', e);
      // A dead offer (cancelled / started) should leave the list, not linger.
      void qc.invalidateQueries({ queryKey: [SHIFT_REQUESTS_KEY] });
      return { ok: false, message: e instanceof Error ? e.message : 'Could not accept this offer.' };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, patchLocal, qc]);

  const decline = useCallback(async (id: string): Promise<{ ok: boolean; message?: string }> => {
    if (!user?.id) return { ok: false, message: 'Not signed in.' };
    try {
      await apiClient(user.id).patch(`/shift-requests/${id}`, { status: 'declined' });
      patchLocal(id, 'declined');
      return { ok: true };
    } catch (e) {
      console.error('[useShiftRequests] decline failed:', e);
      void qc.invalidateQueries({ queryKey: [SHIFT_REQUESTS_KEY] });
      return { ok: false, message: e instanceof Error ? e.message : 'Could not decline this offer.' };
    }
  }, [user?.id, patchLocal, qc]);

  const respondToRequest = useCallback(async (id: string, status: 'accepted' | 'declined'): Promise<boolean> => {
    return status === 'accepted' ? (await accept(id)).ok : (await decline(id)).ok;
  }, [accept, decline]);

  return {
    requests: q.data ?? [],
    isLoading: q.isLoading,
    error: q.error ? q.error.message : null,
    sendRequest, accept, decline, respondToRequest,
    refetch: q.refetch,
  };
}
