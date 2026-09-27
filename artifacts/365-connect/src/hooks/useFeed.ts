import { useInfiniteQuery, useQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
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

/** Posts per page; the server caps a page at 50. */
export const FEED_PAGE = 20;

type FeedData = InfiniteData<FeedPost[], number>;

/** Longest a caption may be (mirrors the server's MAX_CAPTION). */
export const MAX_CAPTION = 2200;

/**
 * Global content feed — newest photo posts from everyone, loaded a page at a
 * time. `loadMore` fetches the next page; `hasMore` is false once a page
 * comes back short.
 */
export function useFeed() {
  const { user } = useAuth();
  const q = useInfiniteQuery<FeedPost[], Error, FeedData, readonly ['feed'], number>({
    queryKey: ['feed'],
    enabled: !!user?.id,
    staleTime: 30_000,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      apiClient(user!.id).get<FeedPost[]>(`/posts/feed?limit=${FEED_PAGE}&offset=${pageParam}`),
    getNextPageParam: (lastPage, pages) =>
      lastPage.length < FEED_PAGE ? undefined : pages.reduce((n, p) => n + p.length, 0),
  });
  const posts = q.data?.pages.flat() ?? [];
  return {
    posts,
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: q.refetch,
    hasMore: q.hasNextPage,
    isLoadingMore: q.isFetchingNextPage,
    loadMore: () => { if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage(); },
  };
}

/** Apply `fn` to every post in the paged feed cache (no-op when it is empty). */
function mapFeed(old: FeedData | undefined, fn: (p: FeedPost) => FeedPost | null): FeedData | undefined {
  if (!old) return old;
  return {
    ...old,
    pages: old.pages.map((page) => page.map(fn).filter((p): p is FeedPost => p !== null)),
  };
}

/** Posts tagged with a given hashtag. */
export function useHashtagFeed(tag?: string) {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ['hashtag', tag],
    enabled: !!tag && !!user?.id,
    staleTime: 30_000,
    queryFn: () => apiClient(user!.id).get<FeedPost[]>(`/posts/hashtag/${tag}`),
  });
  return { posts: q.data ?? [], isLoading: q.isLoading };
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
      const prevFeed = qc.getQueryData<FeedData>(['feed']);
      qc.setQueryData<FeedData>(['feed'], (old) => mapFeed(old, (p) => (p.id === postId ? bump(p) : p)));
      qc.setQueryData<FeedPost>(['post', postId], (old) => (old ? bump(old) : old));
      return { prevFeed };
    },
    onError: (_e, _postId, ctx) => {
      if (ctx?.prevFeed) qc.setQueryData(['feed'], ctx.prevFeed);
    },
  });
}

/** Delete a post (author or admin). Removes it from the feed cache. */
export function useDeletePost() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => apiClient(user!.id).delete(`/posts/${postId}`),
    onSuccess: (_data, postId) => {
      qc.setQueryData<FeedData>(['feed'], (old) => mapFeed(old, (p) => (p.id === postId ? null : p)));
      qc.invalidateQueries({ queryKey: ['posts'] });
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
