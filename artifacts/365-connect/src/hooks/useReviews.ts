import { useCallback } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
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

export const REVIEWS_KEY = 'reviews';

export function useReviews(targetUserId?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = targetUserId ?? user?.id;

  const q = useQuery<ReviewRow[], Error>({
    queryKey: [REVIEWS_KEY, userId],
    enabled: !!userId,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    queryFn: () => apiClient(user?.id ?? null).get<ReviewRow[]>(`/reviews/${userId}`),
  });

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
      void qc.invalidateQueries({ queryKey: [REVIEWS_KEY, review.reviewee_id] });
      return true;
    } catch (e) {
      console.error('[useReviews] submitReview failed:', e);
      return false;
    }
  }, [user?.id, qc]);

  return { reviews: q.data ?? [], isLoading: q.isLoading, submitReview: submitReviewFn, refetch: q.refetch };
}

/**
 * Hook to check whether a reviewer has already reviewed a reviewee for a shift.
 * Returns `{ existing: ReviewRow | null, isLoading }`. Shares the reviews cache.
 */
export function useExistingReview(
  shiftId: string | undefined,
  reviewerId: string | undefined,
  revieweeId: string | undefined,
) {
  const q = useQuery<ReviewRow[], Error, ReviewRow | null>({
    queryKey: [REVIEWS_KEY, revieweeId],
    enabled: !!shiftId && !!reviewerId && !!revieweeId,
    staleTime: 60_000,
    queryFn: () => apiClient(reviewerId!).get<ReviewRow[]>(`/reviews/${revieweeId}`),
    select: (rows) => rows.find((r) => r.shift_id === shiftId && r.reviewer_id === reviewerId) ?? null,
  });
  const existing = q.data ?? null;
  return { existing, existingReview: existing, isLoading: q.isLoading };
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
