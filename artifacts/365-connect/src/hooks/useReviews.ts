import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export type ReviewRow = {
  id: string;
  shift_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment: string | null;
  positive_tags: string[];
  negative_tags: string[];
  created_at: string;
  reviewer_username?: string | null;
  reviewer_photo?: string | null;
};

export function useReviews(targetUserId?: string) {
  const { user } = useAuth();
  const [reviews, setReviews]   = useState<ReviewRow[]>([]);
  const [isLoading, setLoading] = useState(true);

  const userId = targetUserId ?? user?.id;

  const load = useCallback(async () => {
    if (!userId) { setReviews([]); setLoading(false); return; }
    setLoading(true);
    try {
      const rows = await apiClient(user?.id ?? null).get<ReviewRow[]>(`/reviews/${userId}`);
      setReviews(rows);
    } catch (e) {
      console.error('[useReviews] load failed:', e);
    } finally {
      setLoading(false);
    }
  }, [userId, user?.id]);

  useEffect(() => { void load(); }, [load]);

  const submitReviewFn = useCallback(async (review: {
    shift_id: string;
    reviewee_id: string;
    rating: number;
    comment?: string;
    positive_tags?: string[];
    negative_tags?: string[];
  }): Promise<boolean> => {
    if (!user?.id) return false;
    try {
      await apiClient(user.id).post('/reviews', review);
      await load();
      return true;
    } catch (e) {
      console.error('[useReviews] submitReview failed:', e);
      return false;
    }
  }, [user?.id, load]);

  return { reviews, isLoading, submitReview: submitReviewFn, refetch: load };
}

/**
 * Hook to check whether a reviewer has already reviewed a reviewee for a shift.
 * Returns `{ existing: ReviewRow | null, isLoading }`.
 */
export function useExistingReview(
  shiftId: string | undefined,
  reviewerId: string | undefined,
  revieweeId: string | undefined,
) {
  const [existingReview, setExisting] = useState<ReviewRow | null>(null);
  const [isLoading, setLoading]       = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!shiftId || !reviewerId || !revieweeId) { setLoading(false); return; }
    setLoading(true);
    apiClient(reviewerId).get<ReviewRow[]>(`/reviews/${revieweeId}`)
      .then((rows) => {
        if (cancelled) return;
        const found = rows.find(
          (r) => r.shift_id === shiftId && r.reviewer_id === reviewerId,
        ) ?? null;
        setExisting(found);
      })
      .catch(() => { if (!cancelled) setExisting(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [shiftId, reviewerId, revieweeId]);

  return { existing: existingReview, existingReview, isLoading };
}

/**
 * Standalone async helper for submitting a review from a page component.
 * Accepts camelCase or snake_case field names.
 * Returns `{ error: string | null; duplicate: boolean }`.
 */
export async function submitReview(review: {
  shiftId?: string;
  shift_id?: string;
  reviewerId?: string;
  reviewer_id?: string;
  revieweeId?: string;
  reviewee_id?: string;
  rating: number;
  comment?: string;
  positiveTags?: string[];
  positive_tags?: string[];
  negativeTags?: string[];
  negative_tags?: string[];
}): Promise<{ error: string | null; duplicate: boolean }> {
  const userId = review.reviewerId ?? review.reviewer_id;
  if (!userId) return { error: 'Not authenticated', duplicate: false };
  try {
    await apiClient(userId).post('/reviews', {
      shift_id:      review.shiftId      ?? review.shift_id,
      reviewee_id:   review.revieweeId   ?? review.reviewee_id,
      rating:        review.rating,
      comment:       review.comment,
      positive_tags: review.positiveTags ?? review.positive_tags ?? [],
      negative_tags: review.negativeTags ?? review.negative_tags ?? [],
    });
    return { error: null, duplicate: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const duplicate = msg.toLowerCase().includes('duplicate') || msg.includes('23505');
    return { error: duplicate ? null : msg, duplicate };
  }
}
