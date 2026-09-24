import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { ArrivalStatus } from './useArrivalStatus';
import type { SwapStatus } from './useSwaps';

/** The latest swap the viewer started from their booking on this shift. */
export type ApplicationSwap = {
  id: string;
  status: SwapStatus;
  to_worker_id: string;
  to_username: string | null;
  note: string | null;
  created_at: string;
  responded_at: string | null;
  decided_at: string | null;
};

/** An open offer made TO the viewer for this shift. */
export type IncomingSwap = {
  id: string;
  status: 'offered';
  from_worker_id: string;
  from_username: string | null;
  from_photo_url: string | null;
  from_rating: number | string | null;
  note: string | null;
  created_at: string;
};

type RawStatus = {
  status: string | null;
  id?: string | null;
  arrival_status?: ArrivalStatus | null;
  arrival_status_at?: string | null;
  callout_reason?: string | null;
  swap?: ApplicationSwap | null;
  incoming_swap?: IncomingSwap | null;
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
    /** Why a withdrawn booking ended ('swap' when the spot was handed over). */
    calloutReason: query.data?.callout_reason ?? null,
    /** The latest swap the worker started from this booking, if any. */
    swap: query.data?.swap ?? null,
    /** An open swap offer made to the worker for this shift, if any. */
    incomingSwap: query.data?.incoming_swap ?? null,
    isLoading: query.isLoading,
    isError:   query.isError,
    refetch:   query.refetch,
  };
}
