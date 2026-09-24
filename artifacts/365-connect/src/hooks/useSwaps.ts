/**
 * Shift swaps — a booked worker hands their spot to another worker, who
 * accepts, and the poster approves. Reads for both sides plus the four
 * mutations, each refreshing every cache the swap touches.
 */
import { useCallback, useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData, type QueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export type SwapStatus =
  | 'offered' | 'accepted' | 'approved'
  | 'declined_by_worker' | 'declined_by_poster' | 'cancelled' | 'expired';

/** Still in flight: waiting on the other worker, or on the poster. */
export function isSwapActive(status: string | null | undefined): boolean {
  return status === 'offered' || status === 'accepted';
}

export type SwapPerson = {
  id: string;
  username: string | null;
  photoUrl: string | null;
  rating: number | null;
  /** Shifts clocked out on (poster view only). */
  shiftsWorked: number | null;
};

export type SwapShift = {
  id: string;
  title: string | null;
  jobType: string | null;
  companyName: string | null;
  startTime: string | null;
  endTime: string | null;
  timezone: string | null;
  location: string | null;
  payRate: number | null;
  payPeriod: string | null;
  status: string | null;
};

/** A swap as the worker sees it: the shift and the other worker. */
export type MySwap = {
  id: string;
  shiftId: string;
  fromWorkerId: string;
  toWorkerId: string;
  status: SwapStatus;
  note: string | null;
  createdAt: string;
  respondedAt: string | null;
  decidedAt: string | null;
  shift: SwapShift | null;
  counterpart: SwapPerson;
};

/** A swap as the poster sees it: both workers. */
export type ShiftSwap = {
  id: string;
  shiftId: string;
  applicationId: string;
  status: SwapStatus;
  note: string | null;
  createdAt: string;
  respondedAt: string | null;
  decidedAt: string | null;
  fromWorker: SwapPerson;
  toWorker: SwapPerson;
};

type RawPerson = { id: string; username: string | null; photo_url: string | null; rating: number | string | null; shifts_worked?: number | null };
type RawShift = {
  id: string; title: string | null; job_type: string | null; company_name: string | null;
  start_time: string | null; end_time: string | null; timezone: string | null; location: string | null;
  pay_rate: number | string | null; pay_period: string | null; status: string | null;
};
type RawMySwap = {
  id: string; shift_id: string; from_worker_id: string; to_worker_id: string; status: SwapStatus;
  note: string | null; created_at: string; responded_at: string | null; decided_at: string | null;
  shift: RawShift | null; counterpart: RawPerson;
};
type RawShiftSwap = {
  id: string; shift_id: string; application_id: string; status: SwapStatus; note: string | null;
  created_at: string; responded_at: string | null; decided_at: string | null;
  from_worker: RawPerson; to_worker: RawPerson;
};

const num = (v: number | string | null | undefined): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function toPerson(p: RawPerson | null | undefined, fallbackId = ''): SwapPerson {
  return {
    id: p?.id ?? fallbackId,
    username: p?.username ?? null,
    photoUrl: p?.photo_url ?? null,
    rating: num(p?.rating),
    shiftsWorked: p?.shifts_worked ?? null,
  };
}

function toShift(s: RawShift | null): SwapShift | null {
  if (!s) return null;
  return {
    id: s.id, title: s.title, jobType: s.job_type, companyName: s.company_name,
    startTime: s.start_time, endTime: s.end_time, timezone: s.timezone, location: s.location,
    payRate: num(s.pay_rate), payPeriod: s.pay_period, status: s.status,
  };
}

function toMySwap(r: RawMySwap): MySwap {
  return {
    id: r.id, shiftId: r.shift_id, fromWorkerId: r.from_worker_id, toWorkerId: r.to_worker_id,
    status: r.status, note: r.note, createdAt: r.created_at, respondedAt: r.responded_at, decidedAt: r.decided_at,
    shift: toShift(r.shift), counterpart: toPerson(r.counterpart),
  };
}

function toShiftSwap(r: RawShiftSwap): ShiftSwap {
  return {
    id: r.id, shiftId: r.shift_id, applicationId: r.application_id, status: r.status, note: r.note,
    createdAt: r.created_at, respondedAt: r.responded_at, decidedAt: r.decided_at,
    fromWorker: toPerson(r.from_worker), toWorker: toPerson(r.to_worker),
  };
}

export const SWAPS_KEY = 'swaps';

/** Refresh every cache a swap can change (both sides, plus the roster). */
export function invalidateSwapCaches(qc: QueryClient, shiftId?: string | null): void {
  void qc.invalidateQueries({ queryKey: [SWAPS_KEY] });
  void qc.invalidateQueries({ queryKey: shiftId ? ['application-status', shiftId] : ['application-status'] });
  void qc.invalidateQueries({ queryKey: shiftId ? ['shift', shiftId] : ['shift'] });
  void qc.invalidateQueries({ queryKey: ['my-applications'] });
  void qc.invalidateQueries({ queryKey: ['my-shift-ids'] });
  void qc.invalidateQueries({ queryKey: ['worker-home-shifts'] });
  void qc.invalidateQueries({ queryKey: shiftId ? ['accepted-workers', shiftId] : ['accepted-workers'] });
  void qc.invalidateQueries({ queryKey: shiftId ? ['shift-applicants', shiftId] : ['shift-applicants'] });
  void qc.invalidateQueries({ queryKey: ['client-shifts'] });
}

/**
 * The worker's swaps: offers waiting on them (incoming) and the swaps they
 * started (outgoing — in flight, or decided in the last 7 days).
 */
export function useMySwaps(enabled = true) {
  const { user } = useAuth();
  const q = useQuery<{ incoming: MySwap[]; outgoing: MySwap[] }, Error>({
    queryKey: [SWAPS_KEY, 'mine', user?.id],
    enabled: !!user?.id && enabled,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const r = await apiClient(user!.id).get<{ incoming: RawMySwap[]; outgoing: RawMySwap[] }>('/swaps/mine');
      return { incoming: (r?.incoming ?? []).map(toMySwap), outgoing: (r?.outgoing ?? []).map(toMySwap) };
    },
  });
  return {
    incoming: q.data?.incoming ?? [],
    outgoing: q.data?.outgoing ?? [],
    isLoading: q.isLoading,
    refetch: q.refetch,
  };
}

