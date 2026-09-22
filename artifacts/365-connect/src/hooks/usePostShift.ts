import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { ShiftRow } from '@/lib/supabase';

/**
 * Create a shift. Throws on failure (validation errors from the server are
 * meant to be shown to the poster), and refreshes every list that shows the
 * poster's shifts so the new one appears immediately.
 */
export function usePostShift() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [isLoading, setLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const postShift = useCallback(async (shiftData: Partial<ShiftRow>): Promise<ShiftRow> => {
    if (!user?.id) throw new Error('You must be signed in to post a shift.');
    setLoading(true);
    setIsPending(true);
    setError(null);
    try {
      const row = await apiClient(user.id).post<ShiftRow>('/shifts', shiftData);
      void qc.invalidateQueries({ queryKey: ['client-shifts'] });
      void qc.invalidateQueries({ queryKey: ['my-posted-shifts'] });
      void qc.invalidateQueries({ queryKey: ['shifts'] });
      return row;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
      setIsPending(false);
    }
  }, [user?.id, qc]);

  /** React Query mutation compat alias */
  const mutateAsync = postShift;

  return { postShift, mutateAsync, isLoading, isPending, error };
}
