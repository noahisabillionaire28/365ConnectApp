import { useQuery } from '@tanstack/react-query';
import { supabase, shiftRowToMockShift, type ShiftRow } from '@/lib/supabase';
import type { MockShift } from '@/data/mockFeed';
import { useProfile } from './useProfile';
import { useMyLocation } from './useMyLocation';

/** Worker Home Feed radius — "reasonable distance" per spec. */
const FEED_RADIUS_MI = 25;

/**
 * Worker Home Feed (spec A): open shifts filtered by job-type intersection
 * with the worker's primary + secondary job types AND within a reasonable
 * distance of the worker's own location.
 */
export function useWorkerHomeShifts() {
  const profile = useProfile();
  const { coords, loading: locLoading } = useMyLocation();

  const workerTypes = [profile.primaryJobType, ...profile.secondaryJobTypes].filter(Boolean) as string[];

  const query = useQuery<MockShift[], Error>({
    queryKey: ['worker-home-shifts', coords.lat, coords.lng],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as ShiftRow[]).map((row) => shiftRowToMockShift(row, coords));
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
