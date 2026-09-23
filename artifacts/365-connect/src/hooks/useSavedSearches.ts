import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export const SAVED_SEARCHES_KEY = ['saved-searches'] as const;
export const MAX_SAVED_SEARCHES = 3;

type RawSavedSearch = {
  id: string;
  user_id: string;
  job_types: string[] | null;
  max_distance_miles: number | string | null;
  min_pay: number | string | null;
  event_type: string | null;
  created_at: string;
  last_notified_at: string | null;
};

export type SavedSearch = {
  id: string;
  jobTypes: string[];
  maxDistanceMiles: number | null;
  minPay: number | null;
  eventType: string | null;
  createdAt: string;
  lastNotifiedAt: string | null;
};

export type SavedSearchInput = {
  jobTypes?: string[];
  maxDistanceMiles?: number | null;
  minPay?: number | null;
  eventType?: string | null;
};

const num = (v: number | string | null | undefined): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function toSavedSearch(r: RawSavedSearch): SavedSearch {
  return {
    id: r.id,
    jobTypes: r.job_types ?? [],
    maxDistanceMiles: num(r.max_distance_miles),
    minPay: num(r.min_pay),
    eventType: r.event_type ?? null,
    createdAt: r.created_at,
    lastNotifiedAt: r.last_notified_at ?? null,
  };
}

/** "Bartender · $30+/hr · < 3 mi · Wedding" */
export function savedSearchLabel(s: SavedSearch): string {
  const bits: string[] = [];
  if (s.jobTypes.length) bits.push(s.jobTypes.join(', '));
  if (s.eventType) bits.push(s.eventType);
  if (s.minPay != null) bits.push(`$${s.minPay}+/hr`);
  if (s.maxDistanceMiles != null) bits.push(`< ${s.maxDistanceMiles} mi`);
  return bits.join(' · ') || 'All shifts';
}

/** Two filter sets describe the same search. */
export function sameSearch(a: SavedSearchInput, b: SavedSearch): boolean {
  const at = [...(a.jobTypes ?? [])].sort().join('|');
  const bt = [...b.jobTypes].sort().join('|');
  return at === bt
    && (a.maxDistanceMiles ?? null) === b.maxDistanceMiles
    && (a.minPay ?? null) === b.minPay
    && (a.eventType ?? null) === b.eventType;
}

/** The worker's saved searches, plus save/remove. Only fetched for workers. */
export function useSavedSearches(enabled = true) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = [...SAVED_SEARCHES_KEY, user?.id];

  const q = useQuery<SavedSearch[], Error>({
    queryKey: key,
    enabled: !!user?.id && enabled,
    staleTime: 60_000,
    queryFn: async () => (await apiClient(user!.id).get<RawSavedSearch[]>('/saved-searches')).map(toSavedSearch),
  });

  const save = useMutation<SavedSearch, Error, SavedSearchInput>({
    mutationFn: async (input) => toSavedSearch(await apiClient(user!.id).post<RawSavedSearch>('/saved-searches', {
      job_types: input.jobTypes ?? [],
      max_distance_miles: input.maxDistanceMiles ?? null,
      min_pay: input.minPay ?? null,
      event_type: input.eventType ?? null,
    })),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: SAVED_SEARCHES_KEY }); },
  });

  const remove = useMutation<void, Error, string>({
    mutationFn: async (id) => { await apiClient(user!.id).delete(`/saved-searches/${id}`); },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      qc.setQueryData<SavedSearch[]>(key, (prev) => (prev ?? []).filter((s) => s.id !== id));
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: SAVED_SEARCHES_KEY }); },
  });

  return {
    searches: q.data ?? [],
    isLoading: q.isLoading,
    save: save.mutateAsync,
    saving: save.isPending,
    remove: remove.mutate,
    canSaveMore: (q.data?.length ?? 0) < MAX_SAVED_SEARCHES,
  };
}
