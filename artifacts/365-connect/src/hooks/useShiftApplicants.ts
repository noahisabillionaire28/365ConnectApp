import { useCallback } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

/** Raw DB shape returned by the applications list endpoint */
export type RawApplicant = {
  id: string;
  shift_id: string;
  worker_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'rejected' | 'withdrawn' | 'standby';
  match_score: number | null;
  applied_at: string;
  created_at: string;
  // Joined user fields
  username: string | null;
  photo_url: string | null;
  rating: number;
  job_types: string[];
  primary_job_type: string | null;
  certifications: string[];
  bio: string | null;
  // Roster / timesheet fields (see useAcceptedWorkers)
  [key: string]: unknown;
};

export type ApplicantCard = RawApplicant & {
  /** camelCase alias */
  applicationId: string;
  photoUrl: string | null;
  matchScore: number | null;
  jobTypes: string[];
  primaryJobType: string | null;
};

/** @deprecated use ApplicantCard */
export type ApplicantRow = ApplicantCard;

export const SHIFT_APPLICANTS_KEY = 'shift-applicants';

/**
 * ONE request for a shift's whole roster (every status). The applicants
 * list and the confirmed-workers list are both derived from this entry with
 * react-query `select`, so the Applicants screen no longer fetches the same
 * rows twice with different status filters.
 */
export const shiftRosterQueryKey = (shiftId: string | undefined, userId: string | undefined) =>
  [SHIFT_APPLICANTS_KEY, shiftId, userId] as const;

export async function fetchShiftRoster(userId: string, shiftId: string): Promise<RawApplicant[]> {
  return apiClient(userId).get<RawApplicant[]>(`/applications?shift_id=${shiftId}`);
}

const toCards = (rows: RawApplicant[]): ApplicantCard[] => rows.map((r) => ({
  ...r,
  applicationId: r.id,
  photoUrl:      r.photo_url,
  matchScore:    r.match_score ?? null,
  jobTypes:      r.job_types,
  primaryJobType: r.primary_job_type,
}));

export function useShiftApplicants(shiftId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = shiftRosterQueryKey(shiftId, user?.id);

  const q = useQuery<RawApplicant[], Error, ApplicantCard[]>({
    queryKey: key,
    enabled: !!shiftId && !!user?.id,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
    queryFn: () => fetchShiftRoster(user!.id, shiftId!),
    select: toCards,
  });

  const updateStatus = useCallback(async (applicationId: string, status: string): Promise<void> => {
    try {
      await apiClient(user?.id).patch(`/applications/${applicationId}`, { status });
      // The status change alone moves the row between the derived lists
      // (pending → confirmed); the refetch below fills in the roster fields.
      qc.setQueryData<RawApplicant[]>(key, (prev) => (prev ?? []).map((a) =>
        a.id === applicationId ? { ...a, status: status as RawApplicant['status'] } : a));
      void qc.invalidateQueries({ queryKey: [SHIFT_APPLICANTS_KEY, shiftId] });
      void qc.invalidateQueries({ queryKey: ['shift', shiftId] });
      void qc.invalidateQueries({ queryKey: ['client-shifts'] });
    } catch (e) {
      console.error('[useShiftApplicants] updateStatus failed:', e);
      throw e;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, shiftId]);

  // Return null on success, or the server's error message on failure (e.g. a
  // double-booking conflict) so the screen can show it.
  const approve = useCallback(async (applicationId: string): Promise<string | null> => {
    try {
      await updateStatus(applicationId, 'accepted');
      return null;
    } catch (e) { return e instanceof Error ? e.message : 'Could not confirm this worker.'; }
  }, [updateStatus]);

  const decline = useCallback(async (applicationId: string): Promise<string | null> => {
    try {
      await updateStatus(applicationId, 'declined');
      return null;
    } catch (e) { return e instanceof Error ? e.message : 'Could not decline this applicant.'; }
  }, [updateStatus]);

  return { applicants: q.data ?? [], isLoading: q.isLoading, approve, decline, updateStatus, refetch: q.refetch };
}
