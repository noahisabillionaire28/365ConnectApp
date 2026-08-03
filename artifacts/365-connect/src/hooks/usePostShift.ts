import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { ShiftRow } from '@/lib/supabase';

export function usePostShift() {
  const { user } = useAuth();
  const [isLoading, setLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const postShift = useCallback(async (shiftData: Partial<ShiftRow>): Promise<ShiftRow | null> => {
    if (!user?.id) return null;
    setLoading(true);
    setIsPending(true);
    setError(null);
    try {
      const row = await apiClient(user.id).post<ShiftRow>('/shifts', shiftData);
      return row;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      return null;
    } finally {
      setLoading(false);
      setIsPending(false);
    }
  }, [user?.id]);

  /** React Query mutation compat alias */
  const mutateAsync = postShift;

  return { postShift, mutateAsync, isLoading, isPending, error };
}