/** Every swap on one shift — the poster's roster view. */
export function useShiftSwaps(shiftId: string | undefined, enabled = true) {
  const { user } = useAuth();
  const q = useQuery<ShiftSwap[], Error>({
    queryKey: [SWAPS_KEY, 'shift', shiftId, user?.id],
    enabled: !!shiftId && !!user?.id && enabled,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const rows = await apiClient(user!.id).get<RawShiftSwap[]>(`/swaps?shift_id=${encodeURIComponent(shiftId!)}`);
      return (rows ?? []).map(toShiftSwap);
    },
  });
  return { swaps: q.data ?? [], isLoading: q.isLoading, refetch: q.refetch };
}

function message(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

/** Worker: offer my spot on a shift to another worker. Null on success, else the reason. */
export function useOfferSwap() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const offer = useCallback(async (shiftId: string, toWorkerId: string, note?: string): Promise<string | null> => {
    if (!user?.id || busy) return null;
    setBusy(true);
    try {
      await apiClient(user.id).post('/swaps', { shift_id: shiftId, to_worker_id: toWorkerId, ...(note?.trim() ? { note: note.trim() } : {}) });
      invalidateSwapCaches(qc, shiftId);
      return null;
    } catch (e) {
      return message(e, 'Could not send the swap offer.');
    } finally { setBusy(false); }
  }, [user?.id, busy, qc]);
  return { offer, busy };
}

/** Worker: answer an offer made to me. Null on success, else the reason. */
export function useRespondSwap() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const respond = useCallback(async (swapId: string, action: 'accept' | 'decline', shiftId?: string | null): Promise<string | null> => {
    if (!user?.id || busyId) return null;
    setBusyId(swapId);
    try {
      await apiClient(user.id).post(`/swaps/${swapId}/respond`, { action });
      invalidateSwapCaches(qc, shiftId);
      return null;
    } catch (e) {
      // A dead offer should leave the list rather than linger.
      invalidateSwapCaches(qc, shiftId);
      return message(e, action === 'accept' ? 'Could not accept this swap.' : 'Could not decline this swap.');
    } finally { setBusyId(null); }
  }, [user?.id, busyId, qc]);
  return { respond, busyId };
}

/** Poster: approve or decline a swap on my shift. Null on success, else the reason. */
export function useDecideSwap() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const decide = useCallback(async (swapId: string, action: 'approve' | 'decline', shiftId?: string | null): Promise<string | null> => {
    if (!user?.id || busyId) return null;
    setBusyId(swapId);
    try {
      await apiClient(user.id).post(`/swaps/${swapId}/decide`, { action });
      invalidateSwapCaches(qc, shiftId);
      return null;
    } catch (e) {
      invalidateSwapCaches(qc, shiftId);
      return message(e, action === 'approve' ? 'Could not approve this swap.' : 'Could not decline this swap.');
    } finally { setBusyId(null); }
  }, [user?.id, busyId, qc]);
  return { decide, busyId };
}

/** Worker: pull a swap I started while it is still in flight. Null on success, else the reason. */
export function useCancelSwap() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const cancel = useCallback(async (swapId: string, shiftId?: string | null): Promise<string | null> => {
    if (!user?.id || busyId) return null;
    setBusyId(swapId);
    try {
      await apiClient(user.id).post(`/swaps/${swapId}/cancel`, {});
      invalidateSwapCaches(qc, shiftId);
      return null;
    } catch (e) {
      invalidateSwapCaches(qc, shiftId);
      return message(e, 'Could not cancel this swap.');
    } finally { setBusyId(null); }
  }, [user?.id, busyId, qc]);
  return { cancel, busyId };
}
