import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

/** Follower + following counts for any user (Instagram-style profile stats). */
export function useFollowCounts(userId?: string) {
  const q = useQuery({
    queryKey: ['follow-counts', userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: () => apiClient(null).get<{ followers: number; following: number }>(`/follows/counts/${userId}`),
  });
  return { followers: q.data?.followers ?? 0, following: q.data?.following ?? 0 };
}
