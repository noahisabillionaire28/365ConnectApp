import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export type Story = {
  id: string;
  user_id: string;
  photo_url: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  viewed_by_me: boolean;
};

export type StoryGroup = {
  user_id: string;
  username: string | null;
  photo_url: string | null;
  is_pro: boolean;
  is_me: boolean;
  has_unseen: boolean;
  latest_at: string;
  stories: Story[];
};

/** The story tray — active stories grouped by author (you + people you follow). */
export function useStoryTray() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ['stories'],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: () => apiClient(user!.id).get<StoryGroup[]>('/stories'),
  });
  return { groups: q.data ?? [], isLoading: q.isLoading, refetch: q.refetch };
}

/** Post a new story (expires after 24h). */
export function useCreateStory() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { photo_url: string; caption: string | null }) =>
      apiClient(user!.id).post('/stories', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories'] }),
  });
}

/** Mark a story as seen (fire-and-forget; updates the tray cache locally). */
export function useMarkStoryViewed() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (storyId: string) =>
      apiClient(user!.id).post(`/stories/${storyId}/view`, {}),
    onMutate: (storyId) => {
      qc.setQueryData<StoryGroup[]>(['stories'], (old) =>
        (old ?? []).map((g) => ({
          ...g,
          stories: g.stories.map((s) => (s.id === storyId ? { ...s, viewed_by_me: true } : s)),
          has_unseen: g.stories.some((s) => s.id !== storyId && !s.viewed_by_me),
        })));
    },
  });
}

/** Delete your own story. */
export function useDeleteStory() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (storyId: string) => apiClient(user!.id).delete(`/stories/${storyId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories'] }),
  });
}
