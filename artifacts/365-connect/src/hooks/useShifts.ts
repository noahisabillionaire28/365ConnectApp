import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { shiftRowToMockShift, hardenShift, type ShiftRow, type MockShift } from '@/lib/supabase';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export const SHIFTS_QUERY_KEY = ['shifts'] as const;
const PAGE_SIZE = 50;

/** True once a shift is over (its end — or start, if no end — is in the past). */
export function isShiftOver(row: { start_time?: string | null; end_time?: string | null }): boolean {
  const ref = row.end_time ?? row.start_time;
  if (!ref) return false;
  const t = Date.parse(ref);
  return Number.isFinite(t) && t < Date.now();
}

/**
 * Open shifts for the Jobs feed, soonest first, in pages of 50. The server
 * already drops ended shifts and hides roster-only shifts the viewer can't
 * take. Call `loadMore()` to fetch the next page; `hasMore` says if one exists.
 * Pass the viewer's coordinates so distances reflect where they actually are.
 */
export function useShifts(refCoords?: { lat: number; lng: number }) {
  const { user } = useAuth();
  const query = useInfiniteQuery<MockShift[], Error>({
    queryKey: [...SHIFTS_QUERY_KEY, user?.id ?? 'anon', refCoords?.lat, refCoords?.lng],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const offset = Number(pageParam) || 0;
      const rows = await apiClient(user?.id ?? null).get<ShiftRow[]>(`/shifts?status=open&limit=${PAGE_SIZE}&offset=${offset}`);
      return rows.filter((r) => !isShiftOver(r)).map((row) => shiftRowToMockShift(row, refCoords));
    },
    getNextPageParam: (lastPage, allPages) => (lastPage.length < PAGE_SIZE ? undefined : allPages.length * PAGE_SIZE),
    // `select` also runs on cache-restored data, so an entry written by an
    // older build can never reach the UI with fields missing.
    select: (data) => ({ ...data, pages: data.pages.map((p) => p.map(hardenShift)) }),
    staleTime: 30_000,
  });

  const shifts = query.data?.pages.flat() ?? [];
  return {
    shifts,
    isLoading: query.isLoading,
    error:     query.error,
    refetch:   query.refetch,
    hasMore:   !!query.hasNextPage,
    isFetchingMore: query.isFetchingNextPage,
    loadMore:  () => { if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage(); },
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

/** Invalidate every cached shift list (after posting, editing or booking). */
export function useInvalidateShifts() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: SHIFTS_QUERY_KEY });
    void qc.invalidateQueries({ queryKey: ['worker-home-shifts'] });
  };
}
