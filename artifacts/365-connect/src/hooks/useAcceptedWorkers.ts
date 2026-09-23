import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { ArrivalStatus } from './useArrivalStatus';

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
  arrival_status?: ArrivalStatus | null;
  arrival_status_at?: string | null;
  already_reviewed?: boolean;
  /** The star rating the viewer gave this worker for this shift (null until rated). */
  my_review_rating?: number | null;
  /** The worker's answer to the approved hours (null until they respond). */
  worker_ack?: 'accepted' | 'disputed' | null;
  dispute_note?: string | null;
  paid?: boolean;
  [key: string]: unknown;
};

export type Attendance = 'applied' | 'booked' | 'on_site' | 'done' | 'no_show';

/**
 * What the poster sees for a booked worker on the day: the worker's own
 * report, or 'clocked_in' once a time entry exists (which wins).
 */
export type DayOfStatus = ArrivalStatus | 'clocked_in' | null;

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
  /** the stars the owner gave (null until rated) */
  myReviewRating: number | null;
  /** worker's answer to the approved hours (null until they respond) */
  workerAck: 'accepted' | 'disputed' | null;
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
  /** worker's self-reported day-of status (null until they report one) */
  arrivalStatus: ArrivalStatus | null;
  arrivalStatusAt: string | null;
  /** day-of status for the roster chip: clocked in beats the self-report */
  dayOfStatus: DayOfStatus;
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
        myReviewRating:  r.my_review_rating ?? null,
        workerAck:       r.worker_ack ?? null,
        paid:            !!(r.paid),
        approved:        !!(r.approved),
        approvedPay:     (r.approved_pay as number | null) ?? null,
        overtimeHours:   (r.overtime_hours as number | null) ?? null,
        breakMinutes:    (r.break_minutes as number | null) ?? null,
        arrivalStatus:   r.arrival_status ?? null,
        arrivalStatusAt: r.arrival_status_at ?? null,
        dayOfStatus:     r.clock_in ? 'clocked_in' : (r.arrival_status ?? null),
      }));
    },
  });

  return { workers: q.data ?? [], isLoading: q.isLoading, refetch: q.refetch };
}
