import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, CheckCircle2, XCircle, Coffee,
  Square, Star, ChevronLeft, AlarmClock,
} from 'lucide-react';
import { MOCK_SHIFTS, type MockShift } from '@/data/mockFeed';
import { markClockedIn } from '@/store/feedStore';

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────────────────── */
function fmtHMS(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

function fmtHM(secs: number): string {
  if (secs === 0) return '0m';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

/* ──────────────────────────────────────────────────────────────────────────
   Phase types
────────────────────────────────────────────────────────────────────────── */
type Phase =
  | 'geo-check'
  | 'geo-success'
  | 'geo-fail'
  | 'active'
  | 'on-break'
  | 'summary'
  | 'review';

/* ──────────────────────────────────────────────────────────────────────────
   Geo-check screen
────────────────────────────────────────────────────────────────────────── */
function GeoCheckScreen({ onSimulateFail }: { onSimulateFail: () => void }) {
  return (
    <motion.div
      key="geo-check"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2 }}
      className="flex-1 flex flex-col items-center justify-center gap-7 px-8 min-h-[100dvh]"
    >
      {/* Pulsing pin */}
      <div className="relative flex items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.6, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeOut' }}
          className="absolute w-24 h-24 rounded-full bg-primary/20"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.15, 0.5] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeOut', delay: 0.3 }}
          className="absolute w-16 h-16 rounded-full bg-primary/25"
        />
        <div className="w-14 h-14 rounded-full bg-[#111] border border-[#2A2A2A] flex items-center justify-center relative z-10">
          <MapPin size={24} aria-hidden className="text-primary" />
        </div>
      </div>

      {/* Spinner */}
      <div
        className="w-7 h-7 rounded-full border-[2.5px] border-[#222] border-t-primary animate-spin"
        role="status"
        aria-label="Checking location"
      />

      <div className="text-center">
        <p className="text-white font-semibold text-[18px]">Verifying your location…</p>
        <p className="text-[#444] text-[13px] mt-1.5">GPS signal detected · checking distance</p>
      </div>

      {/* Demo: simulate fail */}
      <button
        type="button"
        aria-label="Demo: simulate out-of-range geofence failure"
        onClick={onSimulateFail}
        className="text-[#2A2A2A] text-[11px] underline underline-offset-2 mt-12 active:text-[#444]"
      >
        Demo: simulate out-of-range →
      </button>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Geo-success screen
────────────────────────────────────────────────────────────────────────── */
function GeoSuccessScreen() {
  return (
    <motion.div
      key="geo-success"
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 22 }}
      className="flex-1 flex flex-col items-center justify-center gap-5 px-8 min-h-[100dvh]"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 18, delay: 0.08 }}
        className="w-24 h-24 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center"
      >
        <CheckCircle2 size={44} aria-hidden className="text-emerald-400" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="text-center"
      >
        <p className="text-emerald-400 font-bold text-[26px]">You're on-site!</p>
        <p className="text-[#555] text-[15px] mt-1.5">Clock in confirmed</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="bg-emerald-500/8 border border-emerald-500/20 rounded-[12px] px-5 py-3 flex items-center gap-2.5"
      >
        <MapPin size={14} aria-hidden className="text-emerald-400 flex-shrink-0" />
        <p className="text-emerald-400 text-[13px] font-medium">Location verified · Miami Beach, FL</p>
      </motion.div>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Geo-fail screen
