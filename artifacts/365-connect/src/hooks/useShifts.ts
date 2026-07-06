import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase, shiftRowToMockShift, type ShiftRow } from '@/lib/supabase';
import type { MockShift } from '@/data/mockFeed';

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
      return (data as ShiftRow[]).map(shiftRowToMockShift);
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
 */
export function useShiftById(id: string | undefined) {
  return useQuery<MockShift, Error>({
    queryKey: ['shift', id],
    queryFn: async () => {
      if (!id) throw new Error('No shift ID provided');
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return shiftRowToMockShift(data as ShiftRow);
    },
    enabled: !!id,
    staleTime: 30_000,
  });
}
