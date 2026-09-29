/**
 * Weekly availability editor shared by the worker's Profile card (saves on
 * every tap) and Edit Profile (saves with the form).
 *
 * Renders an "Available for work" master switch (`is_available`) and seven
 * tappable day chips (`availability`: { mon…sun: boolean }) with a one-line
 * summary. Controlled: the parent owns both values and decides when to save.
 */
import { Check } from 'lucide-react';

export type WeekAvailability = Record<string, boolean>;

export const DAYS: { key: string; short: string; label: string }[] = [
  { key: 'mon', short: 'M', label: 'Monday' },
  { key: 'tue', short: 'T', label: 'Tuesday' },
  { key: 'wed', short: 'W', label: 'Wednesday' },
  { key: 'thu', short: 'T', label: 'Thursday' },
  { key: 'fri', short: 'F', label: 'Friday' },
  { key: 'sat', short: 'S', label: 'Saturday' },
  { key: 'sun', short: 'S', label: 'Sunday' },
];

/** A full week with every day off, merged with whatever the row holds. */
export function normalizeAvailability(raw: unknown): WeekAvailability {
  const base = Object.fromEntries(DAYS.map((d) => [d.key, false])) as WeekAvailability;
  if (raw && typeof raw === 'object') {
    for (const d of DAYS) base[d.key] = (raw as Record<string, unknown>)[d.key] === true;
  }
  return base;
}

/** "Available Fri, Sat, Sun", "Available every day" or "No days selected yet". */
export function summarizeAvailability(availability: WeekAvailability, isAvailable: boolean): string {
  if (!isAvailable) return 'Paused — you will not get new offers';
  const on = DAYS.filter((d) => availability[d.key]);
  if (on.length === 0) return 'No days selected yet';
  if (on.length === DAYS.length) return 'Available every day';
  return `Available ${on.map((d) => d.label.slice(0, 3)).join(', ')}`;
}

export function AvailabilityEditor({
  availability, isAvailable, onChange, disabled = false, busy = false,
}: {
  availability: WeekAvailability;
  isAvailable: boolean;
  onChange: (next: { availability: WeekAvailability; is_available: boolean }) => void;
  disabled?: boolean;
  /** A save is in flight — keeps taps enabled but shows the state. */
  busy?: boolean;
}) {
  const week = normalizeAvailability(availability);

  function toggleDay(key: string) {
    onChange({ availability: { ...week, [key]: !week[key] }, is_available: isAvailable });
  }

  return (
    <div className="flex flex-col gap-3" aria-busy={busy} data-testid="availability-editor">
      {/* Master switch */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[#111827] font-semibold text-[14px]">Available for work</p>
          <p className="text-[#6B7280] text-[12px] mt-0.5">Turn off to pause new shift offers and matches.</p>
        </div>
        <button type="button" role="switch" aria-checked={isAvailable} aria-label="Available for work"
          disabled={disabled}
          onClick={() => onChange({ availability: week, is_available: !isAvailable })}
          className="relative w-[52px] h-[30px] -my-[7px] rounded-full flex-shrink-0 transition-colors disabled:opacity-50 before:absolute before:-inset-[7px] before:content-['']"
          style={{ background: isAvailable ? '#10B981' : '#D1D5DB' }}>
          <span aria-hidden className={`absolute top-[3px] w-6 h-6 rounded-full bg-white shadow transition-all ${isAvailable ? 'left-[25px]' : 'left-[3px]'}`} />
        </button>
      </div>

      {/* Day chips */}
      <div className={`grid grid-cols-7 gap-1 ${isAvailable ? '' : 'opacity-50'}`} role="group" aria-label="Days you can work">
        {DAYS.map(({ key, short, label }) => {
          const on = week[key];
          return (
            <button key={key} type="button" aria-pressed={on} aria-label={label} disabled={disabled || !isAvailable}
              onClick={() => toggleDay(key)}
              data-testid={`day-chip-${key}`}
              className={`h-11 rounded-[10px] border text-[14px] font-bold flex items-center justify-center transition-colors disabled:cursor-not-allowed ${
                on ? 'bg-[#0A1628] border-[#0A1628] text-white' : 'bg-white border-[#DBDBDB] text-[#111827]'
              }`}>
              {on ? <span className="flex items-center gap-0.5">{short}<Check size={11} aria-hidden strokeWidth={3} /></span> : short}
            </button>
          );
        })}
      </div>

      <p className="text-[#6B7280] text-[12px]" data-testid="availability-summary">
        {summarizeAvailability(week, isAvailable)}
      </p>
    </div>
  );
}
