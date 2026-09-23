/**
 * Day-of status pills for a booked worker: "On my way" and "Running late".
 * Shown on the shift page and the Home "Upcoming" row when the shift is
 * within 12 hours or in progress. Tapping the selected pill again is a no-op.
 */
import { Navigation, AlarmClock } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useArrivalStatus, type ArrivalStatus } from '@/hooks/useArrivalStatus';

const PILLS: { value: ArrivalStatus; label: string; icon: typeof Navigation; on: string }[] = [
  { value: 'on_my_way',    label: 'On my way',    icon: Navigation, on: 'bg-blue-50 border-blue-300 text-blue-700' },
  { value: 'running_late', label: 'Running late', icon: AlarmClock, on: 'bg-amber-50 border-amber-300 text-amber-700' },
];

export function ArrivalPills({ applicationId, status, statusAt, compact = false, className = '' }: {
  applicationId: string;
  status: ArrivalStatus | null;
  statusAt?: string | null;
  /** Tighter pills for list rows. */
  compact?: boolean;
  className?: string;
}) {
  const { showToast } = useToast();
  const { setArrival, busy } = useArrivalStatus();

  async function choose(next: ArrivalStatus) {
    if (next === status || busy) return;
    const err = await setArrival(applicationId, next, { status, at: statusAt ?? null });
    if (err) showToast(err, 'error');
    else showToast(next === 'on_my_way' ? 'Told the poster you’re on your way.' : 'Told the poster you’re running late.');
  }

  const h = compact ? 'h-8 text-[12px] px-3' : 'h-10 text-[13px] px-4';
  return (
    <div className={`flex items-center gap-2 ${className}`} role="group" aria-label="Day-of status">
      {status === 'arrived' && (
        <span className={`inline-flex items-center rounded-full border bg-emerald-50 border-emerald-300 text-emerald-700 font-bold ${h}`}>
          Arrived
        </span>
      )}
      {PILLS.map((p) => {
        const selected = status === p.value;
        const Icon = p.icon;
        return (
          <button key={p.value} type="button" aria-pressed={selected} disabled={busy}
            onClick={(e) => { e.stopPropagation(); void choose(p.value); }}
            className={`inline-flex items-center gap-1.5 rounded-full border font-bold transition-colors disabled:opacity-60 ${h} ${
              selected ? p.on : 'bg-white border-[#E5E7EB] text-[#374151] active:bg-[#FAFAFA]'}`}>
            <Icon size={compact ? 12 : 14} aria-hidden />
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
