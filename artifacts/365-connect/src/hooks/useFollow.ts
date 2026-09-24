import { useCallback, useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

type FollowOptions = {
  onFollowSuccess?:   () => void;
  onUnfollowSuccess?: () => void;
  /** The server refused (e.g. "You can only follow workers.") — show it, don't swallow it. */
  onError?:           (message: string) => void;
  /**
   * When the list that rendered this card already knows the follow state
   * (the workers directory returns is_followed), pass it here and the hook
   * skips its own two requests — 50 cards no longer mean 100 calls.
   */
  initialFollowing?:  boolean;
};

type FollowState = { following: boolean; count: number };

export const FOLLOW_KEY = 'follow';

export function useFollow(
  targetUserId: string | undefined,
  options: FollowOptions = {},
) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [isFollowPending, setFollowPending] = useState(false);
  const key = [FOLLOW_KEY, targetUserId, user?.id];

  const known = options.initialFollowing;
  const q = useQuery<FollowState, Error>({
    queryKey: key,
    enabled: !!targetUserId && !!user?.id && known === undefined,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const [status, followers] = await Promise.all([
        apiClient(user!.id).get<{ following: boolean }>(`/follows/status/${targetUserId}`),
        apiClient(null).get<unknown[]>(`/follows/followers/${targetUserId}`),
      ]);
      return { following: status.following, count: followers.length };
    },
  });
  const state = q.data ?? { following: known ?? false, count: 0 };

  const setLocal = useCallback((following: boolean, delta: number) => {
    qc.setQueryData<FollowState>(key, (prev) => ({ following, count: Math.max(0, (prev?.count ?? 0) + delta) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId, user?.id]);

  const follow = useCallback(async () => {
    if (!targetUserId || !user?.id || isFollowPending) return;
    setFollowPending(true);
    setLocal(true, 1);
    try {
      await apiClient(user.id).post('/follows', { following_id: targetUserId });
      void qc.invalidateQueries({ queryKey: ['roster'] });
      void qc.invalidateQueries({ queryKey: ['people-feed'] });
      options.onFollowSuccess?.();
    } catch (e) {
      setLocal(false, -1);
      console.error('[useFollow] follow failed:', e);
      options.onError?.(e instanceof Error ? e.message : 'Could not follow this user.');
    } finally {
      setFollowPending(false);
    }
  }, [targetUserId, user?.id, isFollowPending, options, setLocal, qc]);

  const unfollow = useCallback(async () => {
    if (!targetUserId || !user?.id || isFollowPending) return;
    setFollowPending(true);
    setLocal(false, -1);
    try {
      await apiClient(user.id).delete(`/follows/${targetUserId}`);
      void qc.invalidateQueries({ queryKey: ['roster'] });
      void qc.invalidateQueries({ queryKey: ['people-feed'] });
      options.onUnfollowSuccess?.();
    } catch (e) {
      setLocal(true, 1);
      console.error('[useFollow] unfollow failed:', e);
      options.onError?.(e instanceof Error ? e.message : 'Could not unfollow this user.');
    } finally {
      setFollowPending(false);
    }
  }, [targetUserId, user?.id, isFollowPending, options, setLocal, qc]);

  return { isFollowing: state.following, followerCount: state.count, isLoading: q.isLoading, isFollowPending, follow, unfollow };
}
