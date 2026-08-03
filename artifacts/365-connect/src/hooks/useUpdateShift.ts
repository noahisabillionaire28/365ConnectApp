import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { ShiftRow } from '@/lib/supabase';

export function useUpdateShift() {
  const { user } = useAuth();
  const [isLoading, setLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const updateShift = useCallback(async (id: string, updates: Partial<ShiftRow>): Promise<ShiftRow | null> => {
    if (!user?.id) return null;
    setLoading(true);
    setIsPending(true);
    setError(null);
    try {
      const row = await apiClient(user.id).patch<ShiftRow>(`/shifts/${id}`, updates);
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

  /**
   * React Query mutation compat alias.
   * Accepts a flat object `{ id, ...fields }`, a tuple `[id, updates]`,
   * or an object `{ id, updates }`.
   */
  const mutateAsync = useCallback(async (
    args: [string, Partial<ShiftRow>] | { id: string; updates?: Partial<ShiftRow> } & Partial<ShiftRow>,
  ): Promise<ShiftRow | null> => {
    if (Array.isArray(args)) return updateShift(args[0], args[1]);
    const { id, updates, ...rest } = args as { id: string; updates?: Partial<ShiftRow> } & Partial<ShiftRow>;
    return updateShift(id, updates ?? (rest as Partial<ShiftRow>));
  }, [updateShift]);

  return { updateShift, mutateAsync, isLoading, isPending, error };
}
