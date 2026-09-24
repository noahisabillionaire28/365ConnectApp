import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export type SavedWorker = {
  id: string;
  username: string | null;
  photo_url: string | null;
  role: string;
  rating: number;
  primary_job_type: string | null;
  job_types: string[];
  hourly_rate: number | null;
  bio: string | null;
  is_pro: boolean;
  saved_at: string;
};

// Keys carry the viewer's id: the query cache is persisted on the device, so
// without it a second account on the same phone would see the first one's list.
export const SAVED_WORKERS_KEY = 'saved-workers';
export const SAVED_STATUS_KEY = 'saved-status';

/** The caller's saved workers. */
export function useSavedWorkers() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: [SAVED_WORKERS_KEY, user?.id],
    enabled: !!user?.id,
    queryFn: () => apiClient(user!.id).get<SavedWorker[]>('/saved-workers'),
  });
  return { workers: q.data ?? [], isLoading: q.isLoading, refetch: q.refetch };
}

/** Saved status + optimistic save/unsave toggle for one worker. */
export function useSavedWorker(workerId?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const statusKey = [SAVED_STATUS_KEY, user?.id, workerId];
  const statusQ = useQuery({
    queryKey: statusKey,
    enabled: !!workerId && !!user?.id,
    queryFn: () => apiClient(user!.id).get<{ saved: boolean }>(`/saved-workers/status/${workerId}`),
  });
  const saved = statusQ.data?.saved ?? false;

  const mut = useMutation({
    mutationFn: (next: boolean) =>
      next
        ? apiClient(user!.id).post('/saved-workers', { worker_id: workerId })
        : apiClient(user!.id).delete(`/saved-workers/${workerId}`),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: statusKey });
      const prev = qc.getQueryData<{ saved: boolean }>(statusKey);
      qc.setQueryData(statusKey, { saved: next });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(statusKey, ctx.prev);
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: [SAVED_WORKERS_KEY, user?.id] }); },
  });

  return { saved, toggle: () => mut.mutate(!saved), isPending: mut.isPending };
}
