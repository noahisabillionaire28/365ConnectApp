/**
 * "This week · $412 · 3 shifts" — a slim strip at the top of the worker's
 * schedule summing the timesheets for shifts that started since Monday
 * (device-local). The sub-line splits it by where the money is:
 * "$X paid · $Y approved · $Z pending" (zero parts hidden). Taps through to
 * Earnings. Hidden until the worker has worked at least one shift.
 */
import { useLocation } from 'wouter';
import { ChevronRight, Wallet } from 'lucide-react';
import { entryPay, useMyTimeEntries, type MyTimeEntry } from '@/hooks/usePayments';

/** Monday 00:00 in the device's zone. */
export function startOfWeek(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - ((dow + 6) % 7));
  return d;
}

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: n % 1 ? 2 : 0 });

export function weekSummary(entries: MyTimeEntry[], now = new Date()) {
  const from = startOfWeek(now).getTime();
  const to = now.getTime();
  const inWeek = entries.filter((e) => {
    if (!e.clock_out) return false;
    const ref = e.shift_start_time ?? e.clock_in;
    const ms = ref ? Date.parse(ref) : NaN;
    return Number.isFinite(ms) && ms >= from && ms <= to;
  });
  const sum = (rows: MyTimeEntry[]) => rows.reduce((acc, e) => acc + entryPay(e), 0);
  const paid = sum(inWeek.filter((e) => e.payTimeline.stage === 'paid'));
  const approved = sum(inWeek.filter((e) => e.payTimeline.stage === 'approved'));
  const pending = sum(inWeek.filter((e) => e.payTimeline.stage === 'worked'));
  return { total: sum(inWeek), paid, approved, pending, shifts: inWeek.length };
}

/** "$120 paid · $88 approved · $40 pending" — only the non-zero parts. */
export function weekBreakdown(s: { paid: number; approved: number; pending: number; shifts: number }): string {
  const parts: string[] = [];
  if (s.paid > 0) parts.push(`${usd(s.paid)} paid`);
  if (s.approved > 0) parts.push(`${usd(s.approved)} approved`);
  if (s.pending > 0) parts.push(`${usd(s.pending)} pending`);
  if (parts.length) return parts.join(' · ');
  return s.shifts > 0 ? 'Nothing owed yet' : 'No shifts worked yet this week';
}

export function WeekEarningsCard() {
  const [, navigate] = useLocation();
  const { entries, isLoading, isError } = useMyTimeEntries();

  if (isLoading) {
    return (
      <div className="mx-4 mb-3 h-[58px] rounded-[12px] border border-[#E5E7EB] bg-white animate-pulse" aria-hidden />
    );
  }
  if (isError || entries.length === 0) return null;

  const summary = weekSummary(entries);
  const { total, shifts } = summary;
  const breakdown = weekBreakdown(summary);

  return (
    <button type="button" onClick={() => navigate('/earnings')}
      aria-label={`This week: ${usd(total)} across ${shifts} shift${shifts === 1 ? '' : 's'}. ${breakdown}. Open earnings`}
      className="mx-4 mb-3 w-[calc(100%-32px)] rounded-[12px] border border-[#E5E7EB] bg-white px-4 py-3 flex items-center gap-3 text-left active:bg-[#FAFAFA]">
      <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0">
        <Wallet size={16} aria-hidden className="text-emerald-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[#111827] font-bold text-[14px] truncate">
          This week · {usd(total)} · {shifts} shift{shifts === 1 ? '' : 's'}
        </p>
        <p className="text-[#6B7280] text-[12px] mt-0.5 truncate">{breakdown}</p>
      </div>
      <ChevronRight size={15} aria-hidden className="text-[#D1D5DB] flex-shrink-0" />
    </button>
  );
}
