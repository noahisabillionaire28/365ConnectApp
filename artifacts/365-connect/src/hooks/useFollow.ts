import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

type FollowState = {
  followerCount: number;
  isFollowing:   boolean;
};

function followQueryKey(targetId: string) {
  return ['follow', targetId] as const;
}

/**
 * Provides follow/unfollow for a target user.
 * Pass the target's UUID (not username).
 * Uses optimistic updates: button flips immediately, rolls back on error.
 */
export function useFollow(targetUserId: string) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: followQueryKey(targetUserId),
    queryFn: async (): Promise<FollowState> => {
      const { data: sessionData } = await supabase.auth.getUser();
      const currentUserId = sessionData?.user?.id ?? null;

      const [countResult, isFollowingResult] = await Promise.all([
        // Follower count for this profile
        supabase
          .from('follows')
          .select('id', { count: 'exact', head: true })
          .eq('following_id', targetUserId),
        // Does the current user already follow this profile?
        currentUserId
          ? supabase
              .from('follows')
              .select('id')
              .eq('follower_id', currentUserId)
              .eq('following_id', targetUserId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      return {
        followerCount: countResult.count ?? 0,
        isFollowing:   !!isFollowingResult.data,
      };
    },
    enabled: !!targetUserId,
    staleTime: 30_000,
  });

  // ── Follow ────────────────────────────────────────────────────────────────
  const followMutation = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getUser();
      const currentUserId = sessionData?.user?.id;
      if (!currentUserId) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: currentUserId, following_id: targetUserId });
      if (error) throw error;
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: followQueryKey(targetUserId) });
      const prev = qc.getQueryData<FollowState>(followQueryKey(targetUserId));
      qc.setQueryData<FollowState>(followQueryKey(targetUserId), (old) => ({
        followerCount: (old?.followerCount ?? 0) + 1,
        isFollowing:   true,
      }));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      qc.setQueryData(followQueryKey(targetUserId), ctx?.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: followQueryKey(targetUserId) });
    },
  });

  // ── Unfollow ──────────────────────────────────────────────────────────────
  const unfollowMutation = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getUser();
      const currentUserId = sessionData?.user?.id;
      if (!currentUserId) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', targetUserId);
      if (error) throw error;
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: followQueryKey(targetUserId) });
      const prev = qc.getQueryData<FollowState>(followQueryKey(targetUserId));
      qc.setQueryData<FollowState>(followQueryKey(targetUserId), (old) => ({
        followerCount: Math.max(0, (old?.followerCount ?? 0) - 1),
        isFollowing:   false,
      }));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      qc.setQueryData(followQueryKey(targetUserId), ctx?.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: followQueryKey(targetUserId) });
    },
  });

  return {
    followerCount:   data?.followerCount  ?? 0,
    isFollowing:     data?.isFollowing    ?? false,
    isLoading,
    follow:          () => followMutation.mutate(),
    unfollow:        () => unfollowMutation.mutate(),
    isFollowPending: followMutation.isPending || unfollowMutation.isPending,
  };
}
