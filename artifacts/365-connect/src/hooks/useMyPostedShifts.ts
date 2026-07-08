import { useQuery } from '@tanstack/react-query';
import { supabase, shiftRowToMockShift, type ShiftRow } from '@/lib/supabase';
import type { MockShift } from '@/data/mockFeed';
import { useAuth } from '@/contexts/AuthContext';
import { useMyLocation } from './useMyLocation';

/** Client/staffer's own posted shifts — used by the Jobs map (spec D). */
export function useMyPostedShifts() {
  const { user } = useAuth();
  const { coords } = useMyLocation();

  const query = useQuery<MockShift[], Error>({
    queryKey: ['my-posted-shifts', user?.id, coords.lat, coords.lng],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('client_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as ShiftRow[]).map((row) => shiftRowToMockShift(row, coords));
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  return { shifts: query.data ?? [], isLoading: query.isLoading, error: query.error };
}
