import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

/** Raw DB shape returned by the applications list endpoint */
type RawApplicant = {
  id: string;
  shift_id: string;
  worker_id: string;
  status: 'pending' | 'accepted' | 'declined';
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

export function useShiftApplicants(shiftId: string | undefined) {
  const { user } = useAuth();
  const [applicants, setApplicants] = useState<ApplicantCard[]>([]);
  const [isLoading, setLoading]     = useState(true);

  const load = useCallback(async () => {
    if (!shiftId || !user?.id) { setApplicants([]); setLoading(false); return; }
    setLoading(true);
    try {
      const rows = await apiClient(user.id).get<RawApplicant[]>(`/applications?shift_id=${shiftId}`);
      setApplicants(rows.map((r) => ({
        ...r,
        applicationId: r.id,
        photoUrl:      r.photo_url,
        matchScore:    r.match_score ?? null,
        jobTypes:      r.job_types,
        primaryJobType: r.primary_job_type,
      })));
    } catch (e) {
      console.error('[useShiftApplicants] load failed:', e);
    } finally {
      setLoading(false);
    }
  }, [shiftId, user?.id]);

  useEffect(() => { void load(); }, [load]);

  const updateStatus = useCallback(async (applicationId: string, status: string): Promise<void> => {
    try {
      await apiClient(user?.id).patch(`/applications/${applicationId}`, { status });
      setApplicants((prev) => prev.map((a) =>
        a.id === applicationId ? { ...a, status: status as ApplicantCard['status'] } : a,
      ));
    } catch (e) {
      console.error('[useShiftApplicants] updateStatus failed:', e);
      throw e;
    }
  }, [user?.id]);

  const approve = useCallback(async (applicationId: string): Promise<boolean> => {
    try {
      await updateStatus(applicationId, 'accepted');
      setApplicants((prev) => prev.filter((a) => a.id !== applicationId));
      return true;
    } catch { return false; }
  }, [updateStatus]);

  const decline = useCallback(async (applicationId: string): Promise<boolean> => {
    try {
      await updateStatus(applicationId, 'declined');
      setApplicants((prev) => prev.filter((a) => a.id !== applicationId));
      return true;
    } catch { return false; }
  }, [updateStatus]);

  return { applicants, isLoading, approve, decline, updateStatus, refetch: load };
}
