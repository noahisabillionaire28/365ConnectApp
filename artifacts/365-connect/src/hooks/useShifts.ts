import { useQuery, useQueryClient } from '@tanstack/react-query';
import { shiftRowToMockShift, type ShiftRow, type MockShift } from '@/lib/supabase';
import { apiClient } from '@/lib/api';

export const SHIFTS_QUERY_KEY = ['shifts'] as const;

/** Fetches all open shifts from the API. */
export function useShifts() {
  const query = useQuery<MockShift[], Error>({
    queryKey: SHIFTS_QUERY_KEY,
    queryFn: async () => {
      const rows = await apiClient(null).get<ShiftRow[]>('/shifts?status=open');
      return rows.map((row) => shiftRowToMockShift(row));
    },
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
    enabled: !!id,
    staleTime: 30_000,
  });
}
