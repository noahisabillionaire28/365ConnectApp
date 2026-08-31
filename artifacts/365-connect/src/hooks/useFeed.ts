import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export type FeedPost = {
  id: string;
  user_id: string;
  photo_url: string | null;
  caption: string | null;
  created_at: string;
  author_username: string | null;
  author_photo_url: string | null;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
};

/** Global content feed — newest photo posts from everyone. */
export function useFeed() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ['feed'],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: () => apiClient(user!.id).get<FeedPost[]>('/posts/feed'),
  });
  return { posts: q.data ?? [], isLoading: q.isLoading, isError: q.isError, refetch: q.refetch };
}

/** Single post (used by the post-detail / comments screen). */
export function usePost(postId?: string) {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ['post', postId],
    enabled: !!postId && !!user?.id,
    queryFn: () => apiClient(user!.id).get<FeedPost>(`/posts/detail/${postId}`),
  });
  return { post: q.data, isLoading: q.isLoading, isError: q.isError, refetch: q.refetch };
}

/** Optimistic like/unlike toggle. Updates both the feed and post-detail caches. */
export function useToggleLike() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const bump = (p: FeedPost): FeedPost => ({
    ...p,
    liked_by_me: !p.liked_by_me,
    like_count: Math.max(0, p.like_count + (p.liked_by_me ? -1 : 1)),
  });
  return useMutation({
    mutationFn: (postId: string) =>
      apiClient(user!.id).post<{ liked: boolean; like_count: number }>(`/posts/${postId}/like`, {}),
    onMutate: async (postId) => {
      await qc.cancelQueries({ queryKey: ['feed'] });
      const prevFeed = qc.getQueryData<FeedPost[]>(['feed']);
      qc.setQueryData<FeedPost[]>(['feed'], (old) =>
        (old ?? []).map((p) => (p.id === postId ? bump(p) : p)));
      qc.setQueryData<FeedPost>(['post', postId], (old) => (old ? bump(old) : old));
      return { prevFeed };
    },
    onError: (_e, _postId, ctx) => {
      if (ctx?.prevFeed) qc.setQueryData(['feed'], ctx.prevFeed);
    },
  });
}

/** Create a new photo post from the feed composer. */
export function useCreatePost() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { photo_url: string; caption: string | null }) =>
      apiClient(user!.id).post('/posts', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['posts'] });
    },
  });
}
