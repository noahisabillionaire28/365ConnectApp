import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Star, CheckCircle2 } from 'lucide-react';
import { useShiftById } from '@/hooks/useShifts';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { useExistingReview, submitReview } from '@/hooks/useReviews';
import { supabase } from '@/lib/supabase';

const POSITIVE_TAGS = [
  'Punctual', 'Professional', 'Great energy', 'Skilled',
  'Reliable', 'Team player', 'Well dressed', 'Great communicator',
];

const NEGATIVE_TAGS = [
  'Late', 'No call no show', 'Unprofessional', 'Poor attitude',
  'Dress code violation', 'Left early', 'Caused issues',
];

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'];

function useTargetName(userId: string | undefined) {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!userId) return;
    void supabase.from('users').select('username, company_name, role').eq('id', userId).maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setName(data?.company_name || (data?.username ? `@${data.username}` : null));
      });
    return () => { cancelled = true; };
  }, [userId]);
  return name;
}

export function ReviewScreen() {
  const { shiftId, toUserId } = useParams<{ shiftId: string; toUserId: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const profile = useProfile();
  const { data: shift, isLoading: shiftLoading } = useShiftById(shiftId);
  const targetName = useTargetName(toUserId);
  const { existing, isLoading: existingLoading } = useExistingReview(shiftId, user?.id, toUserId);

  const [rating,       setRating]       = useState(0);
  const [hoverRating,  setHoverRating]  = useState(0);
  const [positiveTags, setPositiveTags] = useState<Set<string>>(new Set());
  const [negativeTags, setNegativeTags] = useState<Set<string>>(new Set());
  const [submitting,   setSubmitting]   = useState(false);
  const [submitted,    setSubmitted]    = useState(false);
  const [submitError,  setSubmitError]  = useState<string | null>(null);

  const canSeeNegativeTags = profile.role === 'client' || profile.role === 'staffer';
  const displayRating = hoverRating || rating;

  function toggleTag(set: React.Dispatch<React.SetStateAction<Set<string>>>, tag: string) {
    set((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  }

  function goBack() {
    if (window.history.length > 1) window.history.back();
    else navigate('/home');
  }

  async function handleSubmit() {
    if (rating === 0 || !user?.id || !shiftId || !toUserId) return;
    setSubmitting(true);
    setSubmitError(null);
    const { error, duplicate } = await submitReview({
      shiftId, reviewerId: user.id, revieweeId: toUserId, rating,
      positiveTags: Array.from(positiveTags),
      negativeTags: canSeeNegativeTags ? Array.from(negativeTags) : [],
    });
    setSubmitting(false);
    if (error) { setSubmitError('Could not submit your review — please try again.'); return; }
    setSubmitted(true);
    if (duplicate) { setTimeout(goBack, 900); return; }
    setTimeout(goBack, 1400);
  }

  const isLoading = shiftLoading || existingLoading || profile.isLoading;

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-white flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#DBDBDB] border-t-[#0A1628] animate-spin" role="status" aria-label="Loading review" />
      </div>
    );
  }

  if (!shift) {
    return (
      <div className="min-h-[100dvh] bg-white flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-[#737373] text-[15px]">Couldn't load this shift.</p>
        <button type="button" onClick={goBack} className="text-[#0095F6] font-semibold text-[14px]">← Go back</button>
      </div>
    );
  }

  if (existing || submitted) {
    return (
      <div className="min-h-[100dvh] bg-white flex flex-col items-center justify-center gap-5 px-8 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-[#10B981] flex items-center justify-center">
          <CheckCircle2 size={36} aria-hidden className="text-[#10B981]" />
        </motion.div>
        <div>
          <p className="text-black font-bold text-[20px]">
            {submitted ? 'Review submitted' : "You've already rated this shift"}
          </p>
          {existing && !submitted && (
            <div className="flex items-center justify-center gap-1 mt-3" aria-label={`You gave ${existing.rating} stars`}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} size={22} aria-hidden
                  className={existing.rating >= i ? 'text-[#FFD700] fill-[#FFD700]' : 'text-[#DBDBDB] fill-[#DBDBDB]'} />
              ))}
            </div>
          )}
        </div>
        {!submitted && (
          <button type="button" onClick={goBack} className="text-[#0095F6] font-semibold text-[14px]">← Back</button>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <div className="px-4 pt-[52px] pb-3 flex items-center gap-3">
        <button type="button" aria-label="Go back" onClick={goBack}
          className="w-9 h-9 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center flex-shrink-0">
          <ChevronLeft size={18} aria-hidden className="text-black" />
        </button>
      </div>

      <div className="flex-1 flex flex-col px-5 pt-4 pb-10 overflow-y-auto">
        <div className="text-center mb-8">
          <h1 className="text-black font-bold text-[24px] tracking-tight">Rate Your Experience</h1>
          <p className="text-[#737373] text-[14px] mt-1.5">
            {targetName ?? shift.companyName} · {shift.jobType}
          </p>
        </div>

        {/* Star row */}
        <div className="flex items-center justify-center gap-3 mb-2" role="group" aria-label="Star rating">
          {[1, 2, 3, 4, 5].map((i) => (
            <motion.button key={i} type="button"
              aria-label={`${i} star${i !== 1 ? 's' : ''}`} aria-pressed={rating === i}
              whileTap={{ scale: 0.82 }} onClick={() => setRating(i)}
              onMouseEnter={() => setHoverRating(i)} onMouseLeave={() => setHoverRating(0)}>
              <Star size={42} aria-hidden
                className={displayRating >= i
                  ? 'text-[#FFD700] fill-[#FFD700]'
                  : 'text-[#DBDBDB] fill-[#DBDBDB]'} />
            </motion.button>
          ))}
        </div>

        <div className="h-6 flex items-center justify-center mb-6">
          <AnimatePresence mode="wait">
            {displayRating > 0 && (
              <motion.p key={displayRating} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }} className="text-[#737373] text-[14px] font-medium">
                {RATING_LABELS[displayRating]}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Positive tags — visible to everyone */}
        <p className="text-[#737373] text-[11px] font-bold uppercase tracking-widest mb-3">What went well?</p>
        <div className="flex flex-wrap gap-2 mb-6" role="group" aria-label="Positive review tags">
          {POSITIVE_TAGS.map((tag) => {
            const on = positiveTags.has(tag);
            return (
              <motion.button key={tag} type="button" aria-pressed={on} whileTap={{ scale: 0.94 }}
                onClick={() => toggleTag(setPositiveTags, tag)}
                className={`rounded-full px-4 py-2 text-[13px] font-medium border transition-all duration-150 ${
                  on ? 'bg-[#10B981]/10 border-[#10B981] text-[#10B981]' : 'bg-white border-[#DBDBDB] text-[#737373]'
                }`}>
                {tag}
              </motion.button>
            );
          })}
        </div>

        {/* Negative tags — client/staffer only, hidden entirely from workers */}
        {canSeeNegativeTags && (
          <>
            <p className="text-[#737373] text-[11px] font-bold uppercase tracking-widest mb-3">Any issues?</p>
            <div className="flex flex-wrap gap-2 mb-6" role="group" aria-label="Issue tags">
              {NEGATIVE_TAGS.map((tag) => {
                const on = negativeTags.has(tag);
                return (
                  <motion.button key={tag} type="button" aria-pressed={on} whileTap={{ scale: 0.94 }}
                    onClick={() => toggleTag(setNegativeTags, tag)}
                    className={`rounded-full px-4 py-2 text-[13px] font-medium border transition-all duration-150 ${
                      on ? 'bg-[#EF4444]/10 border-[#EF4444] text-[#EF4444]' : 'bg-white border-[#DBDBDB] text-[#737373]'
                    }`}>
                    {tag}
                  </motion.button>
                );
              })}
            </div>
          </>
        )}

        {submitError && (
          <p className="text-[#EF4444] text-[13px] text-center mb-3" role="alert">{submitError}</p>
        )}

        {/* Submit */}
        <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={handleSubmit}
          disabled={rating === 0 || submitting}
          aria-label={rating === 0 ? 'Select a star rating to submit' : 'Submit review'}
          aria-disabled={rating === 0}
          className={`w-full h-[52px] rounded-[8px] font-bold text-[16px] transition-all duration-200 mt-auto ${
            rating > 0 ? 'bg-[#0A1628] text-white' : 'bg-[#EFEFEF] text-[#AAAAAA] cursor-not-allowed border border-[#DBDBDB]'
          }`}>
          {submitting ? 'Submitting…' : 'Submit Review'}
        </motion.button>
        {rating === 0 && (
          <p className="text-center text-[#AAAAAA] text-[12px] mt-2">Select a rating to continue</p>
        )}
      </div>
    </div>
  );
}
