import { useQuery } from '@tanstack/react-query';
import { shiftRowToMockShift, type ShiftRow, type MockShift } from '@/lib/supabase';
import { apiClient } from '@/lib/api';
import { useProfile } from './useProfile';
import { useMyLocation } from './useMyLocation';

const FEED_RADIUS_MI = 25;

export function useWorkerHomeShifts() {
  const profile = useProfile();
  const { coords, loading: locLoading } = useMyLocation();

  const workerTypes = [profile.primaryJobType, ...profile.secondaryJobTypes].filter(Boolean) as string[];

  const query = useQuery<MockShift[], Error>({
    queryKey: ['worker-home-shifts', coords.lat, coords.lng],
    queryFn: async () => {
      const rows = await apiClient(null).get<ShiftRow[]>('/shifts?status=open');
      return rows.map((row) => shiftRowToMockShift(row, coords));
    },
    staleTime: 30_000,
    enabled: !locLoading,
  });

  const allShifts = query.data ?? [];
  const filtered = workerTypes.length
    ? allShifts.filter(
        (s) => s.jobTypes.some((t) => workerTypes.includes(t)) && s.distanceMiles <= FEED_RADIUS_MI,
      )
    : allShifts.filter((s) => s.distanceMiles <= FEED_RADIUS_MI);

  return {
    shifts: filtered,
    isLoading: query.isLoading || profile.isLoading || locLoading,
    error: query.error,
  };
}
