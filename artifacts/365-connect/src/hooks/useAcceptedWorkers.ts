import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type AcceptedWorker = {
  workerId: string;
  username: string | null;
  photoUrl: string | null;
  completed: boolean;
  alreadyReviewed: boolean;
};

/** Accepted workers on a shift the current user (client/staffer) owns, with completion + review state — for the "Rate this worker" list on Shift Detail. */
export function useAcceptedWorkers(shiftId: string | undefined, viewerId: string | undefined) {
  const [workers, setWorkers] = useState<AcceptedWorker[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!shiftId || !viewerId) { setWorkers([]); setIsLoading(false); return; }
    setIsLoading(true);

    const { data: apps, error: appsError } = await supabase
      .from('applications')
      .select('worker_id')
      .eq('shift_id', shiftId)
      .eq('status', 'accepted');

    if (appsError || !apps || apps.length === 0) {
      if (appsError) console.error('[useAcceptedWorkers] fetch failed:', appsError.message);
      setWorkers([]);
      setIsLoading(false);
      return;
    }

    const workerIds = apps.map((a) => a.worker_id as string);

    const [{ data: users }, { data: entries }, { data: reviews }] = await Promise.all([
      supabase.from('users').select('id, username, photo_url').in('id', workerIds),
      supabase.from('time_entries').select('worker_id, clock_out').eq('shift_id', shiftId).in('worker_id', workerIds),
      supabase.from('reviews_visible').select('reviewee_id').eq('shift_id', shiftId).eq('reviewer_id', viewerId).in('reviewee_id', workerIds),
    ]);

    const usersById   = new Map((users   ?? []).map((u) => [u.id as string, u]));
    const entryById    = new Map((entries ?? []).map((e) => [e.worker_id as string, e]));
    const reviewedSet  = new Set((reviews ?? []).map((r) => r.reviewee_id as string));

    setWorkers(
      workerIds.map((id) => ({
        workerId:        id,
        username:        usersById.get(id)?.username ?? null,
        photoUrl:        usersById.get(id)?.photo_url ?? null,
        completed:       !!entryById.get(id)?.clock_out,
        alreadyReviewed: reviewedSet.has(id),
      })),
    );
    setIsLoading(false);
  }, [shiftId, viewerId]);

  useEffect(() => { void load(); }, [load]);

  return { workers, isLoading, refetch: load };
}
