import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, CheckCircle2, XCircle, Coffee,
  Square, Star, ChevronLeft, AlarmClock, ArrowUpRight, AlertTriangle,
} from 'lucide-react';
import type { MockShift } from '@/lib/supabase';
import { markClockedIn } from '@/store/feedStore';
import { useShiftById } from '@/hooks/useShifts';
import { useAuth } from '@/contexts/AuthContext';
import { haversineMiles, supabase } from '@/lib/supabase';
import { useTimeEntry } from '@/hooks/useTimeEntry';
import { useToast } from '@/contexts/ToastContext';

/* ── Helpers ─────────────────────────────────────────────────────────────── */
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

function fmtMoney(n: number): string { return `$${n.toFixed(2)}`; }

/* ── Phase types ─────────────────────────────────────────────────────────── */
type Phase = 'geo-check' | 'geo-success' | 'geo-fail' | 'active' | 'on-break' | 'transfer' | 'summary' | 'already-done' | 'end-error';
type GeoFailReason = 'too-far' | 'denied' | 'unavailable';

/* ── Geo-check ───────────────────────────────────────────────────────────── */
function GeoCheckScreen() {
  return (
    <motion.div key="geo-check" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.2 }}
      className="flex-1 flex flex-col items-center justify-center gap-7 px-8 min-h-[100dvh]">

      <div className="relative flex items-center justify-center">
        <motion.div animate={{ scale: [1, 1.6, 1], opacity: [0.2, 0, 0.2] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeOut' }}
          className="absolute w-24 h-24 rounded-full bg-black/8" />
        <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.35, 0.1, 0.35] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeOut', delay: 0.3 }}
          className="absolute w-16 h-16 rounded-full bg-black/10" />
        <div className="w-14 h-14 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center relative z-10">
          <MapPin size={24} aria-hidden className="text-black" />
        </div>
      </div>

      <div className="w-7 h-7 rounded-full border-[2.5px] border-[#DBDBDB] border-t-[#0A1628] animate-spin"
        role="status" aria-label="Verifying location" />

      <div className="text-center">
        <p className="text-black font-semibold text-[18px]">Verifying location…</p>
        <p className="text-[#737373] text-[13px] mt-1.5">Checking your distance from the venue</p>
      </div>
    </motion.div>
  );
}

/* ── Geo-success ──────────────────────────────────────────────────────────── */
function GeoSuccessScreen({ locationLabel }: { locationLabel: string }) {
  return (
    <motion.div key="geo-success" initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 280, damping: 22 }}
      className="flex-1 flex flex-col items-center justify-center gap-5 px-8 min-h-[100dvh]">

      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 18, delay: 0.08 }}
        className="w-24 h-24 rounded-full bg-emerald-50 border-2 border-[#10B981] flex items-center justify-center">
        <CheckCircle2 size={44} aria-hidden className="text-[#10B981]" />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }} className="text-center">
        <p className="text-[#10B981] font-bold text-[26px]">You're on-site!</p>
        <p className="text-[#737373] text-[15px] mt-1.5">Clock in confirmed</p>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
        className="bg-emerald-50 border border-emerald-200 rounded-[12px] px-5 py-3 flex items-center gap-2.5">
        <MapPin size={14} aria-hidden className="text-[#10B981] flex-shrink-0" />
        <p className="text-[#10B981] text-[13px] font-medium">Location verified · {locationLabel}</p>
      </motion.div>
    </motion.div>
  );
}

/* ── Geo-fail ─────────────────────────────────────────────────────────────── */
const FAIL_COPY: Record<GeoFailReason, { title: string; body: string }> = {
  'too-far':     { title: "You're too far from the venue", body: 'You appear to be more than 1 mile away from the shift location.' },
  'denied':      { title: 'Location permission needed', body: 'Enable location access for this site, then try again to clock in.' },
  'unavailable': { title: "Couldn't verify location", body: "Your device didn't return a GPS signal. Try again outdoors or near a window." },
};

