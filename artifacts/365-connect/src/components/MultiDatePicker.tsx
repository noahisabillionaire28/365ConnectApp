/**
 * A small month grid where tapping a day toggles it. Used by the wizard's
 * "Custom dates" repeat option. Dates are YYYY-MM-DD calendar days.
 */
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { WEEKDAY_LABELS } from '@/lib/recurrence';

function pad(n: number) { return String(n).padStart(2, '0'); }

export function MultiDatePicker({
  selected, onToggle, min, locked = [], max, disabled = false,
}: {
  /** Selected dates (YYYY-MM-DD). */
  selected: string[];
  onToggle: (date: string) => void;
  /** Earliest selectable date (YYYY-MM-DD). */
  min: string;
  /** Dates shown as selected that cannot be unselected (the shift date). */
  locked?: string[];
  /** Once this many dates are selected, unselected days are disabled. */
  max?: number;
  disabled?: boolean;
}) {
  const anchor = locked[0] || selected[0] || min;
  const [y0, m0] = anchor.split('-').map(Number);
  const [view, setView] = useState({ y: y0, m: m0 }); // m is 1-based

  const first = new Date(Date.UTC(view.y, view.m - 1, 1));
  const daysInMonth = new Date(Date.UTC(view.y, view.m, 0)).getUTCDate();
  const leading = first.getUTCDay();
  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first);
  const full = max !== undefined && selected.length >= max;

  const prev = () => setView((v) => (v.m === 1 ? { y: v.y - 1, m: 12 } : { y: v.y, m: v.m - 1 }));
  const next = () => setView((v) => (v.m === 12 ? { y: v.y + 1, m: 1 } : { y: v.y, m: v.m + 1 }));

  const cells: (number | null)[] = [...Array<null>(leading).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div className="select-none" role="group" aria-label="Pick dates">
      <div className="flex items-center justify-between mb-2">
        <button type="button" aria-label="Previous month" onClick={prev}
          className="w-8 h-8 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center">
          <ChevronLeft size={16} aria-hidden className="text-[#111827]" />
        </button>
        <p className="text-[#111827] text-[14px] font-bold">{monthLabel}</p>
        <button type="button" aria-label="Next month" onClick={next}
          className="w-8 h-8 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center">
          <ChevronRight size={16} aria-hidden className="text-[#111827]" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_LABELS.map((d, i) => (
          <p key={i} className="text-center text-[#9CA3AF] text-[10px] font-semibold uppercase">{d}</p>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`b${i}`} />;
          const ymd = `${view.y}-${pad(view.m)}-${pad(day)}`;
          const isLocked = locked.includes(ymd);
          const isOn = isLocked || selected.includes(ymd);
          const off = disabled || ymd < min || (!isOn && full);
          return (
            <button key={ymd} type="button"
              aria-label={ymd} aria-pressed={isOn}
              disabled={off || isLocked}
              onClick={() => onToggle(ymd)}
              className={`h-9 rounded-[10px] text-[13px] font-semibold transition-colors ${
                isOn
                  ? (isLocked ? 'bg-[#0A1628] text-white' : 'bg-[#0A1628]/90 text-white')
                  : off
                  ? 'text-[#D1D5DB]'
                  : 'text-[#111827] bg-white border border-[#E5E7EB] active:bg-[#F3F4F6]'
              }`}>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
