import { useQuery } from '@tanstack/react-query';
import { shiftRowToMockShift, type ShiftRow, type MockShift } from '@/lib/supabase';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useMyLocation } from './useMyLocation';

export function useMyPostedShifts() {
  const { user } = useAuth();
  const { coords } = useMyLocation();

  const query = useQuery<MockShift[], Error>({
    queryKey: ['my-posted-shifts', user?.id, coords.lat, coords.lng],
    queryFn: async () => {
      const rows = await apiClient(user?.id).get<ShiftRow[]>('/shifts/my');
      return rows.map((row) => shiftRowToMockShift(row, coords));
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  return { shifts: query.data ?? [], isLoading: query.isLoading, error: query.error };
}
