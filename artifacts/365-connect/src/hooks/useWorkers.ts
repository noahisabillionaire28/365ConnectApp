import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { PeopleFeedUser } from './usePeopleFeed';

export function useWorkers() {
  const { user } = useAuth();

  const query = useQuery<PeopleFeedUser[], Error>({
    queryKey: ['workers'],
    queryFn: async () => apiClient(user?.id ?? null).get<PeopleFeedUser[]>('/workers?role=worker'),
    staleTime: 60_000,
  });

  return {
    workers:   query.data   ?? [],
    isLoading: query.isLoading,
    error:     query.error,
  };
}
