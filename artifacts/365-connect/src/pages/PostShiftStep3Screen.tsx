import { useState, useRef } from 'react';
import { useLocation } from 'wouter';
import {
  motion, useMotionValue, useTransform,
  animate, AnimatePresence,
} from 'framer-motion';
import { X, Check, Star, Sparkles, ChevronLeft } from 'lucide-react';
import { MOCK_MATCHED_WORKERS, type MatchedWorker } from '@/data/postShiftTemplates';
import { getDraft, addSwipeResult } from '@/store/postShiftStore';

/* ─── Star row ───────────────────────────────────────────────────────────── */
function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-[2px]" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={11}
          aria-hidden
          className={i < Math.round(rating) ? 'text-primary fill-primary' : 'text-[#333] fill-[#333]'}
        />
      ))}
    </div>
  );
}

/* ─── Swipe card ─────────────────────────────────────────────────────────── */
const SWIPE_THRESHOLD = 90;

function SwipeCard({
  worker,
  stackIndex,
  onSwipe,
}: {
  worker: MatchedWorker;
  stackIndex: number;
  onSwipe: (dir: 'left' | 'right') => void;
}) {
  const x    = useMotionValue(0);
  const rotate     = useTransform(x, [-260, 0, 260], [-18, 0, 18]);
  const inviteOpacity = useTransform(x, [20,  SWIPE_THRESHOLD], [0, 1]);
  const passOpacity   = useTransform(x, [-SWIPE_THRESHOLD, -20], [1, 0]);

  const scale  = 1 - stackIndex * 0.045;
  const yShift = stackIndex * 14;

  function handleDragEnd(_: unknown, info: { offset: { x: number }; velocity: { x: number } }) {
    const gone = Math.abs(info.offset.x) > SWIPE_THRESHOLD || Math.abs(info.velocity.x) > 500;
    if (gone) {
      const dir = info.offset.x > 0 ? 'right' : 'left';
      animate(x, dir === 'right' ? 600 : -600, { duration: 0.28, ease: 'easeOut' });
      setTimeout(() => onSwipe(dir), 200);
    } else {
      animate(x, 0, { type: 'spring', stiffness: 420, damping: 38 });
    }
  }

  /* Background stacked cards — not draggable */
  if (stackIndex > 0) {
    return (
      <div
        aria-hidden
        className="absolute inset-0 rounded-[22px] overflow-hidden bg-[#0E0E0E] border border-[#1E1E1E]"
        style={{
          transform: `scale(${scale}) translateY(${-yShift}px)`,
          zIndex: 10 - stackIndex * 3,
        }}
      >
        <img
          src={worker.photoUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover opacity-60"
        />
      </div>
    );
  }

  /* Top draggable card */
  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.85}
      style={{ x, rotate, zIndex: 20, touchAction: 'none' }}
      onDragEnd={handleDragEnd}
      className="absolute inset-0 rounded-[22px] overflow-hidden cursor-grab active:cursor-grabbing border border-[#1E1E1E]"
    >
      {/* Photo */}
      <img
        src={worker.photoUrl}
        alt={`${worker.name}'s profile photo`}
        loading="eager"
        decoding="async"
        className="w-full h-full object-cover"
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

      {/* INVITE indicator — right swipe */}
      <motion.div
        style={{ opacity: inviteOpacity }}
        className="absolute top-8 right-6 border-[3px] border-primary rounded-[10px] px-3.5 py-1.5 rotate-[-15deg]"
        aria-hidden
      >
        <span className="text-primary font-black text-[20px] tracking-wider">INVITE</span>
      </motion.div>

      {/* PASS indicator — left swipe */}
      <motion.div
        style={{ opacity: passOpacity }}
        className="absolute top-8 left-6 border-[3px] border-[#555] rounded-[10px] px-3.5 py-1.5 rotate-[15deg]"
        aria-hidden
      >
        <span className="text-[#666] font-black text-[20px] tracking-wider">PASS</span>
      </motion.div>

      {/* Worker info — bottom overlay */}
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 pt-12">
        {/* AI match badge */}
        <div className="flex items-center gap-1.5 mb-2">
          <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm border border-primary/40 rounded-full px-3 py-1">
            <Sparkles size={11} aria-hidden className="text-primary" />
            <span className="text-primary font-bold text-[12px]">{worker.matchPct}% Match</span>
          </div>
          <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm border border-[#333] rounded-full px-3 py-1">
            <span className="text-[#888] text-[11px] font-medium">{worker.shiftsCompleted} shifts</span>
          </div>
        </div>

        {/* Name + handle */}
        <p className="text-white font-bold text-[22px] leading-tight">{worker.name}</p>
        <p className="text-[#888] text-[14px] font-medium mb-2">@{worker.username}</p>

        {/* Star rating */}
        <div className="flex items-center gap-2 mb-3">
          <StarRow rating={worker.rating} />
          <span className="text-[#888] text-[12px] font-medium">{worker.rating.toFixed(1)}</span>
        </div>

        {/* Skill chips */}
        <div className="flex flex-wrap gap-1.5">
          {worker.skills.map((s) => (
            <span
              key={s}
              className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-full px-3 py-1 text-[11px] text-white font-medium"
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Results screen ─────────────────────────────────────────────────────── */
function ResultsScreen({
  invited,
  total,
  onDone,
}: {
  invited: number;
  total: number;
  onDone: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex-1 flex flex-col items-center justify-center px-8 text-center"
    >
      <div className="w-20 h-20 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mb-6">
        <Check size={36} aria-hidden className="text-primary" />
      </div>
      <h2 className="text-white font-bold text-[26px] mb-2">Shift Posted!</h2>
      <p className="text-[#666] text-[15px] leading-relaxed mb-1">
        You invited <span className="text-primary font-bold">{invited}</span> workers
        and passed on <span className="text-white font-semibold">{total - invited}</span>.
      </p>
      <p className="text-[#555] text-[13px] mb-10">Workers will be notified and can accept within 24 hours.</p>
      <motion.button
        type="button"
        aria-label="Return to home feed"
        whileTap={{ scale: 0.97 }}
        onClick={onDone}
        className="w-full h-[54px] rounded-[14px] bg-primary text-black font-bold text-[16px]"
      >
        Back to Home
      </motion.button>
    </motion.div>
  );
}

/* ─── PostShiftStep3Screen ───────────────────────────────────────────────── */
export function PostShiftStep3Screen() {
  const [, navigate] = useLocation();
  const draft = getDraft();

  const [currentIdx, setCurrentIdx] = useState(0);
  const [inviteCount, setInviteCount] = useState(0);
  const [done, setDone] = useState(false);
  const topCardRef = useRef<{ triggerSwipe: (dir: 'left' | 'right') => void } | null>(null);

  const workers = MOCK_MATCHED_WORKERS;
  const remaining = workers.length - currentIdx;
  const visibleWorkers = workers.slice(currentIdx, currentIdx + 3);

  function handleSwipe(dir: 'left' | 'right') {
    const worker = workers[currentIdx];
    addSwipeResult({ workerId: worker.id, action: dir === 'right' ? 'invite' : 'pass' });
    if (dir === 'right') setInviteCount((n) => n + 1);

    if (currentIdx + 1 >= workers.length) {
      setTimeout(() => setDone(true), 350);
    } else {
      setCurrentIdx((i) => i + 1);
    }
  }

  function handleSkip() {
    setDone(true);
  }

  function handleButtonSwipe(dir: 'left' | 'right') {
    handleSwipe(dir);
  }

  if (done) {
    return (
      <div className="min-h-[100dvh] bg-black flex flex-col px-5 pt-12 pb-10">
        <ResultsScreen
          invited={inviteCount}
          total={currentIdx}
          onDone={() => navigate('/home')}
        />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-black flex flex-col">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-[#111]">
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            aria-label="Back to shift form"
            onClick={() => navigate('/post-shift/step2')}
            className="w-9 h-9 rounded-full bg-[#111] border border-[#222] flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft size={18} aria-hidden className="text-[#888]" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={`h-[3px] rounded-full flex-1 ${i < 3 ? 'bg-primary' : 'bg-[#2A2A2A]'}`} />
              ))}
            </div>
          </div>
          <span className="text-[#555] text-[12px] font-medium flex-shrink-0">3 of 3</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-[20px] tracking-tight">Your Matches</h1>
            <p className="text-[#555] text-[13px] mt-0.5">
              <span className="text-primary font-semibold">{workers.length} workers</span> match your <span className="text-white font-medium">{draft.jobType}</span> shift
            </p>
          </div>
          {/* Counter */}
          <div className="flex flex-col items-end">
            <span className="text-white font-bold text-[18px]">{currentIdx + 1}</span>
            <span className="text-[#444] text-[11px]">of {workers.length}</span>
          </div>
        </div>
      </div>

      {/* Card stack area */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-4">
        {/* Relative container for stacked cards */}
        <div
          className="relative w-full"
          style={{ height: 420 }}
          aria-label={`Worker profile ${currentIdx + 1} of ${workers.length}: ${workers[currentIdx]?.name}`}
          role="region"
        >
          <AnimatePresence>
            {visibleWorkers.map((worker, idx) => (
              <SwipeCard
                key={worker.id}
                worker={worker}
                stackIndex={idx}
                onSwipe={idx === 0 ? handleSwipe : () => {}}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Swipe hint */}
        <p className="text-[#3A3A3A] text-[12px] mt-3 text-center" aria-hidden>
          ← swipe to pass · swipe to invite →
        </p>
      </div>

      {/* Action buttons + skip */}
      <div className="px-10 pb-10 flex flex-col items-center gap-5">
        {/* Pass / Invite button row */}
        <div className="flex items-center justify-center gap-10" role="group" aria-label="Swipe actions">
          {/* Pass */}
          <motion.button
            type="button"
            aria-label={`Pass on ${workers[currentIdx]?.name}`}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleButtonSwipe('left')}
            className="w-[64px] h-[64px] rounded-full bg-[#111] border-2 border-[#2A2A2A] flex items-center justify-center shadow-lg active:border-[#444]"
          >
            <X size={26} aria-hidden className="text-[#555]" />
          </motion.button>

          {/* Invite */}
          <motion.button
            type="button"
            aria-label={`Invite ${workers[currentIdx]?.name}`}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleButtonSwipe('right')}
            className="w-[72px] h-[72px] rounded-full bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(255,215,0,0.4)]"
          >
            <Check size={30} aria-hidden className="text-black" />
          </motion.button>

          {/* Spacer to balance the asymmetric sizes */}
          <div className="w-[64px] h-[64px] opacity-0 pointer-events-none" aria-hidden />
        </div>

        {/* Skip */}
        <button
          type="button"
          aria-label="Skip AI matching — let workers apply on their own"
          onClick={handleSkip}
          className="text-[#444] text-[13px] font-medium underline underline-offset-2 active:text-[#666]"
        >
          Skip — Let workers apply on their own
        </button>
      </div>
    </div>
  );
}
