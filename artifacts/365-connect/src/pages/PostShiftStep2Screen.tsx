import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { ChevronLeft, Calendar, Clock, Repeat2, Plus, Minus } from 'lucide-react';
import { getDraft, setDraft, durationLabel } from '@/store/postShiftStore';

/* ─── Step bar ───────────────────────────────────────────────────────────── */
function StepBar({ current, total }: { current: number; total: number }) {
  return (
    <div
      className="flex items-center gap-1.5"
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuetext={`Step ${current} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`h-[3px] rounded-full flex-1 transition-all duration-300 ${
          i < current ? 'bg-primary' : 'bg-[#2A2A2A]'
        }`} />
      ))}
    </div>
  );
}

/* ─── Shared form primitives ─────────────────────────────────────────────── */
function FormLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[#555] text-[11px] font-semibold uppercase tracking-wider mb-1.5">
      {children}
    </p>
  );
}

function FormSection({ icon, title, children }: {
  icon: React.ReactNode; title: string; children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-[7px] bg-[#161616] flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <h2 className="text-white font-bold text-[15px]">{title}</h2>
      </div>
      <div className="bg-[#0C0C0C] border border-[#1E1E1E] rounded-[16px] px-4 py-4 flex flex-col gap-4">
        {children}
      </div>
    </div>
  );
}

const INPUT_CLS = `
  w-full bg-[#141414] border border-[#252525] rounded-[10px] px-3 h-[44px]
  text-white text-[14px] font-medium placeholder:text-[#3A3A3A]
  focus:outline-none focus:border-primary/50 focus:bg-[#161616] transition-colors
`;

/* ─── Worker count stepper per job type ──────────────────────────────────── */
function WorkerStepper({
  label,
  count,
  onIncrement,
  onDecrement,
}: {
  label: string;
  count: number;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-white text-[14px] font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Decrease ${label} count`}
          onClick={onDecrement}
          className="w-8 h-8 rounded-[8px] bg-[#141414] border border-[#252525] flex items-center justify-center active:border-primary/40"
        >
          <Minus size={13} aria-hidden className="text-[#888]" />
        </button>
        <span className="text-white font-bold text-[17px] w-6 text-center tabular-nums" aria-live="polite">
          {count}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label} count`}
          onClick={onIncrement}
          className="w-8 h-8 rounded-[8px] bg-[#141414] border border-[#252525] flex items-center justify-center active:border-primary/40"
        >
          <Plus size={13} aria-hidden className="text-primary" />
        </button>
      </div>
    </div>
  );
}

/* ─── Repeat option ──────────────────────────────────────────────────────── */
type RepeatType = 'once' | 'weekly' | 'custom';
const REPEAT_OPTIONS: { key: RepeatType; label: string }[] = [
  { key: 'once',   label: 'One-time' },
  { key: 'weekly', label: 'Weekly'   },
  { key: 'custom', label: 'Custom'   },
];

/* ─── PostShiftStep2Screen ───────────────────────────────────────────────── */
export function PostShiftStep2Screen() {
  const [, navigate] = useLocation();
  const initial      = getDraft();

  const [date,         setDate]         = useState(initial.date);
  const [startTime,    setStartTime]    = useState(initial.startTime || '18:00');
  const [endTime,      setEndTime]      = useState(initial.endTime   || '23:00');
  const [repeat,       setRepeat]       = useState<RepeatType>(initial.repeat || 'once');
  const [workerCounts, setWorkerCounts] = useState<Record<string, number>>(
    // Ensure every selected job type has a count entry
    () => {
      const wc = { ...initial.workerCounts };
      for (const jt of initial.jobTypes) { if (!wc[jt]) wc[jt] = 1; }
      return wc;
    }
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Default to today if no date set
  useEffect(() => {
    if (!date) {
      const today = new Date().toISOString().split('T')[0];
      setDate(today);
    }
  }, []);

  function updateCount(type: string, delta: number) {
    setWorkerCounts((prev) => ({
      ...prev,
      [type]: Math.max(1, Math.min(50, (prev[type] ?? 1) + delta)),
    }));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!date) e.date = 'Date is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleContinue() {
    if (!validate()) return;
    setDraft({ date, startTime, endTime, repeat, workerCounts });
    navigate('/post-shift/step3');
  }

  const duration = durationLabel(startTime, endTime);

  return (
    <div className="min-h-[100dvh] bg-black flex flex-col">

      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-[#111]">
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            aria-label="Back to job types"
            onClick={() => navigate('/post-shift/step1')}
            className="w-9 h-9 rounded-full bg-[#111] border border-[#222] flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft size={18} aria-hidden className="text-[#888]" />
          </button>
          <div className="flex-1"><StepBar current={2} total={5} /></div>
          <span className="text-[#555] text-[12px] font-medium flex-shrink-0">2 of 5</span>
        </div>
        <h1 className="text-white font-bold text-[22px] tracking-tight">When is it?</h1>
        <p className="text-[#555] text-[13px] mt-1">Set the date, time, and staffing per role</p>
      </div>

      {/* Scrollable form */}
      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-36">

        {/* Date & Time */}
        <FormSection icon={<Calendar size={13} aria-hidden className="text-primary" />} title="Date & Time">
          <div>
            <FormLabel>Date</FormLabel>
            <input
              type="date"
              value={date}
              onChange={(e) => { setDate(e.target.value); setErrors((p) => ({ ...p, date: '' })); }}
              aria-label="Shift date"
              aria-invalid={!!errors.date}
              className={INPUT_CLS + (errors.date ? ' border-red-500/60' : '')}
              style={{ colorScheme: 'dark' }}
            />
            {errors.date && <p className="text-red-400 text-[11px] mt-1">{errors.date}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FormLabel>Start time</FormLabel>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                aria-label="Shift start time"
                className={INPUT_CLS}
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <div>
              <FormLabel>End time</FormLabel>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                aria-label="Shift end time"
                className={INPUT_CLS}
                style={{ colorScheme: 'dark' }}
              />
            </div>
          </div>

          {/* Duration badge */}
          <div className="flex items-center gap-2">
            <Clock size={13} aria-hidden className="text-[#555]" />
            <span className="text-[#666] text-[13px]">Duration:</span>
            <span className="text-primary font-bold text-[14px]" aria-live="polite">
              {duration}
            </span>
          </div>
        </FormSection>

        {/* Repeat */}
        <FormSection icon={<Repeat2 size={13} aria-hidden className="text-primary" />} title="Repeat">
          <div
            className="flex items-center rounded-[10px] overflow-hidden border border-[#252525]"
            role="radiogroup"
            aria-label="Repeat frequency"
          >
            {REPEAT_OPTIONS.map((opt, idx) => (
              <button
                key={opt.key}
                type="button"
                role="radio"
                aria-checked={repeat === opt.key}
                onClick={() => setRepeat(opt.key)}
                className={`
                  flex-1 h-[40px] text-[13px] font-semibold transition-all duration-150
                  ${idx > 0 ? 'border-l border-[#252525]' : ''}
                  ${repeat === opt.key
                    ? 'bg-primary text-black'
                    : 'bg-[#141414] text-[#666] hover:text-white'}
                `}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </FormSection>

        {/* Workers per role */}
        <FormSection icon={<Plus size={13} aria-hidden className="text-primary" />} title="Workers Per Role">
          {initial.jobTypes.length === 0 ? (
            <p className="text-[#444] text-[13px]">No job types selected — go back to Step 1.</p>
          ) : (
            <div className="flex flex-col divide-y divide-[#141414]" role="group" aria-label="Worker counts per role">
              {initial.jobTypes.map((jt) => (
                <WorkerStepper
                  key={jt}
                  label={jt}
                  count={workerCounts[jt] ?? 1}
                  onIncrement={() => updateCount(jt, 1)}
                  onDecrement={() => updateCount(jt, -1)}
                />
              ))}
            </div>
          )}
          {initial.jobTypes.length > 0 && (
            <div className="flex items-center justify-between pt-1 border-t border-[#141414]">
              <span className="text-[#555] text-[12px] font-semibold uppercase tracking-wider">Total workers</span>
              <span className="text-primary font-bold text-[16px]">
                {Object.values(workerCounts).reduce((a, b) => a + b, 0)}
              </span>
            </div>
          )}
        </FormSection>
      </div>

      {/* Fixed CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] px-5 pb-9 pt-4 bg-gradient-to-t from-black via-black/95 to-transparent z-10">
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={handleContinue}
          aria-label="Continue to location"
          className="w-full h-[54px] rounded-[14px] bg-primary text-black font-bold text-[16px]"
        >
          Continue
        </motion.button>
      </div>
    </div>
  );
}
