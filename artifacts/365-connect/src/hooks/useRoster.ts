import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type RosterWorker = {
  id: string;
  username: string | null;
  photoUrl: string | null;
  isPro: boolean;
  primaryJobType: string | null;
  secondaryJobTypes: string[];
  rating: number;
};

/**
 * A staffer's roster of workers. Reuses the existing `follows` table —
 * a staffer's roster is simply the set of workers they follow — there is no
 * separate roster table.
 */
export function useRoster() {
  const { user } = useAuth();
  const [workers, setWorkers] = useState<RosterWorker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) { setWorkers([]); setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);

    const { data: followRows, error: followError } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id);

    if (followError) {
      console.error('[useRoster] follows fetch failed:', followError.message);
      setError(followError.message);
      setIsLoading(false);
      return;
    }

    const workerIds = (followRows ?? []).map((r) => r.following_id as string);
    if (workerIds.length === 0) {
      setWorkers([]);
      setIsLoading(false);
      return;
    }

    const { data: userRows, error: usersError } = await supabase
      .from('users')
      .select('id, username, photo_url, is_pro, primary_job_type, secondary_job_types, rating, role')
      .in('id', workerIds)
      .eq('role', 'worker')
      .order('username', { ascending: true });

    if (usersError) {
      console.error('[useRoster] users fetch failed:', usersError.message);
      setError(usersError.message);
      setIsLoading(false);
      return;
    }

    setWorkers(
      (userRows ?? []).map((u) => ({
        id: u.id as string,
        username: u.username as string | null,
        photoUrl: u.photo_url as string | null,
        isPro: !!u.is_pro,
        primaryJobType: u.primary_job_type as string | null,
        secondaryJobTypes: (u.secondary_job_types as string[] | null) ?? [],
        rating: (u.rating as number | null) ?? 0,
      })),
    );
    setIsLoading(false);
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  async function remove(workerId: string) {
    if (!user?.id) return;
    const prev = workers;
    setWorkers((cur) => cur.filter((w) => w.id !== workerId)); // optimistic
    const { error: deleteError } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('following_id', workerId);
    if (deleteError) {
      console.error('[useRoster] remove failed:', deleteError.message);
      setWorkers(prev); // rollback
      setError(deleteError.message);
    }
  }

  return { workers, isLoading, error, remove, refetch: load };
}
