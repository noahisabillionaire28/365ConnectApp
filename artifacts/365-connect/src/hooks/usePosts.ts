import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { FeedPost } from '@/hooks/useFeed';

/** @deprecated use FeedPost — a user's posts now carry the same fields as the feed. */
export type PostRow = FeedPost;

/** Fetch a user's posts (newest first) in feed shape, so a profile can render them as a feed. */
export function usePosts(userId: string | undefined) {
  const { user } = useAuth();
  return useQuery<FeedPost[], Error>({
    queryKey: ['posts', userId, user?.id ?? 'anon'],
    queryFn: async () => {
      if (!userId) return [];
      return apiClient(user?.id ?? null).get<FeedPost[]>(`/posts/${encodeURIComponent(userId)}`);
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}