function GeoFailScreen({ reason, distance, shiftLocation, onRetry }: {
  reason: GeoFailReason; distance: number | null; shiftLocation: string; onRetry: () => void;
}) {
  const copy = FAIL_COPY[reason];
  return (
    <motion.div key="geo-fail" initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 280, damping: 22 }}
      className="flex-1 flex flex-col items-center justify-center gap-5 px-8 min-h-[100dvh] text-center">

      <div className="w-24 h-24 rounded-full bg-red-50 border-2 border-[#EF4444]/30 flex items-center justify-center">
        <XCircle size={44} aria-hidden className="text-[#EF4444]" />
      </div>

      <div>
        <p className="text-[#EF4444] font-bold text-[22px]">{copy.title}</p>
        <p className="text-[#737373] text-[14px] mt-2 leading-relaxed">{copy.body}</p>
      </div>

      <div className="w-full bg-[#FAFAFA] border border-[#DBDBDB] rounded-[12px] px-4 py-4 text-left flex flex-col gap-4">
        <div>
          <p className="text-[#737373] text-[11px] font-semibold uppercase tracking-widest mb-1">Required</p>
          <div className="flex items-center gap-2">
            <MapPin size={13} aria-hidden className="text-[#10B981] flex-shrink-0" />
            <p className="text-black text-[14px] font-medium">{shiftLocation}</p>
          </div>
        </div>
        {reason === 'too-far' && distance !== null && (
          <div>
            <p className="text-[#737373] text-[11px] font-semibold uppercase tracking-widest mb-1">Your distance</p>
            <div className="flex items-center gap-2">
              <MapPin size={13} aria-hidden className="text-[#EF4444] flex-shrink-0" />
              <p className="text-[#EF4444] text-[14px] font-medium">{distance.toFixed(1)} mi away</p>
            </div>
          </div>
        )}
      </div>

      <div className="w-full flex flex-col gap-3 mt-2">
        <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={onRetry}
          aria-label="Try location check again"
          className="w-full h-[52px] rounded-[8px] bg-white border border-[#DBDBDB] text-black font-semibold text-[15px]">
          Try Again
        </motion.button>
        <button type="button" aria-label="Contact your shift manager for location override"
          className="text-[#737373] text-[13px] underline underline-offset-2 active:text-black">
          Contact shift manager
        </button>
      </div>
    </motion.div>
  );
}

