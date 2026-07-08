import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type ExistingReview = { rating: number; positiveTags: string[]; negativeTags: string[] } | null;

/** Has the current user already reviewed `toUserId` for this shift? Prevents duplicate submissions. */
export function useExistingReview(shiftId: string | undefined, reviewerId: string | undefined, toUserId: string | undefined) {
  const [existing, setExisting] = useState<ExistingReview>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!shiftId || !reviewerId || !toUserId) { setIsLoading(false); return; }
    setIsLoading(true);
    void supabase
      .from('reviews_visible')
      .select('rating, positive_tags, negative_tags')
      .eq('shift_id', shiftId)
      .eq('reviewer_id', reviewerId)
      .eq('reviewee_id', toUserId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error('[useExistingReview] fetch failed:', error.message);
        setExisting(
          data ? { rating: data.rating, positiveTags: data.positive_tags ?? [], negativeTags: data.negative_tags ?? [] } : null,
        );
        setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [shiftId, reviewerId, toUserId]);

  return { existing, isLoading };
}

export async function submitReview(params: {
  shiftId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  positiveTags: string[];
  negativeTags: string[];
}): Promise<{ error: string | null; duplicate: boolean }> {
  const { error } = await supabase.from('reviews').insert({
    shift_id:      params.shiftId,
    reviewer_id:   params.reviewerId,
    reviewee_id:   params.revieweeId,
    rating:        params.rating,
    positive_tags: params.positiveTags,
    negative_tags: params.negativeTags,
  });
  if (error) {
    if (error.code === '23505') return { error: null, duplicate: true };
    console.error('[submitReview] insert failed:', error.message);
    return { error: error.message, duplicate: false };
  }
  return { error: null, duplicate: false };
}