────────────────────────────────────────────────────────────────────────── */
function GeoFailScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <motion.div
      key="geo-fail"
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 22 }}
      className="flex-1 flex flex-col items-center justify-center gap-5 px-8 min-h-[100dvh] text-center"
    >
      <div className="w-24 h-24 rounded-full bg-red-500/12 border-2 border-red-500/30 flex items-center justify-center">
        <XCircle size={44} aria-hidden className="text-red-400" />
      </div>

      <div>
        <p className="text-red-400 font-bold text-[22px]">Out of range</p>
        <p className="text-[#555] text-[14px] mt-2 leading-relaxed">
          You appear to be more than 1 mile away from the shift location.
        </p>
      </div>

      <div className="w-full bg-[#0C0C0C] border border-[#1E1E1E] rounded-[16px] px-4 py-4 text-left flex flex-col gap-4">
        <div>
          <p className="text-[#3A3A3A] text-[11px] font-semibold uppercase tracking-widest mb-1">Required</p>
          <div className="flex items-center gap-2">
            <MapPin size={13} aria-hidden className="text-emerald-400 flex-shrink-0" />
            <p className="text-white text-[14px] font-medium">Miami Beach, FL</p>
          </div>
        </div>
        <div>
          <p className="text-[#3A3A3A] text-[11px] font-semibold uppercase tracking-widest mb-1">Your location</p>
          <div className="flex items-center gap-2">
            <MapPin size={13} aria-hidden className="text-red-400 flex-shrink-0" />
            <p className="text-red-400 text-[14px] font-medium">Coral Gables, FL · 1.8 mi away</p>
          </div>
        </div>
      </div>

      <div className="w-full flex flex-col gap-3 mt-2">
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={onRetry}
          aria-label="Try location check again"
          className="w-full h-[52px] rounded-[14px] bg-[#141414] border border-[#2A2A2A] text-white font-semibold text-[15px]"
        >
          Try Again
        </motion.button>
        <button
          type="button"
          aria-label="Contact your shift manager for location override"
          className="text-[#444] text-[13px] underline underline-offset-2 active:text-[#666]"
        >
          Contact shift manager
        </button>
      </div>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Active + On Break shared screen