/* ── Active + On Break ───────────────────────────────────────────────────── */
function ActiveScreen({ shift, phase, shiftSecs, breakSecs, onTakeBreak, onEndBreak, onEndShift }: {
  shift: MockShift; phase: 'active' | 'on-break';
  shiftSecs: number; breakSecs: number;
  onTakeBreak: () => void; onEndBreak: () => void; onEndShift: () => void;
}) {
  const isBreak = phase === 'on-break';

  return (
    <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0 }} className="flex-1 flex flex-col min-h-[100dvh]">

      {/* Shift info header */}
      <div className="pt-[72px] px-6 text-center">
        <p className="text-[#737373] text-[12px] font-semibold uppercase tracking-widest mb-1">
          {shift.jobType}
        </p>
        <p className="text-black font-bold text-[20px] leading-tight">{shift.companyName}</p>
        <p className="text-[#AAAAAA] text-[12px] mt-0.5">{shift.location}</p>
      </div>

      {/* Timer area */}
      <div className="flex-1 flex flex-col items-center justify-center relative px-6">
        {isBreak ? (
          <div className="flex flex-col items-center gap-8 relative z-10">
            <div className="text-center opacity-35" aria-label={`Shift time: ${fmtHMS(shiftSecs)}`}>
              <p className="text-[#737373] text-[10px] font-semibold uppercase tracking-[0.18em] mb-1.5">
                Shift Time
              </p>
              <p className="text-black font-bold tabular-nums leading-none" style={{ fontSize: 44 }}>
                {fmtHMS(shiftSecs)}
              </p>
            </div>

            <div className="text-center" aria-live="polite" aria-label={`Break time: ${fmtHMS(breakSecs)}`}>
              <p className="text-[#0095F6] text-[11px] font-semibold uppercase tracking-[0.18em] mb-2">
                Break Time
              </p>
              <p className="font-bold tabular-nums leading-none text-[#0095F6]" style={{ fontSize: 72 }}>
                {fmtHMS(breakSecs)}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center relative z-10" aria-live="polite" aria-label={`Time on shift: ${fmtHMS(shiftSecs)}`}>
            <p className="font-bold tabular-nums leading-none text-black" style={{ fontSize: 76 }}>
              {fmtHMS(shiftSecs)}
            </p>
            {breakSecs > 0 && (
              <p className="text-[#AAAAAA] text-[12px] mt-3 font-medium">
                {fmtHM(breakSecs)} break taken
              </p>
            )}
          </div>
        )}

        {/* Status badge */}
        <div className={`flex items-center gap-2.5 mt-8 px-5 py-2.5 rounded-full border relative z-10 ${
          isBreak ? 'bg-blue-50 border-blue-200' : 'bg-emerald-50 border-emerald-200'
        }`} aria-label={isBreak ? 'Status: On Break' : 'Status: On Shift'}>
          <motion.div animate={{ opacity: [1, 0.25, 1] }} transition={{ repeat: Infinity, duration: 1.6 }}
            className={`w-2 h-2 rounded-full flex-shrink-0 ${isBreak ? 'bg-[#0095F6]' : 'bg-[#10B981]'}`} />
          <span className={`text-[13px] font-bold uppercase tracking-[0.14em] ${
            isBreak ? 'text-[#0095F6]' : 'text-[#10B981]'
          }`}>
            {isBreak ? 'On Break' : 'On Shift'}
          </span>
        </div>
      </div>

      {/* Buttons */}
      <div className="px-5 pb-10 flex flex-col gap-3">
        {isBreak ? (
          <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={onEndBreak}
            aria-label="End break and resume shift"
            className="w-full h-[52px] rounded-[8px] bg-[#0A1628] text-white font-bold text-[16px] flex items-center justify-center gap-2.5">
            <AlarmClock size={18} aria-hidden />
            End Break
          </motion.button>
        ) : (
          <>
            <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={onTakeBreak}
              aria-label="Take a break"
              className="w-full h-[52px] rounded-[8px] bg-white border border-[#DBDBDB] text-black font-semibold text-[15px] flex items-center justify-center gap-2.5">
              <Coffee size={17} aria-hidden className="text-[#737373]" />
              Take Break
            </motion.button>
            <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={onEndShift}
              aria-label="End shift"
              className="w-full h-[52px] rounded-[8px] border border-[#EF4444]/30 bg-red-50 text-[#EF4444] font-semibold text-[15px] flex items-center justify-center gap-2.5">
              <Square size={13} aria-hidden className="text-[#EF4444] fill-[#EF4444]" />
              End Shift
            </motion.button>
          </>
        )}
      </div>
    </motion.div>
  );
}

