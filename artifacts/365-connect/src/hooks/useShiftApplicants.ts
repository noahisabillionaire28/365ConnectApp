import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type ApplicantCard = {
  applicationId: string;
  workerId: string;
  username: string | null;
  photoUrl: string | null;
  bio: string | null;
  jobTypes: string[];
  rating: number;
  matchScore: number | null;
  appliedAt: string;
};

/**
 * Pending applicants for a shift the current user owns (client/staffer).
 * Powers the Tinder-style Applicants swipe screen — RLS already restricts
 * `applications` reads to the shift owner or the applying worker, so this
 * naturally returns nothing if the viewer isn't the shift's client.
 */
export function useShiftApplicants(shiftId: string | undefined) {
  const [applicants, setApplicants] = useState<ApplicantCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!shiftId) { setApplicants([]); setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);

    const { data: apps, error: appsError } = await supabase
      .from('applications')
      .select('id, worker_id, match_score, created_at')
      .eq('shift_id', shiftId)
      .eq('status', 'pending')
      .order('match_score', { ascending: false, nullsFirst: false });

    if (appsError) {
      console.error('[useShiftApplicants] fetch failed:', appsError.message);
      setError(appsError.message);
      setIsLoading(false);
      return;
    }

    const rows = apps ?? [];
    if (rows.length === 0) {
      setApplicants([]);
      setIsLoading(false);
      return;
    }

    const workerIds = rows.map((r) => r.worker_id as string);
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, username, photo_url, bio, job_types, rating')
      .in('id', workerIds);

    if (usersError) {
      console.error('[useShiftApplicants] worker fetch failed:', usersError.message);
      setError(usersError.message);
      setIsLoading(false);
      return;
    }

    const byId = new Map((users ?? []).map((u) => [u.id as string, u]));
    setApplicants(
      rows.map((r) => {
        const u = byId.get(r.worker_id as string);
        return {
          applicationId: r.id as string,
          workerId:      r.worker_id as string,
          username:      u?.username ?? null,
          photoUrl:      u?.photo_url ?? null,
          bio:           u?.bio ?? null,
          jobTypes:      u?.job_types ?? [],
          rating:        u?.rating ?? 0,
          matchScore:    r.match_score as number | null,
          appliedAt:     r.created_at as string,
        };
      }),
    );
    setIsLoading(false);
  }, [shiftId]);

  useEffect(() => { void load(); }, [load]);

  async function decide(applicationId: string, decision: 'accepted' | 'declined') {
    // Optimistic: pull the card immediately
    setApplicants((prev) => prev.filter((a) => a.applicationId !== applicationId));
    const { error: updateError } = await supabase
      .from('applications')
      .update({ status: decision })
      .eq('id', applicationId);
    if (updateError) {
      console.error('[useShiftApplicants] decision failed:', updateError.message);
      void load(); // reload to restore true state on failure
    }
  }

  return { applicants, isLoading, error, approve: (id: string) => decide(id, 'accepted'), decline: (id: string) => decide(id, 'declined'), refetch: load };
}
