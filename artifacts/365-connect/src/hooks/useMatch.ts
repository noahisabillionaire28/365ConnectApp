import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export type MatchCandidate = {
  worker_id: string;
  score: number;
  reason: string;
  source: 'rules' | 'claude';
  history: {
    shifts_with_you: number;
    shifts_worked: number;
    no_shows: number;
    on_time_rate: number | null;
    distance_miles: number | null;
  };
};

/** Owner view: every candidate on a shift, best first, each with a one-line reason. */
export function useShiftRanking(shiftId: string | undefined, enabled = true) {
  const { user } = useAuth();
  const q = useQuery<{ ai: boolean; candidates: MatchCandidate[] }, Error>({
    queryKey: ['match-ranking', shiftId, user?.id],
    enabled: !!shiftId && !!user?.id && enabled,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    queryFn: () => apiClient(user!.id).get(`/match/shift/${shiftId}`),
  });
  const byWorker = new Map((q.data?.candidates ?? []).map((c) => [c.worker_id, c]));
  return { ai: !!q.data?.ai, candidates: q.data?.candidates ?? [], byWorker, isLoading: q.isLoading };
}

/** Worker view: how well I fit this shift, and why. */
export function useMyMatch(shiftId: string | undefined, enabled = true) {
  const { user } = useAuth();
  const q = useQuery<{ ai: boolean; score: number; reason: string; source: 'rules' | 'claude' }, Error>({
    queryKey: ['match-me', shiftId, user?.id],
    enabled: !!shiftId && !!user?.id && enabled,
    staleTime: 10 * 60_000,
    placeholderData: keepPreviousData,
    queryFn: () => apiClient(user!.id).get(`/match/me/${shiftId}`),
  });
  return { insight: q.data ?? null, isLoading: q.isLoading };
}