/* ── Confirm end overlay ──────────────────────────────────────────────────── */
function ConfirmEndOverlay({ companyName, onConfirm, onCancel }: {
  companyName: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end"
      role="dialog" aria-modal="true" aria-label="Confirm end shift" onClick={onCancel}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 360, damping: 36 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-white border-t border-[#DBDBDB] rounded-t-[24px] px-5 pt-5 pb-10">
        <div aria-hidden className="w-10 h-1 rounded-full bg-[#DBDBDB] mx-auto mb-6" />
        <h2 className="text-black font-bold text-[22px] mb-2">End your shift?</h2>
        <p className="text-[#737373] text-[14px] mb-7 leading-relaxed">
          Your timesheet will be submitted to{' '}
          <span className="text-black font-medium">{companyName}</span> and your pay will be calculated.
        </p>
        <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={onConfirm}
          aria-label="Confirm end shift"
          className="w-full h-[52px] rounded-[8px] bg-[#EF4444] text-white font-bold text-[15px] mb-3">
          End Shift
        </motion.button>
        <button type="button" aria-label="Cancel and continue working" onClick={onCancel}
          className="w-full h-[44px] text-[#737373] font-medium text-[15px]">
          Continue working
        </button>
      </motion.div>
    </motion.div>
  );
}

/* ── Transfer screen (simulated instant payout) ───────────────────────────── */
function TransferScreen({ netPay, onDone }: { netPay: number; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div key="transfer" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0 }} className="flex-1 flex flex-col items-center justify-center gap-6 px-8 min-h-[100dvh]">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        className="w-24 h-24 rounded-full bg-emerald-50 border-2 border-[#10B981] flex items-center justify-center">
        <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 1.1 }}>
          <ArrowUpRight size={40} aria-hidden className="text-[#10B981]" />
        </motion.div>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="text-center">
        <p className="text-[#737373] text-[13px] font-semibold uppercase tracking-widest mb-1.5">Sending instant transfer</p>
        <p className="text-[#10B981] font-bold" style={{ fontSize: 40 }}>{fmtMoney(netPay)}</p>
      </motion.div>
      <div className="w-6 h-6 rounded-full border-2 border-[#DBDBDB] border-t-[#10B981] animate-spin" role="status" aria-label="Processing transfer" />
    </motion.div>
  );
}

