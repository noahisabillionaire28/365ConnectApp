import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { ChevronLeft, X, Check, Star, Sparkles } from 'lucide-react';
import { useShiftApplicants, type ApplicantCard } from '@/hooks/useShiftApplicants';
import { useShiftById } from '@/hooks/useShifts';
import { useToast } from '@/contexts/ToastContext';

const SWIPE_THRESHOLD = 120;

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${rating.toFixed(1)} star rating`}>
      <Star size={13} aria-hidden className="text-[#FFD700] fill-[#FFD700]" />
      <span className="text-black text-[13px] font-semibold">{rating > 0 ? rating.toFixed(1) : 'New'}</span>
    </div>
  );
}

function ApplicantCardView({ applicant, onDecide, isTop }: {
  applicant: ApplicantCard; onDecide: (decision: 'accepted' | 'declined') => void; isTop: boolean;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-14, 14]);
  const approveOpacity = useTransform(x, [20, SWIPE_THRESHOLD], [0, 1]);
  const declineOpacity = useTransform(x, [-SWIPE_THRESHOLD, -20], [1, 0]);
  const [exitX, setExitX] = useState(0);

  const initials = (applicant.username ?? 'W').replace('@', '').slice(0, 2).toUpperCase();

  return (
    <motion.div
      className="absolute inset-0"
      style={isTop ? { x, rotate } : undefined}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={(_, info) => {
        if (info.offset.x > SWIPE_THRESHOLD) { setExitX(500); onDecide('accepted'); }
        else if (info.offset.x < -SWIPE_THRESHOLD) { setExitX(-500); onDecide('declined'); }
      }}
      animate={exitX !== 0 ? { x: exitX, opacity: 0, rotate: exitX > 0 ? 20 : -20 } : { x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      role="group"
      aria-label={`Applicant ${applicant.username ?? 'worker'}`}
    >
      <div className="w-full h-full bg-white border border-[#DBDBDB] rounded-[20px] shadow-lg overflow-hidden flex flex-col relative">
        {isTop && (
          <>
            <motion.div style={{ opacity: approveOpacity }}
              className="absolute top-6 left-6 z-10 border-[3px] border-[#10B981] rounded-[10px] px-3 py-1 -rotate-12">
              <span className="text-[#10B981] font-black text-[18px] uppercase tracking-wide">Approve</span>
            </motion.div>
            <motion.div style={{ opacity: declineOpacity }}
              className="absolute top-6 right-6 z-10 border-[3px] border-[#737373] rounded-[10px] px-3 py-1 rotate-12">
              <span className="text-[#737373] font-black text-[18px] uppercase tracking-wide">Pass</span>
            </motion.div>
          </>
        )}

        <div className="h-[46%] bg-[#FAFAFA] flex items-center justify-center flex-shrink-0 relative">
          {applicant.photoUrl ? (
            <img src={applicant.photoUrl} alt={applicant.username ?? 'Applicant'} draggable={false}
              className="w-full h-full object-cover" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-white border border-[#DBDBDB] flex items-center justify-center">
              <span className="text-black font-bold text-[28px]">{initials}</span>
            </div>
          )}
          {applicant.matchScore !== null && (
            <div className="absolute top-4 right-4 bg-[#0095F6]/10 border border-[#0095F6]/30 rounded-full px-3 py-1 flex items-center gap-1.5">
              <Sparkles size={12} aria-hidden className="text-[#0095F6]" />
              <span className="text-[#0095F6] font-bold text-[12px]">{applicant.matchScore}% Match</span>
            </div>
          )}
        </div>

        <div className="flex-1 px-5 py-4 flex flex-col gap-3 overflow-y-auto">
          <div className="flex items-center justify-between">
            <p className="text-black font-bold text-[19px]">{applicant.username ? `@${applicant.username}` : 'Applicant'}</p>
            <StarRow rating={applicant.rating} />
          </div>
          {applicant.jobTypes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {applicant.jobTypes.slice(0, 3).map((jt) => (
                <span key={jt} className="bg-[#FAFAFA] border border-[#DBDBDB] rounded-full px-3 py-1 text-[11px] font-semibold text-black">
                  {jt}
                </span>
              ))}
            </div>
          )}
          {applicant.bio && <p className="text-[#737373] text-[13px] leading-relaxed">{applicant.bio}</p>}
        </div>
      </div>
    </motion.div>
  );
}

export function ApplicantsScreen() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { data: shift, isLoading: shiftLoading } = useShiftById(id);
  const { applicants, isLoading, approve, decline } = useShiftApplicants(id);
  const { showToast } = useToast();

  const isLoadingAny = shiftLoading || isLoading;

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <div className="px-4 pt-[52px] pb-4 border-b border-[#DBDBDB] flex items-center gap-3">
        <button type="button" aria-label="Go back"
          onClick={() => { if (window.history.length > 1) window.history.back(); else navigate('/jobs'); }}
          className="w-9 h-9 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center flex-shrink-0">
          <ChevronLeft size={18} aria-hidden className="text-black" />
        </button>
        <div className="min-w-0">
          <h1 className="text-black font-bold text-[18px] leading-tight truncate">Applicants</h1>
          <p className="text-[#737373] text-[12px] truncate">{shift?.jobType ?? 'Loading…'}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-5 pt-6 pb-4">
        {isLoadingAny ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-[#DBDBDB] border-t-[#0A1628] animate-spin" role="status" aria-label="Loading applicants" />
          </div>
        ) : applicants.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
            <div className="w-16 h-16 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center">
              <Check size={26} aria-hidden className="text-[#737373]" />
            </div>
            <p className="text-black font-semibold text-[16px]">No applicants waiting</p>
            <p className="text-[#737373] text-[13px]">You've reviewed everyone who applied. Check back later for more.</p>
          </div>
        ) : (
          <>
            <div className="relative flex-1" style={{ minHeight: 420 }}>
              <AnimatePresence>
                {applicants.slice(0, 3).reverse().map((a, i, arr) => (
                  <ApplicantCardView key={a.applicationId} applicant={a}
                    isTop={i === arr.length - 1}
                    onDecide={(decision) => {
                      void (decision === 'accepted' ? approve(a.applicationId) : decline(a.applicationId))
                        .then((ok) => { if (ok) showToast(decision === 'accepted' ? 'Worker confirmed for your shift!' : 'Applicant declined.'); });
                    }} />
                ))}
              </AnimatePresence>
            </div>

            <div className="flex items-center justify-center gap-6 pt-5" role="group" aria-label="Approve or decline applicant">
              <motion.button type="button" whileTap={{ scale: 0.9 }}
                aria-label="Decline applicant"
                onClick={() => {
                  const top = applicants[0];
                  if (top) void decline(top.applicationId).then((ok) => { if (ok) showToast('Applicant declined.'); });
                }}
                className="w-16 h-16 rounded-full bg-white border-2 border-[#DBDBDB] flex items-center justify-center">
                <X size={26} aria-hidden className="text-[#737373]" />
              </motion.button>
              <motion.button type="button" whileTap={{ scale: 0.9 }}
                aria-label="Approve applicant"
                onClick={() => {
                  const top = applicants[0];
                  if (top) void approve(top.applicationId).then((ok) => { if (ok) showToast('Worker confirmed for your shift!'); });
                }}
                className="w-16 h-16 rounded-full bg-[#10B981] flex items-center justify-center">
                <Check size={28} aria-hidden className="text-white" />
              </motion.button>
            </div>
            <p className="text-center text-[#AAAAAA] text-[11px] mt-3">
              Swipe right to approve · swipe left to pass
            </p>
          </>
        )}
      </div>
    </div>
  );
}
