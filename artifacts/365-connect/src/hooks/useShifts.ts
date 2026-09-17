import { useQuery, useQueryClient } from '@tanstack/react-query';
import { shiftRowToMockShift, hardenShift, type ShiftRow, type MockShift } from '@/lib/supabase';
import { apiClient } from '@/lib/api';

export const SHIFTS_QUERY_KEY = ['shifts'] as const;

/** True once a shift is over (its end — or start, if no end — is in the past). */
export function isShiftOver(row: { start_time?: string | null; end_time?: string | null }): boolean {
  const ref = row.end_time ?? row.start_time;
  if (!ref) return false;
  const t = Date.parse(ref);
  return Number.isFinite(t) && t < Date.now();
}

/**
 * Fetches all open shifts from the API (past/over shifts are dropped).
 * Pass the viewer's coordinates so distances reflect where they actually are.
 */
export function useShifts(refCoords?: { lat: number; lng: number }) {
  const query = useQuery<MockShift[], Error>({
    queryKey: [...SHIFTS_QUERY_KEY, refCoords?.lat, refCoords?.lng],
    queryFn: async () => {
      const rows = await apiClient(null).get<ShiftRow[]>('/shifts?status=open');
      return rows.filter((r) => !isShiftOver(r)).map((row) => shiftRowToMockShift(row, refCoords));
    },
    // `select` also runs on cache-restored data, so an entry written by an
    // older build can never reach the UI with fields missing.
    select: (list) => list.map(hardenShift),
    staleTime: 30_000,
  });

  return {
    shifts:    query.data   ?? [],
    isLoading: query.isLoading,
    error:     query.error,
    refetch:   query.refetch,
  };
}

/** Fetches a single shift by ID. */
export function useShiftById(id: string | undefined, refCoords?: { lat: number; lng: number }) {
  return useQuery<MockShift, Error>({
    queryKey: ['shift', id, refCoords?.lat, refCoords?.lng],
    queryFn: async () => {
      if (!id) throw new Error('No shift ID provided');
      const row = await apiClient(null).get<ShiftRow>(`/shifts/${id}`);
      return shiftRowToMockShift(row, refCoords);
    },
    select: hardenShift,
    enabled: !!id,
    staleTime: 30_000,
  });
}
