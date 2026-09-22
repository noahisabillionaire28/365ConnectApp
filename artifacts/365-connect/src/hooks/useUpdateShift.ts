import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { ShiftRow } from '@/lib/supabase';

/**
 * Update a shift the user owns. Throws on failure so screens can show the
 * server's message, and refreshes the shift itself plus every list that
 * shows it so the edit is visible immediately.
 */
export function useUpdateShift() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [isLoading, setLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const updateShift = useCallback(async (id: string, updates: Partial<ShiftRow>): Promise<ShiftRow> => {
    if (!user?.id) throw new Error('You must be signed in.');
    setLoading(true);
    setIsPending(true);
    setError(null);
    try {
      const row = await apiClient(user.id).patch<ShiftRow>(`/shifts/${id}`, updates);
      void qc.invalidateQueries({ queryKey: ['shift', id] });
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

  /**
   * React Query mutation compat alias.
   * Accepts a flat object `{ id, ...fields }`, a tuple `[id, updates]`,
   * or an object `{ id, updates }`.
   */
  const mutateAsync = useCallback(async (
    args: [string, Partial<ShiftRow>] | { id: string; updates?: Partial<ShiftRow> } & Partial<ShiftRow>,
  ): Promise<ShiftRow> => {
    if (Array.isArray(args)) return updateShift(args[0], args[1]);
    const { id, updates, ...rest } = args as { id: string; updates?: Partial<ShiftRow> } & Partial<ShiftRow>;
    return updateShift(id, updates ?? (rest as Partial<ShiftRow>));
  }, [updateShift]);

  return { updateShift, mutateAsync, isLoading, isPending, error };
}