/* ── Summary row ─────────────────────────────────────────────────────────── */
function SummaryRow({ label, value, valueClass = 'text-black', small = false, bold = false }: {
  label: string; value: string; valueClass?: string; small?: boolean; bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className={`text-[#737373] ${small ? 'text-[12px]' : 'text-[14px]'}`}>{label}</p>
      <p className={`${bold ? 'font-bold' : 'font-medium'} ${small ? 'text-[13px]' : 'text-[15px]'} ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}

/* ── Summary screen ──────────────────────────────────────────────────────── */
function SummaryScreen({ shift, shiftSecs, breakSecs, billedSecs, grossPay, serviceFee, netPay, onRate }: {
  shift: MockShift; shiftSecs: number; breakSecs: number; billedSecs: number;
  grossPay: number; serviceFee: number; netPay: number; onRate: () => void;
}) {
  return (
    <motion.div key="summary" initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex-1 flex flex-col min-h-[100dvh] px-5 pt-12 pb-10 overflow-y-auto">

      <div className="text-center mb-8">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
          className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-[#10B981] flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 size={38} aria-hidden className="text-[#10B981]" />
        </motion.div>
        <h1 className="text-black font-bold text-[28px] tracking-tight">Shift Complete</h1>
        <p className="text-[#737373] text-[14px] mt-1.5 font-medium">
          {shift.jobType} · {shift.companyName}
        </p>
      </div>

      {/* Summary card */}
      <div className="bg-[#FAFAFA] border border-[#DBDBDB] rounded-[16px] px-5 py-5 mb-5">
        <p className="text-[#737373] text-[10px] font-bold uppercase tracking-[0.2em] mb-4">Shift Summary</p>

        <div className="flex flex-col gap-3.5 pb-4 border-b border-[#DBDBDB]">
          <SummaryRow label="Total time on clock" value={fmtHM(shiftSecs)} />
          <SummaryRow label="Break deducted" value={breakSecs > 0 ? `−${fmtHM(breakSecs)}` : '—'}
            valueClass="text-[#737373]" />
          <SummaryRow label="Hours billed" value={fmtHM(billedSecs)} bold />
        </div>

        <div className="flex flex-col gap-3.5 pt-4">
          <SummaryRow label="Gross pay" value={fmtMoney(grossPay)} />
          <SummaryRow label="365 Service Fee (8%)" value={`−${fmtMoney(serviceFee)}`}
            valueClass="text-[#737373]" small />
          <div className="flex items-center justify-between mt-1 pt-4 border-t border-[#DBDBDB]">
            <p className="text-black font-bold text-[16px]">Your net pay</p>
            <p className="text-black font-bold" style={{ fontSize: 28 }}>{fmtMoney(netPay)}</p>
          </div>
        </div>
      </div>

      {/* Timesheet confirmation */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-[12px] px-4 py-3.5 mb-8"
        role="status" aria-label="Timesheet submitted">
        <CheckCircle2 size={18} aria-hidden className="text-[#10B981] flex-shrink-0" />
        <p className="text-[#10B981] text-[14px] font-medium">
          Timesheet sent to {shift.companyName}
        </p>
      </motion.div>

      {/* CTA */}
      <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={onRate}
        aria-label="Rate this shift"
        className="w-full h-[52px] rounded-[8px] bg-[#0A1628] text-white font-bold text-[16px] flex items-center justify-center gap-2.5 mt-auto">
        <Star size={18} aria-hidden className="fill-white" />
        Rate this Shift
      </motion.button>
    </motion.div>
  );
}

/* ── Already-completed screen ─────────────────────────────────────────────── */
function AlreadyDoneScreen({ shift, netPay, onDone }: { shift: MockShift; netPay: number | null; onDone: () => void }) {
  return (
    <motion.div key="already-done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="flex-1 flex flex-col items-center justify-center gap-5 px-8 min-h-[100dvh] text-center">
      <div className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-[#10B981] flex items-center justify-center">
        <CheckCircle2 size={36} aria-hidden className="text-[#10B981]" />
      </div>
      <div>
        <p className="text-black font-bold text-[20px]">This shift is already complete</p>
        <p className="text-[#737373] text-[14px] mt-2">
          You clocked out of {shift.companyName}{netPay !== null ? ` · net pay ${fmtMoney(netPay)}` : ''}.
        </p>
      </div>
      <button type="button" onClick={onDone}
        className="w-full h-[52px] rounded-[8px] bg-[#0A1628] text-white font-bold text-[16px]">
        Back to Shift
      </button>
    </motion.div>
  );
}

/* ── End-shift error screen ──────────────────────────────────────────────── */
function EndShiftErrorScreen({ message, onRetry, onBack }: { message: string | null; onRetry: () => void; onBack: () => void }) {
  return (
    <motion.div key="end-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="flex-1 flex flex-col items-center justify-center gap-5 px-8 min-h-[100dvh] text-center">
      <div className="w-20 h-20 rounded-full bg-red-50 border-2 border-[#EF4444] flex items-center justify-center">
        <AlertTriangle size={36} aria-hidden className="text-[#EF4444]" />
      </div>
      <div>
        <p className="text-black font-bold text-[20px]">We hit a snag</p>
        <p className="text-[#737373] text-[14px] mt-2">{message ?? 'Something went wrong ending your shift.'}</p>
      </div>
      <button type="button" onClick={onRetry}
        className="w-full h-[52px] rounded-[8px] bg-[#0A1628] text-white font-bold text-[16px]">
        Try Again
      </button>
      <button type="button" onClick={onBack} className="text-[#0095F6] font-semibold text-[14px]">
        Back to Shift
      </button>
    </motion.div>
  );
}

/* ── ClockInScreen ───────────────────────────────────────────────────────── */
export function ClockInScreen() {
  const { id }             = useParams<{ id: string }>();
  const [, navigate]       = useLocation();
  const { user }            = useAuth();
  const { data: shift, isLoading, error } = useShiftById(id);
  const { startOrResume, completeEntry } = useTimeEntry();
  const { showToast } = useToast();

  const [phase,      setPhase]      = useState<Phase>('geo-check');
  const [failReason, setFailReason] = useState<GeoFailReason>('too-far');
  const [failDistance, setFailDistance] = useState<number | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [shiftSecs,  setShiftSecs]  = useState(0);
  const [breakSecs,  setBreakSecs]  = useState(0);
  const [entryId,    setEntryId]    = useState<string | null>(null);
  const [priorEntry, setPriorEntry] = useState<{ netPay: number | null } | null>(null);
  const [endShiftError, setEndShiftError] = useState<string | null>(null);
  const shiftRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const breakRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);

  const runGeoCheck = useCallback(() => {
    if (!shift || !user?.id) return;
    setPhase('geo-check');
    const MIN_SPINNER_MS = 1200;
    const startedAt = Date.now();

    const finish = (result: { ok: true } | { ok: false; reason: GeoFailReason; distance: number | null }) => {
      const elapsed = Date.now() - startedAt;
      const wait = Math.max(0, MIN_SPINNER_MS - elapsed);
      setTimeout(async () => {
        if (!result.ok) {
          setFailReason(result.reason);
          setFailDistance(result.distance);
          setPhase('geo-fail');
          return;
        }
        try {
          const entry = await startOrResume(shift.id, user.id);
          if (entry.alreadyCompleted) {
            setEntryId(entry.id);
            const priorNet = entry.totalPay !== null && entry.fee !== null ? entry.totalPay - entry.fee : null;
            setPriorEntry({ netPay: priorNet });
            setPhase('already-done');
            return;
          }
          setEntryId(entry.id);
          if (entry.resumed) {
            const elapsedSinceClockIn = Math.max(0, Math.floor((Date.now() - new Date(entry.clockInISO).getTime()) / 1000));
            setShiftSecs(elapsedSinceClockIn);
            setBreakSecs(entry.breakMinutes * 60);
          }
          setPhase('geo-success');
        } catch (e) {
          console.error('[ClockIn] failed to start time entry:', e);
          setFailReason('unavailable');
          setFailDistance(null);
          setPhase('geo-fail');
        }
      }, wait);
    };

    if (!navigator.geolocation) {
      finish({ ok: false, reason: 'unavailable', distance: null });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const distance = haversineMiles(pos.coords.latitude, pos.coords.longitude, shift.lat, shift.lng);
        if (distance <= 1) finish({ ok: true });
        else finish({ ok: false, reason: 'too-far', distance });
      },
      (geoError) => {
        finish({ ok: false, reason: geoError.code === geoError.PERMISSION_DENIED ? 'denied' : 'unavailable', distance: null });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  }, [shift, user?.id, startOrResume]);

  useEffect(() => {
    if (startedRef.current || !shift || !user?.id) return;
    startedRef.current = true;
    runGeoCheck();
  }, [shift, user?.id, runGeoCheck]);

  useEffect(() => {
    if (phase !== 'geo-success') return;
    const t = setTimeout(() => {
      setPhase('active');
      shiftRef.current = setInterval(() => setShiftSecs((s) => s + 1), 1000);
      showToast('Clocked in. Your timer has started.');
    }, 1600);
    return () => clearTimeout(t);
  // showToast is stable (useCallback with [] deps) — safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    return () => {
      if (shiftRef.current) clearInterval(shiftRef.current);
      if (breakRef.current) clearInterval(breakRef.current);
    };
  }, []);

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

  const billedSecs  = Math.max(0, shiftSecs - breakSecs);
  const billedHours = billedSecs / 3600;
  const grossPay    = billedHours * (shift?.payRate ?? 0);
  const serviceFee  = grossPay * 0.08;
  const netPay      = grossPay - serviceFee;

  async function handleEndShift() {
    if (shiftRef.current) { clearInterval(shiftRef.current); shiftRef.current = null; }
    if (breakRef.current) { clearInterval(breakRef.current); breakRef.current = null; }
    setConfirmEnd(false);

    if (!entryId || !user?.id || !shift) {
      setEndShiftError('Missing shift or session data — please go back and try again.');
      setPhase('end-error');
      return;
    }

    const { error: completeError } = await completeEntry(entryId, {
      clockOutISO: new Date().toISOString(),
      breakMinutes: breakSecs / 60,
      totalHours: billedHours,
      totalPay: grossPay,
      fee: serviceFee,
    });
    if (completeError) {
      console.error('[ClockIn] failed to complete time entry:', completeError);
      setEndShiftError("We couldn't save your timesheet. Please try ending your shift again.");
      setPhase('end-error');
      // restart timers so the user isn't stuck mid-shift with dead clocks
      shiftRef.current = setInterval(() => setShiftSecs((s) => s + 1), 1000);
      return;
    }

    const { error: paymentError } = await supabase.from('payments').insert({
      shift_id:     shift.id,
      worker_id:    user.id,
      payment_type: 'shift_payment',
      amount:       Math.round(grossPay * 100) / 100,
      fee:          Math.round(serviceFee * 100) / 100,
      net_amount:   Math.round(netPay * 100) / 100,
      status:       'completed',
    });
    if (paymentError) {
      console.error('[ClockIn] failed to record payment:', paymentError.message);
      setEndShiftError("Your timesheet was saved, but the payout couldn't be processed. It will be retried shortly.");
      setPhase('end-error');
      return;
    }

    if (id) markClockedIn(id);
    showToast('Shift complete! Your timesheet has been sent.');
    setPhase('transfer');
  }

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-white flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#DBDBDB] border-t-[#0A1628] animate-spin"
          role="status" aria-label="Loading shift" />
      </div>
    );
  }

  if (error || !shift) {
    return (
      <div className="min-h-[100dvh] bg-white flex flex-col items-center justify-center gap-4">
        <p className="text-[#737373] text-[15px]">{error ? "Couldn't load this shift." : 'Shift not found.'}</p>
        <button type="button"
          onClick={() => { if (window.history.length > 1) window.history.back(); else navigate(`/shift/${id ?? ''}`); }}
          className="text-[#0095F6] font-semibold text-[14px]">← Go back</button>
      </div>
    );
  }

  const showBack = phase === 'active' || phase === 'on-break' || phase === 'geo-fail';

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col relative overflow-hidden">
      <AnimatePresence>
        {showBack && (
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            type="button" aria-label="Go back to shift details"
            onClick={() => navigate(`/shift/${shift.id}`)}
            className="absolute top-5 left-4 w-9 h-9 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center z-20">
            <ChevronLeft size={18} aria-hidden className="text-black" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {phase === 'geo-check' && <GeoCheckScreen key="geo-check" />}
        {phase === 'geo-success' && <GeoSuccessScreen key="geo-success" locationLabel={shift.location} />}
        {phase === 'geo-fail' && (
          <GeoFailScreen key="geo-fail" reason={failReason} distance={failDistance}
            shiftLocation={shift.location} onRetry={runGeoCheck} />
        )}
        {(phase === 'active' || phase === 'on-break') && (
          <ActiveScreen key="active" shift={shift} phase={phase}
            shiftSecs={shiftSecs} breakSecs={breakSecs}
            onTakeBreak={handleTakeBreak} onEndBreak={handleEndBreak}
            onEndShift={() => setConfirmEnd(true)} />
        )}
        {phase === 'transfer' && <TransferScreen key="transfer" netPay={netPay} onDone={() => setPhase('summary')} />}
        {phase === 'summary' && (
          <SummaryScreen key="summary" shift={shift} shiftSecs={shiftSecs} breakSecs={breakSecs}
            billedSecs={billedSecs} grossPay={grossPay} serviceFee={serviceFee} netPay={netPay}
            onRate={() => navigate(`/review/${shift.id}/${shift.clientId}`)} />
        )}
        {phase === 'already-done' && (
          <AlreadyDoneScreen key="already-done" shift={shift} netPay={priorEntry?.netPay ?? null}
            onDone={() => navigate(`/shift/${shift.id}`)} />
        )}
        {phase === 'end-error' && (
          <EndShiftErrorScreen key="end-error" message={endShiftError}
            onRetry={handleEndShift} onBack={() => navigate(`/shift/${shift.id}`)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmEnd && (
          <ConfirmEndOverlay key="confirm" companyName={shift.companyName}
            onConfirm={handleEndShift} onCancel={() => setConfirmEnd(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
