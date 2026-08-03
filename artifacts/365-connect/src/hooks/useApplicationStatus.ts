import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export function useApplicationStatus(shiftId: string | undefined) {
  const { user } = useAuth();
  const query = useQuery<{ status: string | null }, Error>({
    queryKey: ['application-status', shiftId, user?.id],
    queryFn: async () => {
      if (!shiftId || !user?.id) return { status: null };
      return apiClient(user.id).get<{ status: string | null }>(`/applications/status/${shiftId}`);
    },
    enabled: !!shiftId && !!user?.id,
    staleTime: 30_000,
  });

  // Expose the actual application status (data.status), NOT the React Query
  // query state (query.status), to avoid a confusing shadowing bug.
  return {
    status:    query.data?.status ?? null as string | null,
    isLoading: query.isLoading,
    isError:   query.isError,
    refetch:   query.refetch,
  };
}
