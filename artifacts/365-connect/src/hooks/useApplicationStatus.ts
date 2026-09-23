import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { ArrivalStatus } from './useArrivalStatus';

type RawStatus = {
  status: string | null;
  id?: string | null;
  arrival_status?: ArrivalStatus | null;
  arrival_status_at?: string | null;
};

export const APPLICATION_STATUS_KEY = 'application-status';

export function useApplicationStatus(shiftId: string | undefined) {
  const { user } = useAuth();
  const query = useQuery<RawStatus, Error>({
    queryKey: [APPLICATION_STATUS_KEY, shiftId, user?.id],
    queryFn: async () => {
      if (!shiftId || !user?.id) return { status: null };
      return apiClient(user.id).get<RawStatus>(`/applications/status/${shiftId}`);
    },
    enabled: !!shiftId && !!user?.id,
    staleTime: 30_000,
  });

  // Expose the actual application status (data.status), NOT the React Query
  // query state (query.status), to avoid a confusing shadowing bug.
  return {
    status:    query.data?.status ?? null as string | null,
    /** The worker's own application id (null when they never applied). */
    applicationId: query.data?.id ?? null,
    /** Day-of status the worker last reported for this shift. */
    arrivalStatus: query.data?.arrival_status ?? null,
    arrivalStatusAt: query.data?.arrival_status_at ?? null,
    isLoading: query.isLoading,
    isError:   query.isError,
    refetch:   query.refetch,
  };
}
