import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

type FollowOptions = {
  onFollowSuccess?:   () => void;
  onUnfollowSuccess?: () => void;
};

export function useFollow(
  targetUserId: string | undefined,
  options: FollowOptions = {},
) {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing]       = useState(false);
  const [followerCount, setFollowerCount]   = useState(0);
  const [isLoading, setLoading]             = useState(true);
  const [isFollowPending, setFollowPending] = useState(false);

  useEffect(() => {
    if (!targetUserId || !user?.id) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      apiClient(user.id).get<{ following: boolean }>(`/follows/status/${targetUserId}`),
      apiClient(null).get<unknown[]>(`/follows/followers/${targetUserId}`),
    ]).then(([status, followers]) => {
      setIsFollowing(status.following);
      setFollowerCount(followers.length);
    }).catch((e) => console.error('[useFollow] load failed:', e))
      .finally(() => setLoading(false));
  }, [targetUserId, user?.id]);

  const follow = useCallback(async () => {
    if (!targetUserId || !user?.id || isFollowPending) return;
    setFollowPending(true);
    setIsFollowing(true);
    setFollowerCount((c) => c + 1);
    try {
      await apiClient(user.id).post('/follows', { following_id: targetUserId });
      options.onFollowSuccess?.();
    } catch (e) {
      setIsFollowing(false);
      setFollowerCount((c) => c - 1);
      console.error('[useFollow] follow failed:', e);
    } finally {
      setFollowPending(false);
    }
  }, [targetUserId, user?.id, isFollowPending, options]);

  const unfollow = useCallback(async () => {
    if (!targetUserId || !user?.id || isFollowPending) return;
    setFollowPending(true);
    setIsFollowing(false);
    setFollowerCount((c) => Math.max(0, c - 1));
    try {
      await apiClient(user.id).delete(`/follows/${targetUserId}`);
      options.onUnfollowSuccess?.();
    } catch (e) {
      setIsFollowing(true);
      setFollowerCount((c) => c + 1);
      console.error('[useFollow] unfollow failed:', e);
    } finally {
      setFollowPending(false);
    }
  }, [targetUserId, user?.id, isFollowPending, options]);

  return { isFollowing, followerCount, isLoading, isFollowPending, follow, unfollow };
}
