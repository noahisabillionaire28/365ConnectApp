import { useCallback } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export type RosterWorker = {
  id: string;
  username: string | null;
  photo_url: string | null;
  /** camelCase alias */
  photoUrl: string | null;
  role: string;
  rating: number;
  job_types: string[];
  primary_job_type: string | null;
  /** camelCase alias */
  primaryJobType: string | null;
  is_pro: boolean;
  /** camelCase alias */
  isPro: boolean;
  company_name: string | null;
  followed_at: string;
};

export const ROSTER_KEY = 'roster';

export function useRoster() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = [ROSTER_KEY, user?.id];

  const q = useQuery<RosterWorker[], Error>({
    queryKey: key,
    enabled: !!user?.id,
    staleTime: 20_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const rows = await apiClient(user!.id).get<(RosterWorker & { is_pro: boolean; primary_job_type: string | null; photo_url: string | null })[]>('/follows/roster');
      return rows.map((r) => ({
        ...r,
        photoUrl:       r.photo_url,
        primaryJobType: r.primary_job_type,
        isPro:          r.is_pro,
      }));
    },
  });

  const removeFromRoster = useCallback(async (workerId: string): Promise<void> => {
    if (!user?.id) return;
    qc.setQueryData<RosterWorker[]>(key, (prev) => (prev ?? []).filter((w) => w.id !== workerId));
    try {
      await apiClient(user.id).delete(`/follows/${workerId}`);
      void qc.invalidateQueries({ queryKey: ['follow', workerId] });
    } catch (e) {
      console.error('[useRoster] remove failed:', e);
      void qc.invalidateQueries({ queryKey: key });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const addToRoster = useCallback(async (workerId: string): Promise<void> => {
    if (!user?.id) return;
    try {
      await apiClient(user.id).post('/follows', { following_id: workerId });
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: ['follow', workerId] });
    } catch (e) {
      console.error('[useRoster] add failed:', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const roster = q.data ?? [];
  return {
    roster,
    workers:          roster,           // alias for pages that use `workers`
    isLoading:        q.isLoading,
    error:            q.error ? q.error.message : null,
    removeFromRoster,
    remove:           removeFromRoster, // alias for pages that use `remove`
    addToRoster,
    refetch: q.refetch,
  };
}
