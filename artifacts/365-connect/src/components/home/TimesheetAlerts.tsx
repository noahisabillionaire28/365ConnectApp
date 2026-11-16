/**
 * Poster Home: what needs the poster's attention on the clock.
 *   • a "Live now" card per shift in progress (who is working / on break / not in)
 *   • an "Approve timesheets" card per shift with timesheets waiting
 * Both open the shift's live Timesheets board. Updates every 30s while open.
 */
import { useLocation } from 'wouter';
import { ChevronRight, ClipboardCheck } from 'lucide-react';
import { usePendingApprovals, type PendingShift } from '@/hooks/useLiveTimesheets';
import { dayParts, timeRange } from '@/lib/jobFormat';

export function TimesheetAlerts() {
  const { shifts } = usePendingApprovals();
  const [, navigate] = useLocation();
  if (!shifts.length) return null;
  const live = shifts.filter((s) => s.live);
  const pending = shifts.filter((s) => !s.live && (s.to_approve > 0 || s.missing_clock_out > 0));
  const title = (s: PendingShift) => s.title || 'Your shift';
  return (
    <div className="px-4 pt-3 flex flex-col gap-2.5" data-testid="timesheet-alerts">
      {live.map((s) => {
        const notIn = Math.max(0, s.booked - s.clocked_in - s.clocked_out);
        return (
          <button key={s.shift_id} type="button" onClick={() => navigate(`/shift/${s.shift_id}/timesheets`)}
            data-testid="card-live-shift"
            className="w-full text-left rounded-[14px] bg-[#0A1628] text-white px-4 py-3.5 flex items-center gap-3 active:scale-[0.99] transition-transform">
            <span className="relative flex w-2.5 h-2.5 flex-shrink-0">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
              <span className="relative w-2.5 h-2.5 rounded-full bg-emerald-400" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-emerald-300">Live now</span>
              <span className="block font-bold text-[15px] truncate">{title(s)}</span>
              <span className="block text-white/80 text-[12px] mt-0.5">
                {s.clocked_in - s.on_break} working · {s.on_break} on break · {notIn} not in{s.clocked_out ? ` · ${s.clocked_out} out` : ''}
              </span>
              {s.to_approve > 0 && (
                <span className="inline-block mt-1.5 text-[11px] font-bold bg-white text-[#0A1628] rounded-full px-2 py-0.5">
                  {s.to_approve} to approve
                </span>
              )}
            </span>
            <ChevronRight size={18} aria-hidden className="text-white/70 flex-shrink-0" />
          </button>
        );
      })}
      {pending.map((s) => {
        const n = s.to_approve + (s.missing_clock_out > 0 && s.to_approve === 0 ? s.missing_clock_out : 0);
        const d = s.start_time ? dayParts(s.start_time, s.timezone) : null;
        return (
          <button key={s.shift_id} type="button" onClick={() => navigate(`/shift/${s.shift_id}/timesheets`)}
            data-testid="card-approve-timesheets"
            className="w-full text-left rounded-[14px] bg-amber-50 border border-amber-300 px-4 py-3.5 flex items-center gap-3 active:scale-[0.99] transition-transform">
            <span className="w-10 h-10 rounded-full bg-white border border-amber-200 flex items-center justify-center flex-shrink-0">
              <ClipboardCheck size={18} aria-hidden className="text-amber-700" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-bold text-[15px] text-[#111827]">
                {n} timesheet{n === 1 ? '' : 's'} to approve
              </span>
              <span className="block text-[#4B5563] text-[12px] truncate">
                {title(s)}{d ? ` · ${d.rel}, ${d.date}` : ''} · {timeRange(s.start_time, s.end_time, s.timezone)}
              </span>
              {(s.disputed > 0 || s.missing_clock_out > 0) && (
                <span className="block text-amber-800 text-[12px] font-semibold mt-0.5">
                  {[s.disputed ? `${s.disputed} disputed` : '', s.missing_clock_out ? `${s.missing_clock_out} never clocked out` : ''].filter(Boolean).join(' · ')}
                </span>
              )}
            </span>
            <ChevronRight size={18} aria-hidden className="text-amber-700 flex-shrink-0" />
          </button>
        );
      })}
    </div>
  );
}
