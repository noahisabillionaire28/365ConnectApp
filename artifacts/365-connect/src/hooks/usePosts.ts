import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export type PostRow = {
  id: string;
  user_id: string;
  photo_url: string | null;
  caption: string | null;
  created_at: string;
};

/** Fetch a user's posts (newest first) for the profile photo grid. */
export function usePosts(userId: string | undefined) {
  return useQuery<PostRow[], Error>({
    queryKey: ['posts', userId],
    queryFn: async () => {
      if (!userId) return [];
      return apiClient(null).get<PostRow[]>(`/posts/${encodeURIComponent(userId)}`);
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}
