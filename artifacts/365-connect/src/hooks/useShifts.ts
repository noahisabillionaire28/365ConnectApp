import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase, shiftRowToMockShift, type ShiftRow, type MockShift } from '@/lib/supabase';

export const SHIFTS_QUERY_KEY = ['shifts'] as const;

/**
 * Fetches all open shifts from Supabase and subscribes to real-time inserts.
 * Cache invalidates within 5 s of a new row appearing.
 */
export function useShifts() {
  const queryClient = useQueryClient();

  const query = useQuery<MockShift[], Error>({
    queryKey: SHIFTS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as ShiftRow[]).map((row) => shiftRowToMockShift(row));
    },
    staleTime: 30_000,
  });

  // Real-time: invalidate on any new shift insert
  useEffect(() => {
    const channel = supabase
      .channel('shifts-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'shifts' },
        () => {
          queryClient.invalidateQueries({ queryKey: SHIFTS_QUERY_KEY });
        }
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [queryClient]);

  return {
    shifts:    query.data   ?? [],
    isLoading: query.isLoading,
    error:     query.error,
  };
}

/**
 * Fetches a single shift by UUID — used by ShiftDetailScreen.
 * Accepts the viewer's own coordinates so `distanceMiles` (and therefore the
 * AI Match Score's distance component) reflects the real user, not a fallback.
 */
export function useShiftById(id: string | undefined, refCoords?: { lat: number; lng: number }) {
  return useQuery<MockShift, Error>({
    queryKey: ['shift', id, refCoords?.lat, refCoords?.lng],
    queryFn: async () => {
      if (!id) throw new Error('No shift ID provided');
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return shiftRowToMockShift(data as ShiftRow, refCoords);
    },
    enabled: !!id,
    staleTime: 30_000,
  });
}