────────────────────────────────────────────────────────────────────────── */
function ActiveScreen({
  shift,
  phase,
  shiftSecs,
  breakSecs,
  onTakeBreak,
  onEndBreak,
  onEndShift,
}: {
  shift: MockShift;
  phase: 'active' | 'on-break';
  shiftSecs: number;
  breakSecs: number;
  onTakeBreak: () => void;
  onEndBreak: () => void;
  onEndShift: () => void;
}) {
  const isBreak = phase === 'on-break';

  return (
    <motion.div
      key="active"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col min-h-[100dvh]"
    >
      {/* Shift info header */}
      <div className="pt-[72px] px-6 text-center">
        <p className="text-[#555] text-[12px] font-semibold uppercase tracking-widest mb-1">
          {shift.jobType}
        </p>
        <p className="text-white font-bold text-[20px] leading-tight">{shift.companyName}</p>
        <p className="text-[#333] text-[12px] mt-0.5">{shift.location}</p>
      </div>

      {/* Timer area */}
      <div className="flex-1 flex flex-col items-center justify-center relative px-6">

        {/* Subtle gold radial glow behind timer */}
        {!isBreak && (
          <div
            aria-hidden
            className="absolute w-64 h-64 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(255,215,0,0.04) 0%, transparent 70%)' }}
          />
        )}
        {isBreak && (
          <div
            aria-hidden
            className="absolute w-64 h-64 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.05) 0%, transparent 70%)' }}
          />
        )}

        {isBreak ? (
          <div className="flex flex-col items-center gap-8 relative z-10">
            {/* Frozen shift timer (muted) */}
            <div className="text-center opacity-35" aria-label={`Shift time: ${fmtHMS(shiftSecs)}`}>
              <p className="text-[#888] text-[10px] font-semibold uppercase tracking-[0.18em] mb-1.5">
                Shift Time
              </p>
              <p className="text-white font-bold tabular-nums leading-none" style={{ fontSize: 44 }}>
                {fmtHMS(shiftSecs)}
              </p>
            </div>

            {/* Live break timer */}
            <div className="text-center" aria-live="polite" aria-label={`Break time: ${fmtHMS(breakSecs)}`}>
              <p className="text-amber-400 text-[11px] font-semibold uppercase tracking-[0.18em] mb-2">
                Break Time
              </p>
              <p
                className="font-bold tabular-nums leading-none text-amber-400"
                style={{ fontSize: 72 }}
              >
                {fmtHMS(breakSecs)}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center relative z-10" aria-live="polite" aria-label={`Time on shift: ${fmtHMS(shiftSecs)}`}>
            <p
              className="font-bold tabular-nums leading-none text-white"
              style={{ fontSize: 76 }}
            >
              {fmtHMS(shiftSecs)}
            </p>
            {breakSecs > 0 && (
              <p className="text-[#333] text-[12px] mt-3 font-medium">
                {fmtHM(breakSecs)} break taken
              </p>
            )}
          </div>
        )}

        {/* Status badge */}
        <div
          className={`flex items-center gap-2.5 mt-8 px-5 py-2.5 rounded-full border relative z-10 ${
            isBreak
              ? 'bg-amber-400/10 border-amber-400/25'
              : 'bg-emerald-500/10 border-emerald-500/25'
          }`}
          aria-label={isBreak ? 'Status: On Break' : 'Status: On Shift'}
        >
          <motion.div
            animate={{ opacity: [1, 0.25, 1] }}
            transition={{ repeat: Infinity, duration: 1.6 }}
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              isBreak ? 'bg-amber-400' : 'bg-emerald-400'
            }`}
          />
          <span
            className={`text-[13px] font-bold uppercase tracking-[0.14em] ${
              isBreak ? 'text-amber-400' : 'text-emerald-400'
            }`}
          >
            {isBreak ? 'On Break' : 'On Shift'}
          </span>
        </div>
      </div>

      {/* Buttons */}
      <div className="px-5 pb-10 flex flex-col gap-3">
        {isBreak ? (
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={onEndBreak}
            aria-label="End break and resume shift"
            className="w-full h-[54px] rounded-[14px] bg-primary text-black font-bold text-[16px] flex items-center justify-center gap-2.5"
          >
            <AlarmClock size={18} aria-hidden />
            End Break
          </motion.button>
        ) : (
          <>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={onTakeBreak}
              aria-label="Take a break"
              className="w-full h-[54px] rounded-[14px] bg-[#111] border border-[#222] text-white font-semibold text-[15px] flex items-center justify-center gap-2.5"
            >
              <Coffee size={17} aria-hidden className="text-[#666]" />
              Take Break
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={onEndShift}
              aria-label="End shift"
              className="w-full h-[54px] rounded-[14px] border border-red-500/30 bg-red-500/5 text-red-400 font-semibold text-[15px] flex items-center justify-center gap-2.5"
            >
              <Square size={13} aria-hidden className="text-red-400 fill-red-400" />
              End Shift
            </motion.button>
          </>
        )}
      </div>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Confirm end overlay
────────────────────────────────────────────────────────────────────────── */
function ConfirmEndOverlay({
  companyName,
  onConfirm,
  onCancel,
}: {
  companyName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      key="confirm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-end"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm end shift"
      onClick={onCancel}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 360, damping: 36 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-[#0A0A0A] border-t border-[#1A1A1A] rounded-t-[24px] px-5 pt-5 pb-10"
      >
        <div aria-hidden className="w-10 h-1 rounded-full bg-[#2A2A2A] mx-auto mb-6" />
        <h2 className="text-white font-bold text-[22px] mb-2">End your shift?</h2>
        <p className="text-[#555] text-[14px] mb-7 leading-relaxed">
          Your timesheet will be submitted to{' '}
          <span className="text-white font-medium">{companyName}</span> and your pay will be calculated.
        </p>
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={onConfirm}
          aria-label="Confirm end shift"
          className="w-full h-[52px] rounded-[14px] bg-red-500 text-white font-bold text-[15px] mb-3"
        >
          End Shift
        </motion.button>
        <button
          type="button"
          aria-label="Cancel and continue working"
          onClick={onCancel}
          className="w-full h-[44px] text-[#555] font-medium text-[15px]"
        >
          Continue working
        </button>
      </motion.div>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Summary row helper
────────────────────────────────────────────────────────────────────────── */
function SummaryRow({
  label,
  value,
  valueClass = 'text-white',
  small = false,
  bold = false,
}: {
  label: string;
  value: string;
  valueClass?: string;
  small?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className={`text-[#555] ${small ? 'text-[12px]' : 'text-[14px]'}`}>{label}</p>
      <p className={`${bold ? 'font-bold' : 'font-medium'} ${small ? 'text-[13px]' : 'text-[15px]'} ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Summary screen
────────────────────────────────────────────────────────────────────────── */
function SummaryScreen({
  shift,
  shiftSecs,
  breakSecs,
  billedSecs,
  grossPay,
  serviceFee,
  netPay,
  onRate,
}: {
  shift: MockShift;
  shiftSecs: number;
  breakSecs: number;
  billedSecs: number;
  grossPay: number;
  serviceFee: number;
  netPay: number;
  onRate: () => void;
}) {
  return (
    <motion.div
      key="summary"
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex-1 flex flex-col min-h-[100dvh] px-5 pt-12 pb-10 overflow-y-auto"
    >
      {/* Header */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
          className="w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-500/35 flex items-center justify-center mx-auto mb-5"
        >
          <CheckCircle2 size={38} aria-hidden className="text-emerald-400" />
        </motion.div>
        <h1 className="text-white font-bold text-[28px] tracking-tight">Shift Complete</h1>
        <p className="text-[#555] text-[14px] mt-1.5 font-medium">
          {shift.jobType} · {shift.companyName}
        </p>
      </div>

      {/* Summary card */}
      <div className="bg-[#080808] border border-[#181818] rounded-[20px] px-5 py-5 mb-5">
        <p className="text-[#3A3A3A] text-[10px] font-bold uppercase tracking-[0.2em] mb-4">
          Shift Summary
        </p>

        {/* Time section */}
        <div className="flex flex-col gap-3.5 pb-4 border-b border-[#141414]">
          <SummaryRow label="Total time on clock" value={fmtHM(shiftSecs)} />
          <SummaryRow
            label="Break deducted"
            value={breakSecs > 0 ? `−${fmtHM(breakSecs)}` : '—'}
            valueClass="text-[#555]"
          />
          <SummaryRow label="Hours billed" value={fmtHM(billedSecs)} bold />
        </div>

        {/* Pay section */}
        <div className="flex flex-col gap-3.5 pt-4">
          <SummaryRow label="Gross pay" value={fmtMoney(grossPay)} />
          <SummaryRow
            label="365 Service Fee (8%)"
            value={`−${fmtMoney(serviceFee)}`}
            valueClass="text-[#555]"
            small
          />
          {/* Net pay total */}
          <div className="flex items-center justify-between mt-1 pt-4 border-t border-[#181818]">
            <p className="text-white font-bold text-[16px]">Your net pay</p>
            <p className="text-primary font-bold" style={{ fontSize: 28 }}>
              {fmtMoney(netPay)}
            </p>
          </div>
        </div>
      </div>

      {/* Timesheet confirmation */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="flex items-center gap-3 bg-emerald-500/8 border border-emerald-500/20 rounded-[14px] px-4 py-3.5 mb-8"
        role="status"
        aria-label="Timesheet submitted"
      >
        <CheckCircle2 size={18} aria-hidden className="text-emerald-400 flex-shrink-0" />
        <p className="text-emerald-400 text-[14px] font-medium">
          Timesheet sent to {shift.companyName}
        </p>
      </motion.div>

      {/* CTA */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        onClick={onRate}
        aria-label="Rate this shift"
        className="w-full h-[54px] rounded-[14px] bg-primary text-black font-bold text-[16px] flex items-center justify-center gap-2.5 mt-auto"
      >
        <Star size={18} aria-hidden className="fill-black" />
        Rate this Shift
      </motion.button>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Review screen
────────────────────────────────────────────────────────────────────────── */
const REVIEW_TAGS = [
  'Great Venue',
  'Clear Instructions',
  'Paid on Time',
  'Would Return',
  'Professional Staff',
  'Great Team',
  'Late Start',
  'Poor Communication',
  'Disorganized',
];

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'];

function ReviewScreen({
  shift,
  onSubmit,
}: {
  shift: MockShift;
  onSubmit: () => void;
}) {
  const [rating,        setRating]        = useState(0);
  const [hoverRating,   setHoverRating]   = useState(0);
  const [selectedTags,  setSelectedTags]  = useState<Set<string>>(new Set());
  const [comment,       setComment]       = useState('');

  const displayRating = hoverRating || rating;

  function toggleTag(tag: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  }

  return (
    <motion.div
      key="review"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="flex-1 flex flex-col min-h-[100dvh] px-5 pt-10 pb-12 overflow-y-auto"
    >
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-white font-bold text-[24px] tracking-tight">Rate Your Experience</h1>
        <p className="text-[#555] text-[14px] mt-1.5">{shift.companyName} · {shift.jobType}</p>
      </div>

      {/* Star row */}
      <div
        className="flex items-center justify-center gap-3 mb-2"
        role="group"
        aria-label="Star rating"
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <motion.button
            key={i}
            type="button"
            aria-label={`${i} star${i !== 1 ? 's' : ''}`}
            aria-pressed={rating === i}
            whileTap={{ scale: 0.82 }}
            onClick={() => setRating(i)}
            onMouseEnter={() => setHoverRating(i)}
            onMouseLeave={() => setHoverRating(0)}
          >
            <Star
              size={42}
              aria-hidden
              className={
                displayRating >= i
                  ? 'text-primary fill-primary'
                  : 'text-[#222] fill-[#222]'
              }
            />
          </motion.button>
        ))}
      </div>

      {/* Rating label */}
      <div className="h-6 flex items-center justify-center mb-6">
        <AnimatePresence mode="wait">
          {displayRating > 0 && (
            <motion.p
              key={displayRating}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-[#666] text-[14px] font-medium"
            >
              {RATING_LABELS[displayRating]}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Tags */}
      <p className="text-[#3A3A3A] text-[11px] font-bold uppercase tracking-widest mb-3">
        How was it?
      </p>
      <div
        className="flex flex-wrap gap-2 mb-6"
        role="group"
        aria-label="Review tags"
      >
        {REVIEW_TAGS.map((tag) => {
          const on = selectedTags.has(tag);
          return (
            <motion.button
              key={tag}
              type="button"
              aria-pressed={on}
              whileTap={{ scale: 0.94 }}
              onClick={() => toggleTag(tag)}
              className={`rounded-full px-4 py-2 text-[13px] font-medium border transition-all duration-150 ${
                on
                  ? 'bg-primary/15 border-primary/40 text-primary'
                  : 'bg-[#0E0E0E] border-[#1E1E1E] text-[#555]'
              }`}
            >
              {tag}
            </motion.button>
          );
        })}
      </div>

      {/* Comment */}
      <p className="text-[#3A3A3A] text-[11px] font-bold uppercase tracking-widest mb-2">
        Add a comment <span className="normal-case text-[#2A2A2A]">(optional)</span>
      </p>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Share your experience with this client…"
        rows={3}
        aria-label="Optional review comment"
        className="w-full bg-[#0C0C0C] border border-[#1E1E1E] rounded-[14px] px-4 py-3 text-white text-[14px] placeholder:text-[#2A2A2A] focus:outline-none focus:border-primary/40 resize-none mb-6 leading-relaxed"
      />

      {/* Submit */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        onClick={onSubmit}
        disabled={rating === 0}
        aria-label={rating === 0 ? 'Select a star rating to submit' : 'Submit review'}
        aria-disabled={rating === 0}
        className={`w-full h-[54px] rounded-[14px] font-bold text-[16px] transition-all duration-200 ${
          rating > 0
            ? 'bg-primary text-black'
            : 'bg-[#111] text-[#333] cursor-not-allowed border border-[#1E1E1E]'
        }`}
      >
        Submit Review
      </motion.button>
      <button
        type="button"
        aria-label="Skip review and return to home"
        onClick={onSubmit}
        className="w-full h-[42px] text-[#333] text-[13px] font-medium underline underline-offset-2 active:text-[#555]"
      >
        Skip for now
      </button>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   ClockInScreen — main orchestrator
────────────────────────────────────────────────────────────────────────── */
export function ClockInScreen() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const shift = MOCK_SHIFTS.find((s) => s.id === id);

  const [phase,        setPhase]       = useState<Phase>('geo-check');
  const [confirmEnd,   setConfirmEnd]  = useState(false);
  const [shiftSecs,    setShiftSecs]   = useState(0);
  const [breakSecs,    setBreakSecs]   = useState(0);

  const shiftRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const breakRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Geo-check chain ── */
  useEffect(() => {
    if (phase !== 'geo-check') return;
    const t = setTimeout(() => setPhase('geo-success'), 2200);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'geo-success') return;
    const t = setTimeout(() => {
      setPhase('active');
      shiftRef.current = setInterval(() => setShiftSecs((s) => s + 1), 1000);
    }, 1600);
    return () => clearTimeout(t);
  }, [phase]);

  /* ── Cleanup on unmount ── */
  useEffect(() => {
    return () => {
      if (shiftRef.current) clearInterval(shiftRef.current);
      if (breakRef.current) clearInterval(breakRef.current);
    };
  }, []);

  /* ── Actions ── */
  function handleTakeBreak() {
    if (shiftRef.current) { clearInterval(shiftRef.current); shiftRef.current = null; }
    breakRef.current = setInterval(() => setBreakSecs((s) => s + 1), 1000);
    setPhase('on-break');
  }

  function handleEndBreak() {
    if (breakRef.current) { clearInterval(breakRef.current); breakRef.current = null; }
    shiftRef.current = setInterval(() => setShiftSecs((s) => s + 1), 1000);
    setPhase('active');
  }

  function handleEndShift() {
    if (shiftRef.current) { clearInterval(shiftRef.current); shiftRef.current = null; }
    if (breakRef.current) { clearInterval(breakRef.current); breakRef.current = null; }
    if (id) markClockedIn(id);
    setConfirmEnd(false);
    setPhase('summary');
  }

  /* ── Pay calc ── */
  const billedSecs  = Math.max(0, shiftSecs - breakSecs);
  const billedHours = billedSecs / 3600;
  const grossPay    = billedHours * (shift?.payRate ?? 0);
  const serviceFee  = grossPay * 0.08;
  const netPay      = grossPay - serviceFee;

  if (!shift) {
    return (
      <div className="min-h-[100dvh] bg-black flex items-center justify-center">
        <p className="text-[#555] text-[15px]">Shift not found.</p>
      </div>
    );
  }

  const showBack = phase === 'active' || phase === 'on-break' || phase === 'geo-fail';

  return (
    <div className="min-h-[100dvh] bg-black flex flex-col relative overflow-hidden">

      {/* Back button */}
      <AnimatePresence>
        {showBack && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            type="button"
            aria-label="Go back to shift details"
            onClick={() => navigate(`/shift/${shift.id}`)}
            className="absolute top-5 left-4 w-9 h-9 rounded-full bg-[#0E0E0E] border border-[#1E1E1E] flex items-center justify-center z-20"
          >
            <ChevronLeft size={18} aria-hidden className="text-[#666]" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Phase screens */}
      <AnimatePresence mode="wait">
        {phase === 'geo-check' && (
          <GeoCheckScreen
            key="geo-check"
            onSimulateFail={() => setPhase('geo-fail')}
          />
        )}

        {phase === 'geo-success' && <GeoSuccessScreen key="geo-success" />}

        {phase === 'geo-fail' && (
          <GeoFailScreen key="geo-fail" onRetry={() => setPhase('geo-check')} />
        )}

        {(phase === 'active' || phase === 'on-break') && (
          <ActiveScreen
            key="active"
            shift={shift}
            phase={phase}
            shiftSecs={shiftSecs}
            breakSecs={breakSecs}
            onTakeBreak={handleTakeBreak}
            onEndBreak={handleEndBreak}
            onEndShift={() => setConfirmEnd(true)}
          />
        )}

        {phase === 'summary' && (
          <SummaryScreen
            key="summary"
            shift={shift}
            shiftSecs={shiftSecs}
            breakSecs={breakSecs}
            billedSecs={billedSecs}
            grossPay={grossPay}
            serviceFee={serviceFee}
            netPay={netPay}
            onRate={() => setPhase('review')}
          />
        )}

        {phase === 'review' && (
          <ReviewScreen
            key="review"
            shift={shift}
            onSubmit={() => navigate('/home')}
          />
        )}
      </AnimatePresence>

      {/* Confirm end overlay */}
      <AnimatePresence>
        {confirmEnd && (
          <ConfirmEndOverlay
            key="confirm"
            companyName={shift.companyName}
            onConfirm={handleEndShift}
            onCancel={() => setConfirmEnd(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
