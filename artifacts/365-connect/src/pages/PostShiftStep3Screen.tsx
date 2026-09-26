/**
 * Step 5 of 7 — Schedule & Headcount
 * Date, start time, end time, duration preview, and spots_available stepper.
 */
import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { ChevronLeft, Calendar, Clock, Users, Minus, Plus, Repeat2 } from 'lucide-react';
import {
  getDraft, setDraft, getEditShiftId,
  durationLabel, durationHours, fmt12h, fmtDate,
} from '@/store/postShiftStore';
import {
  expandOccurrences, summarizeSeries, weekdayOf, addDays,
  MAX_SERIES_OCCURRENCES, WEEKDAY_LABELS, WEEKDAY_NAMES, type RepeatRule, type RepeatType,
} from '@/lib/recurrence';
import { MultiDatePicker } from '@/components/MultiDatePicker';
import { BottomTabNav } from '@/components/BottomTabNav';

const REPEAT_OPTIONS: { value: RepeatType; label: string }[] = [
  { value: 'none',   label: "Doesn't repeat" },
  { value: 'daily',  label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Custom dates' },
];

// ─── Wizard primitives ────────────────────────────────────────────────────────
function StepBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5" role="progressbar"
      aria-valuenow={current} aria-valuemin={1} aria-valuemax={total}
      aria-valuetext={`Step ${current} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`h-[3px] rounded-full flex-1 transition-all duration-300 ${
          i < current ? 'bg-[#0A1628]' : 'bg-[#E5E7EB]'
        }`} />
      ))}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[#6B7280] text-[11px] font-semibold uppercase tracking-wider mb-1.5">
      {children}
    </p>
  );
}

const INPUT_CLS =
  'w-full bg-white border border-[#E5E7EB] rounded-[10px] px-3 h-[46px] ' +
  'text-[#111827] text-[14px] font-medium placeholder:text-[#9CA3AF] ' +
  'focus:outline-none focus:border-[#0A1628] transition-colors';

// ─── Spots stepper ────────────────────────────────────────────────────────────
function SpotsStepper({
  count, onIncrement, onDecrement,
}: { count: number; onIncrement: () => void; onDecrement: () => void }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <p className="text-[#111827] text-[14px] font-semibold">
          {count} {count === 1 ? 'spot' : 'spots'}
        </p>
        <p className="text-[#9CA3AF] text-[11px]">workers needed</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Decrease spots"
          onClick={onDecrement}
          disabled={count <= 1}
          className="w-9 h-9 rounded-[10px] bg-white border border-[#E5E7EB] flex items-center justify-center
            disabled:opacity-40 active:border-[#0A1628] transition-colors"
        >
          <Minus size={14} aria-hidden className="text-[#6B7280]" />
        </button>
        <span
          className="text-[#0A1628] font-bold text-[20px] w-8 text-center tabular-nums"
          aria-live="polite"
        >
          {count}
        </span>
        <button
          type="button"
          aria-label="Increase spots"
          onClick={onIncrement}
          disabled={count >= 50}
          className="w-9 h-9 rounded-[10px] bg-white border border-[#E5E7EB] flex items-center justify-center
            disabled:opacity-40 active:border-[#0A1628] transition-colors"
        >
          <Plus size={14} aria-hidden className="text-[#0A1628]" />
        </button>
      </div>
    </div>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export function PostShiftStep3Screen() {
  const [, navigate]  = useLocation();
  const initial       = getDraft();

  const today = new Date().toISOString().split('T')[0];

  const [date,      setDate]      = useState(initial.date || today);
  const [startTime, setStartTime] = useState(initial.start_time);
  const [endTime,   setEndTime]   = useState(initial.end_time);
  const [spots,     setSpots]     = useState(initial.spots_available);
  const [repeat,    setRepeat]    = useState<RepeatRule>(initial.repeat);
  const [errors,    setErrors]    = useState<Record<string, string>>({});
  // An existing shift is edited on its own; recurrence only applies to new posts.
  const isEditing = !!getEditShiftId();

  const durLabel = durationLabel(startTime, endTime);
  const durHrs   = durationHours(startTime, endTime);

  const occurrences = isEditing ? [date] : expandOccurrences(date, repeat);
  const isSeries = !isEditing && repeat.type !== 'none';

  function patchRepeat(p: Partial<RepeatRule>) {
    setRepeat((r) => ({ ...r, ...p }));
    setErrors((prev) => ({ ...prev, repeat: '' }));
  }

  function chooseRepeat(type: RepeatType) {
    patchRepeat({
      type,
      // Weekly starts from the chosen date's weekday.
      weekdays: type === 'weekly' && !repeat.weekdays.length && date ? [weekdayOf(date)] : repeat.weekdays,
      end_date: repeat.end_date || (date ? addDays(date, type === 'daily' ? 6 : 28) : ''),
    });
  }

  function toggleWeekday(d: number) {
    const has = repeat.weekdays.includes(d);
    const next = has ? repeat.weekdays.filter((x) => x !== d) : [...repeat.weekdays, d].sort();
    patchRepeat({ weekdays: next });
  }

  function toggleCustomDate(d: string) {
    const has = repeat.custom_dates.includes(d);
    patchRepeat({ custom_dates: has ? repeat.custom_dates.filter((x) => x !== d) : [...repeat.custom_dates, d].sort() });
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!date)      e.date      = 'Please select a date';
    if (!startTime) e.startTime = 'Please set a start time';
    if (!endTime)   e.endTime   = 'Please set an end time';
    if (durHrs < 0.5) e.endTime = 'Shift must be at least 30 minutes';
    if (durHrs > 24)  e.endTime = 'Shift cannot exceed 24 hours';
    if (isSeries) {
      if (repeat.type === 'weekly' && !repeat.weekdays.length) e.repeat = 'Pick at least one weekday';
      if (repeat.ends === 'on' && repeat.type !== 'custom' && (!repeat.end_date || repeat.end_date < date)) e.repeat = 'Pick an end date after the shift date';
      if (!occurrences.length) e.repeat = 'This repeat rule creates no shifts';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleContinue() {
    if (!validate()) return;
    setDraft({
      date, start_time: startTime, end_time: endTime, spots_available: spots,
      // Custom dates only make sense from the chosen shift date onward.
      repeat: isEditing ? { ...repeat, type: 'none' } : { ...repeat, custom_dates: repeat.custom_dates.filter((d) => d > date) },
    });
    navigate('/post-shift/step4');
  }

  return (
    <div className="min-h-[100dvh] bg-[#F7F8FA] flex flex-col pb-[72px]">

      {/* Header */}
      <div className="bg-white px-5 pt-5 pb-4 border-b border-[#E5E7EB] sticky top-0 z-30">
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button" aria-label="Back to location"
            onClick={() => navigate('/post-shift/step2')}
            className="w-9 h-9 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft size={18} aria-hidden className="text-[#111827]" />
          </button>
          <div className="flex-1"><StepBar current={5} total={7} /></div>
          <span className="text-[#6B7280] text-[12px] font-semibold flex-shrink-0">5 of 7</span>
        </div>
        <h1 className="text-[#111827] font-bold text-[22px] tracking-tight">When & how many?</h1>
        <p className="text-[#6B7280] text-[13px] mt-0.5">Set the date, times, and headcount</p>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-36">

        {/* Date */}
        <div className="bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-[7px] bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center">
              <Calendar size={13} aria-hidden className="text-[#0A1628]" />
            </div>
            <h2 className="text-[#111827] font-bold text-[15px]">Date</h2>
          </div>
          <FieldLabel>
            Shift date <span className="normal-case text-[#EF4444]">*</span>
          </FieldLabel>
          <input
            type="date"
            value={date}
            min={today}
            onChange={(e) => { setDate(e.target.value); setErrors((p) => ({ ...p, date: '' })); }}
            aria-label="Shift date"
            aria-invalid={!!errors.date}
            className={INPUT_CLS + (errors.date ? ' border-[#EF4444]' : '')}
          />
          {errors.date && <p className="text-[#EF4444] text-[11px] mt-1.5">{errors.date}</p>}
          {date && (
            <p className="text-[#6B7280] text-[12px] mt-1.5 font-medium">{fmtDate(date)}</p>
          )}
        </div>

        {/* Times */}
        <div className="bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-[7px] bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center">
              <Clock size={13} aria-hidden className="text-[#0A1628]" />
            </div>
            <h2 className="text-[#111827] font-bold text-[15px]">Times</h2>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <FieldLabel>
                Start time <span className="normal-case text-[#EF4444]">*</span>
              </FieldLabel>
              <input
                type="time"
                value={startTime}
                onChange={(e) => { setStartTime(e.target.value); setErrors((p) => ({ ...p, startTime: '' })); }}
                aria-label="Start time"
                aria-invalid={!!errors.startTime}
                className={INPUT_CLS + (errors.startTime ? ' border-[#EF4444]' : '')}
              />
              {errors.startTime && <p className="text-[#EF4444] text-[11px] mt-1">{errors.startTime}</p>}
            </div>
            <div>
              <FieldLabel>
                End time <span className="normal-case text-[#EF4444]">*</span>
              </FieldLabel>
              <input
                type="time"
                value={endTime}
                onChange={(e) => { setEndTime(e.target.value); setErrors((p) => ({ ...p, endTime: '' })); }}
                aria-label="End time"
                aria-invalid={!!errors.endTime}
                className={INPUT_CLS + (errors.endTime ? ' border-[#EF4444]' : '')}
              />
              {errors.endTime && <p className="text-[#EF4444] text-[11px] mt-1">{errors.endTime}</p>}
            </div>
          </div>

          {/* Duration pill */}
          {durHrs > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-between bg-[#F0F4FF] border border-[#D1D9F0] rounded-[10px] px-3 py-2"
            >
              <span className="text-[#0A1628] text-[13px] font-medium">
                {fmt12h(startTime)} → {fmt12h(endTime)}
              </span>
              <span className="text-[#0A1628] font-bold text-[14px]">{durLabel}</span>
            </motion.div>
          )}
        </div>

        {/* Repeat — new posts only; an edit only ever touches its own shift */}
        {!isEditing && (
          <div className="bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-[7px] bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center">
                <Repeat2 size={13} aria-hidden className="text-[#0A1628]" />
              </div>
              <h2 className="text-[#111827] font-bold text-[15px]">Repeat</h2>
            </div>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Repeat">
              {REPEAT_OPTIONS.map((o) => {
                const on = repeat.type === o.value;
                return (
                  <button key={o.value} type="button" role="radio" aria-checked={on}
                    onClick={() => chooseRepeat(o.value)}
                    className={`h-9 px-3.5 rounded-full border text-[13px] font-semibold transition-colors ${
                      on ? 'bg-[#0A1628] border-[#0A1628] text-white' : 'bg-white border-[#E5E7EB] text-[#111827] active:bg-[#F3F4F6]'}`}>
                    {o.label}
                  </button>
                );
              })}
            </div>

            {repeat.type === 'weekly' && (
              <div className="mt-4">
                <FieldLabel>On these days</FieldLabel>
                <div className="flex gap-1.5" role="group" aria-label="Weekdays">
                  {WEEKDAY_LABELS.map((l, d) => {
                    const on = repeat.weekdays.includes(d);
                    return (
                      <button key={d} type="button" aria-label={WEEKDAY_NAMES[d]} aria-pressed={on}
                        onClick={() => toggleWeekday(d)}
                        className={`flex-1 h-9 rounded-[10px] border text-[13px] font-bold transition-colors ${
                          on ? 'bg-[#0A1628] border-[#0A1628] text-white' : 'bg-white border-[#E5E7EB] text-[#6B7280]'}`}>
                        {l}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {(repeat.type === 'daily' || repeat.type === 'weekly') && (
              <div className="mt-4">
                <FieldLabel>Ends</FieldLabel>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-3">
                    <input type="radio" name="ends" checked={repeat.ends === 'after'}
                      onChange={() => patchRepeat({ ends: 'after' })} aria-label="Ends after a number of shifts"
                      className="accent-[#0A1628] w-4 h-4" />
                    <span className="text-[#111827] text-[14px] font-medium flex-1">After</span>
                    <div className="flex items-center gap-2">
                      <button type="button" aria-label="Fewer shifts" disabled={repeat.count <= 1}
                        onClick={() => patchRepeat({ ends: 'after', count: Math.max(1, repeat.count - 1) })}
                        className="w-8 h-8 rounded-[8px] bg-white border border-[#E5E7EB] flex items-center justify-center disabled:opacity-40">
                        <Minus size={13} aria-hidden className="text-[#6B7280]" />
                      </button>
                      <span className="text-[#0A1628] font-bold text-[15px] w-6 text-center tabular-nums">{repeat.count}</span>
                      <button type="button" aria-label="More shifts" disabled={repeat.count >= MAX_SERIES_OCCURRENCES}
                        onClick={() => patchRepeat({ ends: 'after', count: Math.min(MAX_SERIES_OCCURRENCES, repeat.count + 1) })}
                        className="w-8 h-8 rounded-[8px] bg-white border border-[#E5E7EB] flex items-center justify-center disabled:opacity-40">
                        <Plus size={13} aria-hidden className="text-[#0A1628]" />
                      </button>
                      <span className="text-[#6B7280] text-[13px] w-12">shifts</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="radio" name="ends" checked={repeat.ends === 'on'}
                      onChange={() => patchRepeat({ ends: 'on' })} aria-label="Ends on a date"
                      className="accent-[#0A1628] w-4 h-4" />
                    <span className="text-[#111827] text-[14px] font-medium">On</span>
                    <input type="date" value={repeat.end_date} min={date || today}
                      onChange={(e) => patchRepeat({ ends: 'on', end_date: e.target.value })}
                      aria-label="Series end date"
                      className={INPUT_CLS + ' flex-1 h-[40px]'} />
                  </label>
                </div>
              </div>
            )}

            {repeat.type === 'custom' && (
              <div className="mt-4">
                <FieldLabel>Tap the dates to add</FieldLabel>
                <MultiDatePicker
                  selected={repeat.custom_dates}
                  onToggle={toggleCustomDate}
                  min={date || today}
                  locked={date ? [date] : []}
                  max={MAX_SERIES_OCCURRENCES - 1}
                />
              </div>
            )}

            {repeat.type !== 'none' && (
              <p className="mt-3 text-[#0A1628] text-[13px] font-semibold bg-[#F0F4FF] border border-[#D1D9F0] rounded-[10px] px-3 py-2"
                aria-live="polite" data-testid="series-summary">
                {summarizeSeries(occurrences)}
                {occurrences.length >= MAX_SERIES_OCCURRENCES && (
                  <span className="block text-[#6B7280] text-[11px] font-medium mt-0.5">A series can have up to {MAX_SERIES_OCCURRENCES} shifts.</span>
                )}
              </p>
            )}
            {errors.repeat && <p className="text-[#EF4444] text-[11px] mt-1.5">{errors.repeat}</p>}
          </div>
        )}

        {/* Headcount */}
        <div className="bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-[7px] bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center">
              <Users size={13} aria-hidden className="text-[#0A1628]" />
            </div>
            <h2 className="text-[#111827] font-bold text-[15px]">Spots Available</h2>
            {isSeries && <span className="text-[#9CA3AF] text-[11px] font-medium">per shift</span>}
          </div>
          <SpotsStepper
            count={spots}
            onIncrement={() => setSpots((n) => Math.min(50, n + 1))}
            onDecrement={() => setSpots((n) => Math.max(1, n - 1))}
          />
        </div>

      </div>

      {/* Fixed CTA */}
      <div className="fixed bottom-[56px] left-1/2 -translate-x-1/2 w-full max-w-app px-5 pb-4 pt-4
        bg-gradient-to-t from-[#F7F8FA] via-[#F7F8FA]/95 to-transparent z-20">
        <motion.button
          type="button" whileTap={{ scale: 0.97 }}
          onClick={handleContinue}
          aria-label="Continue to pay and details"
          className="w-full h-[52px] rounded-[12px] bg-[#0A1628] text-white font-bold text-[16px]"
        >
          Continue
        </motion.button>
      </div>

      <BottomTabNav />
    </div>
  );
}
