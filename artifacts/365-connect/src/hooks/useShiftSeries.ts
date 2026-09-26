import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { ShiftRow } from '@/lib/supabase';
import type { RepeatRule } from '@/lib/recurrence';

export type SeriesShift = {
  id: string;
  title: string | null;
  start_time: string;
  end_time: string;
  timezone: string | null;
  status: string;
  spots_available: number;
  spots_filled: number;
  series_index: number;
  series_count: number;
};

export type ShiftSeries = {
  id: string;
  client_id: string;
  title: string;
  rule: Record<string, unknown>;
  timezone: string;
  created_at: string;
  shifts: SeriesShift[];
};

export type PostSeriesInput = Partial<ShiftRow> & {
  occurrences: string[];
  rule?: { type: Exclude<RepeatRule['type'], 'none'>; weekdays?: number[]; ends?: 'on' | 'after'; end_date?: string; count?: number };
};

function invalidateShiftLists(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['client-shifts'] });
  void qc.invalidateQueries({ queryKey: ['my-posted-shifts'] });
  void qc.invalidateQueries({ queryKey: ['shifts'] });
  void qc.invalidateQueries({ queryKey: ['shift-series'] });
}

/**
 * Create a recurring series: one shift per local date. Throws on failure
 * (the server's message names any dates that have already passed).
 */
export function usePostShiftSeries() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const postSeries = useCallback(async (input: PostSeriesInput): Promise<{ series_id: string; shifts: ShiftRow[] }> => {
    if (!user?.id) throw new Error('You must be signed in to post a shift.');
    setIsPending(true);
    setError(null);
    try {
      const out = await apiClient(user.id).post<{ series_id: string; shifts: ShiftRow[] }>('/shifts/series', input);
      invalidateShiftLists(qc);
      return out;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setIsPending(false);
    }
  }, [user?.id, qc]);

  return { postSeries, mutateAsync: postSeries, isPending, error };
}

/** Every shift in a series, oldest first (owner only). */
export function useSeriesShifts(seriesId: string | null | undefined) {
  const { user } = useAuth();
  const q = useQuery<ShiftSeries, Error>({
    queryKey: ['shift-series', seriesId],
    enabled: !!seriesId && !!user?.id,
    staleTime: 20_000,
    queryFn: () => apiClient(user!.id).get<ShiftSeries>(`/shifts/series/${seriesId}`),
  });
  return { series: q.data ?? null, shifts: q.data?.shifts ?? [], isLoading: q.isLoading };
}

/** Cancel a shift and every later, not-yet-started shift in its series. */
export function useCancelSeriesFuture() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const m = useMutation<{ cancelled: number; ids: string[] }, Error, string>({
    mutationFn: (shiftId) => apiClient(user!.id).post<{ cancelled: number; ids: string[] }>(`/shifts/${shiftId}/cancel-series-future`, {}),
    onSuccess: (_out, shiftId) => {
      void qc.invalidateQueries({ queryKey: ['shift', shiftId] });
      invalidateShiftLists(qc);
    },
  });
  return { cancelFuture: m.mutateAsync, busy: m.isPending };
}
