import { useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export type AssignableWorker = {
  id: string;
  username: string | null;
  photo_url: string | null;
  photoUrl: string | null;
  rating: number;
  is_pro: boolean;
  isPro: boolean;
  primary_job_type: string | null;
  primaryJobType: string | null;
  job_types: string[];
  certifications: string[];
  /** The application status for this shift (undefined if not applied) */
  applicationStatus?: string;
  /** The offer (shift request) status for this shift (undefined if none sent) */
  requestStatus?: string;
};

/**
 * Roster workers for the assign screen, with each one's current standing on
 * this shift. Two actions: `assign` books directly (worker is confirmed at
 * once), `offer` sends a request the worker must accept.
 */
export function useAssignWorkers(shiftId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [workers, setWorkers]       = useState<AssignableWorker[]>([]);
  const [isLoading, setLoading]     = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [offeringId, setOfferingId]   = useState<string | null>(null);

  useEffect(() => {
    if (!shiftId || !user?.id) { setWorkers([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    Promise.all([
      // Roster workers
      apiClient(user.id).get<(AssignableWorker & { is_pro: boolean; primary_job_type: string | null; photo_url: string | null })[]>('/follows/roster'),
      // Current applicants for this shift (to know who is already accepted)
      apiClient(user.id).get<{ worker_id: string; status: string }[]>(`/applications?shift_id=${shiftId}`),
      // Offers already sent for this shift
      apiClient(user.id).get<{ shift_id: string; worker_id: string; status: string }[]>(`/shift-requests?shift_id=${shiftId}`)
        .catch((): { shift_id: string; worker_id: string; status: string }[] => []),
    ]).then(([roster, apps, reqs]) => {
      const statusMap = new Map(apps.map((a) => [a.worker_id, a.status]));
      const requestMap = new Map(reqs.filter((r) => r.shift_id === shiftId).map((r) => [r.worker_id, r.status]));
      setWorkers(roster.map((w) => ({
        ...w,
        photoUrl:        w.photo_url,
        isPro:           w.is_pro,
        primaryJobType:  w.primary_job_type,
        applicationStatus: statusMap.get(w.id),
        requestStatus:     requestMap.get(w.id),
      })));
    }).catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    }).finally(() => setLoading(false));
  }, [shiftId, user?.id]);

  function refreshShift() {
    // The shift's spots-filled count changed — refresh every cached copy so
    // the detail page and lists don't show a stale "spots left".
    void qc.invalidateQueries({ queryKey: ['shift', shiftId] });
    void qc.invalidateQueries({ queryKey: ['shifts'] });
    void qc.invalidateQueries({ queryKey: ['client-shifts'] });
    void qc.invalidateQueries({ queryKey: ['accepted-workers', shiftId] });
    void qc.invalidateQueries({ queryKey: ['shift-applicants', shiftId] });
  }

  // Returns null on success, or the server's error message (e.g. a double-booking
  // conflict) on failure so the screen can surface it.
  const assign = useCallback(async (workerId: string): Promise<string | null> => {
    if (!shiftId || !user?.id) return 'Not signed in.';
    setAssigningId(workerId);
    try {
      await apiClient(user.id).post('/applications/assign', { shift_id: shiftId, worker_id: workerId });
      setWorkers((prev) => prev.map((w) =>
        w.id === workerId ? { ...w, applicationStatus: 'accepted' } : w,
      ));
      refreshShift();
      return null;
    } catch (e) {
      console.error('[useAssignWorkers] assign failed:', e);
      return e instanceof Error ? e.message : 'Could not assign this worker.';
    } finally {
      setAssigningId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiftId, user?.id]);

  const offer = useCallback(async (workerId: string): Promise<string | null> => {
    if (!shiftId || !user?.id) return 'Not signed in.';
    setOfferingId(workerId);
    try {
      await apiClient(user.id).post('/shift-requests', { shift_id: shiftId, worker_id: workerId });
      setWorkers((prev) => prev.map((w) =>
        w.id === workerId ? { ...w, requestStatus: 'pending' } : w,
      ));
      void qc.invalidateQueries({ queryKey: ['shift-invites'] });
      return null;
    } catch (e) {
      console.error('[useAssignWorkers] offer failed:', e);
      return e instanceof Error ? e.message : 'Could not send the offer.';
    } finally {
      setOfferingId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiftId, user?.id]);

  const isAssigning = assigningId !== null;

  return { workers, isLoading, error, assign, offer, assigningId, offeringId, isAssigning };
}
