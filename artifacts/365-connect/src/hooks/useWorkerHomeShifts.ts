import { useQuery } from '@tanstack/react-query';
import { shiftRowToMockShift, type ShiftRow, type MockShift } from '@/lib/supabase';
import { apiClient } from '@/lib/api';
import { isShiftOver } from './useShifts';
import { useProfile } from './useProfile';
import { useMyLocation } from './useMyLocation';

const FEED_RADIUS_MI = 25;

export function useWorkerHomeShifts() {
  const profile = useProfile();
  const { coords, loading: locLoading, isDefault } = useMyLocation();

  const workerTypes = [profile.primaryJobType, ...profile.secondaryJobTypes].filter(Boolean) as string[];

  const query = useQuery<MockShift[], Error>({
    queryKey: ['worker-home-shifts', coords.lat, coords.lng],
    queryFn: async () => {
      const rows = await apiClient(null).get<ShiftRow[]>('/shifts?status=open');
      return rows.filter((r) => !isShiftOver(r)).map((row) => shiftRowToMockShift(row, coords));
    },
    staleTime: 30_000,
    enabled: !locLoading,
  });

  const allShifts = query.data ?? [];
  // With no real location the distances are measured from a fallback point,
  // so a radius filter would hide shifts at random: show everything instead.
  const nearby = (s: MockShift) => isDefault || s.distanceMiles <= FEED_RADIUS_MI;
  const filtered = workerTypes.length
    ? allShifts.filter((s) => s.jobTypes.some((t) => workerTypes.includes(t)) && nearby(s))
    : allShifts.filter(nearby);

  return {
    shifts: filtered,
    isLoading: query.isLoading || profile.isLoading || locLoading,
    error: query.error,
  };
}
