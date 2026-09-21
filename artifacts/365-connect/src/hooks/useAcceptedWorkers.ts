import { useQuery, keepPreviousData } from '@tanstack/react-query';
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
  /** true when the timesheet has been approved by the manager */
  approved: boolean;
  /** manager-approved final pay (null until approved) */
  approvedPay: number | null;
  /** overtime hours computed at approval */
  overtimeHours: number | null;
  /** break minutes recorded on the timesheet */
  breakMinutes: number | null;
};

export const ACCEPTED_WORKERS_KEY = 'accepted-workers';

export function useAcceptedWorkers(
  shiftId: string | undefined,
  /** optional — kept for compat, ignored (comes from auth context) */
  _ownerId?: string,
) {
  const { user } = useAuth();
  const q = useQuery<AcceptedWorker[], Error>({
    queryKey: [ACCEPTED_WORKERS_KEY, shiftId, user?.id],
    enabled: !!shiftId && !!user?.id,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const rows = await apiClient(user!.id).get<RawAccepted[]>(
        `/applications?shift_id=${shiftId}&status=accepted`,
      );
      return rows.map((r) => ({
        ...r,
        workerId:        r.worker_id,
        photoUrl:        r.photo_url,
        completed:       !!(r.clock_out),
        attendance:      r.attendance ?? (r.clock_out ? 'done' : 'booked'),
        totalHours:      r.total_hours ?? null,
        totalPay:        r.total_pay ?? null,
        alreadyReviewed: !!(r.already_reviewed),
        paid:            !!(r.paid),
        approved:        !!(r.approved),
        approvedPay:     (r.approved_pay as number | null) ?? null,
        overtimeHours:   (r.overtime_hours as number | null) ?? null,
        breakMinutes:    (r.break_minutes as number | null) ?? null,
      }));
    },
  });

  return { workers: q.data ?? [], isLoading: q.isLoading, refetch: q.refetch };
}
