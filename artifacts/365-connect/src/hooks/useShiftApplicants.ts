import { useCallback } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

/** Raw DB shape returned by the applications list endpoint */
type RawApplicant = {
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

export function useShiftApplicants(shiftId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = [SHIFT_APPLICANTS_KEY, shiftId, user?.id];

  const q = useQuery<ApplicantCard[], Error>({
    queryKey: key,
    enabled: !!shiftId && !!user?.id,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const rows = await apiClient(user!.id).get<RawApplicant[]>(`/applications?shift_id=${shiftId}`);
      return rows.map((r) => ({
        ...r,
        applicationId: r.id,
        photoUrl:      r.photo_url,
        matchScore:    r.match_score ?? null,
        jobTypes:      r.job_types,
        primaryJobType: r.primary_job_type,
      }));
    },
  });

  const updateStatus = useCallback(async (applicationId: string, status: string): Promise<void> => {
    try {
      await apiClient(user?.id).patch(`/applications/${applicationId}`, { status });
      qc.setQueryData<ApplicantCard[]>(key, (prev) => (prev ?? []).map((a) =>
        a.id === applicationId ? { ...a, status: status as ApplicantCard['status'] } : a));
      // The confirmed roster and the shift's spots changed too.
      void qc.invalidateQueries({ queryKey: ['accepted-workers', shiftId] });
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
      qc.setQueryData<ApplicantCard[]>(key, (prev) => (prev ?? []).filter((a) => a.id !== applicationId));
      return null;
    } catch (e) { return e instanceof Error ? e.message : 'Could not confirm this worker.'; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateStatus]);

  const decline = useCallback(async (applicationId: string): Promise<string | null> => {
    try {
      await updateStatus(applicationId, 'declined');
      qc.setQueryData<ApplicantCard[]>(key, (prev) => (prev ?? []).filter((a) => a.id !== applicationId));
      return null;
    } catch (e) { return e instanceof Error ? e.message : 'Could not decline this applicant.'; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateStatus]);

  return { applicants: q.data ?? [], isLoading: q.isLoading, approve, decline, updateStatus, refetch: q.refetch };
}
