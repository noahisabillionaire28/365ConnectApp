import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

type RawAccepted = {
  id: string;
  shift_id: string;
  worker_id: string;
  status: string;
  username: string | null;
  photo_url: string | null;
  rating: number;
  job_types: string[];
  primary_job_type: string | null;
  certifications: string[];
  bio: string | null;
  clock_in?: string | null;
  clock_out?: string | null;
  total_hours?: number | null;
  total_pay?: number | null;
  attendance?: 'applied' | 'booked' | 'on_site' | 'done' | 'no_show';
  already_reviewed?: boolean;
  paid?: boolean;
  [key: string]: unknown;
};

export type Attendance = 'applied' | 'booked' | 'on_site' | 'done' | 'no_show';

export type AcceptedWorker = RawAccepted & {
  /** camelCase aliases */
  workerId: string;
  photoUrl: string | null;
  /** true when the worker has clocked out */
  completed: boolean;
  /** where the worker is in the shift lifecycle */
  attendance: Attendance;
  /** actual clocked hours and pay (null until clocked out) */
  totalHours: number | null;
  totalPay: number | null;
  /** true when the shift owner has already rated this worker */
  alreadyReviewed: boolean;
  /** true when this worker has already been paid for the shift */
  paid: boolean;
};

export function useAcceptedWorkers(
  shiftId: string | undefined,
  /** optional — kept for compat, ignored (comes from auth context) */
  _ownerId?: string,
) {
  const { user } = useAuth();
  const [workers, setWorkers]   = useState<AcceptedWorker[]>([]);
  const [isLoading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!shiftId || !user?.id) { setWorkers([]); setLoading(false); return; }
    setLoading(true);
    try {
      const rows = await apiClient(user.id).get<RawAccepted[]>(
        `/applications?shift_id=${shiftId}&status=accepted`,
      );
      setWorkers(rows.map((r) => ({
        ...r,
        workerId:        r.worker_id,
        photoUrl:        r.photo_url,
        completed:       !!(r.clock_out),
        attendance:      r.attendance ?? (r.clock_out ? 'done' : 'booked'),
        totalHours:      r.total_hours ?? null,
        totalPay:        r.total_pay ?? null,
        alreadyReviewed: !!(r.already_reviewed),
        paid:            !!(r.paid),
      })));
    } catch (e) {
      console.error('[useAcceptedWorkers] load failed:', e);
    } finally {
      setLoading(false);
    }
  }, [shiftId, user?.id]);

  useEffect(() => { void load(); }, [load]);

  return { workers, isLoading, refetch: load };
}
