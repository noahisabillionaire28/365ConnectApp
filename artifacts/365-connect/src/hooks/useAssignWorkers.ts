import { useState, useCallback, useEffect } from 'react';
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
};

export function useAssignWorkers(shiftId: string | undefined) {
  const { user } = useAuth();
  const [workers, setWorkers]       = useState<AssignableWorker[]>([]);
  const [isLoading, setLoading]     = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  useEffect(() => {
    if (!shiftId || !user?.id) { setWorkers([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    Promise.all([
      // Roster workers
      apiClient(user.id).get<(AssignableWorker & { is_pro: boolean; primary_job_type: string | null; photo_url: string | null })[]>('/follows/roster'),
      // Current applicants for this shift (to know who is already accepted)
      apiClient(user.id).get<{ worker_id: string; status: string }[]>(`/applications?shift_id=${shiftId}`),
    ]).then(([roster, apps]) => {
      const statusMap = new Map(apps.map((a) => [a.worker_id, a.status]));
      setWorkers(roster.map((w) => ({
        ...w,
        photoUrl:        w.photo_url,
        isPro:           w.is_pro,
        primaryJobType:  w.primary_job_type,
        applicationStatus: statusMap.get(w.id),
      })));
    }).catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    }).finally(() => setLoading(false));
  }, [shiftId, user?.id]);

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
      return null;
    } catch (e) {
      console.error('[useAssignWorkers] assign failed:', e);
      return e instanceof Error ? e.message : 'Could not assign this worker.';
    } finally {
      setAssigningId(null);
    }
  }, [shiftId, user?.id]);

  const isAssigning = assigningId !== null;

  return { workers, isLoading, error, assign, assigningId, isAssigning };
}
