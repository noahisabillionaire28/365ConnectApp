import { useState, useEffect, useCallback } from 'react';
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

export function useRoster() {
  const { user } = useAuth();
  const [roster, setRoster]     = useState<RosterWorker[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) { setRoster([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const rows = await apiClient(user.id).get<(RosterWorker & { is_pro: boolean; primary_job_type: string | null; photo_url: string | null })[]>('/follows/roster');
      setRoster(rows.map((r) => ({
        ...r,
        photoUrl:       r.photo_url,
        primaryJobType: r.primary_job_type,
        isPro:          r.is_pro,
      })));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  const removeFromRoster = useCallback(async (workerId: string): Promise<void> => {
    if (!user?.id) return;
    setRoster((prev) => prev.filter((w) => w.id !== workerId));
    try {
      await apiClient(user.id).delete(`/follows/${workerId}`);
    } catch (e) {
      console.error('[useRoster] remove failed:', e);
      await load();
    }
  }, [user?.id, load]);

  const addToRoster = useCallback(async (workerId: string): Promise<void> => {
    if (!user?.id) return;
    try {
      await apiClient(user.id).post('/follows', { following_id: workerId });
      await load();
    } catch (e) {
      console.error('[useRoster] add failed:', e);
    }
  }, [user?.id, load]);

  return {
    roster,
    workers:          roster,           // alias for pages that use `workers`
    isLoading,
    error,
    removeFromRoster,
    remove:           removeFromRoster, // alias for pages that use `remove`
    addToRoster,
    refetch: load,
  };
}
