import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export type EventPosition = {
  id: string;
  job_type: string | null;
  pay_rate: number | null;
  pay_period: string | null;
  spots_available: number;
  spots_filled: number;
  status: string;
};

/** All positions (shifts) belonging to one multi-position event. */
export function useEventPositions(eventId: string | null | undefined) {
  const q = useQuery({
    queryKey: ['event-positions', eventId],
    enabled: !!eventId,
    staleTime: 20_000,
    queryFn: () => apiClient(null).get<EventPosition[]>(`/shifts?event_id=${eventId}`),
  });
  return { positions: q.data ?? [], isLoading: q.isLoading };
}
