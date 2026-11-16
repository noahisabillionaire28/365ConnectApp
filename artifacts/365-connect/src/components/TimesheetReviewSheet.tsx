/**
 * The poster's timesheet review: clocked times, the unpaid break, time added
 * or removed, and the regular / overtime split and pay (same rule as the
 * server). Approving can also set a clock-out for a worker who forgot.
 * Used on the Crew screen and the live Timesheets board.
 */
import { useState } from 'react';
import { personName } from '@/lib/person';
import { formatTime } from '@/lib/supabase';
import { utcToZonedParts, zonedTimeToUtc, zoneAbbrev, DEFAULT_SHIFT_TZ } from '@/lib/timezone';
import type { AcceptedWorker } from '@/hooks/useAcceptedWorkers';

/** Hourly pay periods; anything else is a flat total. Mirrors the server's computePay. */
function isHourly(payPeriod: string | null | undefined): boolean {
  const p = (payPeriod ?? 'hr').trim().toLowerCase();
  return p === 'hr' || p === 'hour' || p === 'hourly' || p === 'h';
}

export function TimesheetReviewSheet({ w, payRate, payPeriod, timezone, shiftEndISO, busy, onApprove, onClose }: {
  w: AcceptedWorker; payRate: number; payPeriod: string | null; timezone: string | null;
  shiftEndISO: string | null; busy: boolean;
  onApprove: (breakMinutes: number, clockOutISO?: string, totalHours?: number) => void; onClose: () => void;
}) {
  const disputed = w.workerAck === 'disputed';
  const tz = timezone || DEFAULT_SHIFT_TZ;
  const hourly = isHourly(payPeriod);
  // Forgot to clock out: the manager sets the clock-out (defaults to the
  // scheduled end) and the server records it before approving. The picker
  // works in the venue's wall clock, not the manager's device zone.
  const needsClockOut = !!w.clock_in && !w.clock_out;
  const toVenueInput = (iso: string) => {
    const p = utcToZonedParts(iso, tz);
    return p.date && p.time ? `${p.date}T${p.time}` : '';
  };
  const fromVenueInput = (local: string): string | null => {
    const [date, time] = local.split('T');
    return date && time ? zonedTimeToUtc(date, time, tz) : null;
  };
  const [clockOutLocal, setClockOutLocal] = useState<string>(() =>
    needsClockOut ? toVenueInput(shiftEndISO && Date.parse(shiftEndISO) > Date.parse(w.clock_in!) ? shiftEndISO : new Date().toISOString()) : '');
  const clockOutISO = needsClockOut && clockOutLocal ? fromVenueInput(clockOutLocal) : (w.clock_out ?? null);
  const grossH = w.clock_in && clockOutISO
    ? Math.max(0, (Date.parse(clockOutISO) - Date.parse(w.clock_in)) / 3_600_000) : 0;
  const [breakMin, setBreakMin] = useState<number>(Math.round(w.breakMinutes ?? 0));
  // Time the manager adds or removes on top of the clock (e.g. a worker who
  // stayed for load-out after clocking out). Sent as the billable total.
  const [adjMin, setAdjMin] = useState<number>(0);
  const [adjText, setAdjText] = useState<string>('0');
  const billable = Math.max(0, grossH - breakMin / 60 + adjMin / 60);
  // Same rule as the server: hourly pays regular up to 8h then 1.5× beyond;
  // a day / event rate is a flat amount whatever the hours.
  const regular = hourly ? Math.min(billable, 8) : billable;
  const overtime = hourly ? Math.max(0, billable - 8) : 0;
  const pay = hourly ? regular * payRate + overtime * payRate * 1.5 : (payRate > 0 ? payRate : 0);
  const fmt = (h: number) => `${h.toFixed(2)}h`;
  const zoneLabel = w.clock_in ? zoneAbbrev(w.clock_in, tz) : '';

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-app max-h-[85dvh] overflow-y-auto bg-white rounded-t-[20px] px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+32px)]">
        <div className="w-10 h-1 rounded-full bg-[#E5E7EB] mx-auto mb-4" />
        <p className="text-[#111827] font-bold text-[17px] mb-1">Review timesheet</p>
        <p className="text-[#6B7280] text-[13px] mb-4">
          {personName(w, 'Worker')} · {payRate ? (hourly ? `$${payRate}/hr` : `$${payRate} flat per ${payPeriod}`) : ''}
        </p>

        {disputed && (
          <div className="rounded-[12px] bg-amber-50 border border-amber-200 px-4 py-3 mb-4" role="note">
            <p className="text-amber-800 text-[13px] font-semibold">{personName(w, 'The worker')} disputed these hours</p>
            {w.dispute_note
              ? <p className="text-amber-900 text-[14px] leading-relaxed mt-1">“{w.dispute_note}”</p>
              : <p className="text-amber-800 text-[13px] mt-1">They didn't leave a note. Message them if you're not sure what to change.</p>}
            <p className="text-amber-800 text-[12px] mt-2">Adjust the break or add time below, then re-approve. They'll be asked to confirm again.</p>
          </div>
        )}

        <div className="bg-[#FAFAFA] border border-[#E5E7EB] rounded-[12px] px-4 py-3 mb-4 flex flex-col gap-2.5">
          {w.clock_in && (
            <div className="flex justify-between text-[14px]">
              <span className="text-[#6B7280]">Clocked in – out</span>
              <span className="text-[#111827] font-semibold">
                {formatTime(w.clock_in, timezone)} – {clockOutISO ? formatTime(clockOutISO, timezone) : '…'}{zoneLabel ? ` ${zoneLabel}` : ''}
              </span>
            </div>
          )}
          {needsClockOut && (
            <div className="flex flex-col gap-1 pb-1 border-b border-[#E5E7EB]">
              <p className="text-[12px] text-amber-700 font-semibold">
                This worker never clocked out. Set when they finished{zoneLabel ? ` (${zoneLabel}, venue time)` : ''}:
              </p>
              <input type="datetime-local" value={clockOutLocal} min={w.clock_in ? toVenueInput(w.clock_in) : undefined}
                onChange={(e) => setClockOutLocal(e.target.value)} aria-label="Clock-out time"
                className="h-10 rounded-[8px] border border-[#E5E7EB] bg-white px-2.5 text-[14px] text-[#111827] outline-none focus:border-[#0A1628]" />
            </div>
          )}
          <div className="flex justify-between text-[14px]"><span className="text-[#6B7280]">Clocked time</span><span className="text-[#111827] font-semibold">{fmt(grossH)}</span></div>
          <div className="flex items-center justify-between">
            <span className="text-[#6B7280] text-[14px]">Unpaid break (min)</span>
            <input type="number" min={0} value={breakMin}
              onChange={(e) => setBreakMin(Math.max(0, parseInt(e.target.value || '0') || 0))}
              className="w-20 h-9 rounded-[8px] border border-[#E5E7EB] bg-white px-2.5 text-[14px] text-[#111827] text-right outline-none focus:border-[#0A1628]" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="adj-min" className="text-[#6B7280] text-[14px] leading-tight">Add or remove time (min)<span className="block text-[11px]">e.g. 30, or -15</span></label>
            <input id="adj-min" type="text" inputMode="numeric" value={adjText}
              onChange={(e) => {
                const t = e.target.value.replace(/[^0-9-]/g, '').replace(/(?!^)-/g, '');
                setAdjText(t);
                const n = parseInt(t, 10);
                setAdjMin(Number.isFinite(n) ? Math.max(-720, Math.min(720, n)) : 0);
              }}
              className="w-20 h-9 rounded-[8px] border border-[#E5E7EB] bg-white px-2.5 text-[14px] text-[#111827] text-right outline-none focus:border-[#0A1628]" />
          </div>
          {billable > 6 && breakMin < 30 && (
            <p className="text-[11px] text-amber-600">Tip: shifts over 6h usually include a 30-min unpaid break.</p>
          )}
          <div className="border-t border-[#E5E7EB] my-0.5" />
          <div className="flex justify-between text-[14px]"><span className="text-[#6B7280]">{hourly ? 'Regular hours' : 'Billable hours'}</span><span className="text-[#111827] font-semibold">{fmt(regular)}</span></div>
          {overtime > 0 && (
            <div className="flex justify-between text-[14px]"><span className="text-amber-600">Overtime (1.5×)</span><span className="text-amber-600 font-semibold">{fmt(overtime)}</span></div>
          )}
          {!hourly && (
            <p className="text-[11px] text-[#6B7280]">Flat {payPeriod} rate — the hours are recorded but do not change the pay.</p>
          )}
          <div className="flex justify-between text-[15px] pt-1"><span className="text-[#111827] font-bold">Approved pay</span><span className="text-[#111827] font-bold">${pay.toFixed(2)}</span></div>
        </div>

        <button type="button" disabled={busy || (needsClockOut && grossH <= 0)}
          onClick={() => onApprove(breakMin, needsClockOut && clockOutISO ? clockOutISO : undefined,
            adjMin !== 0 ? Math.round(billable * 100) / 100 : undefined)}
          className="w-full h-[50px] rounded-[10px] bg-[#0A1628] text-white font-bold text-[15px] disabled:opacity-60">
          {busy ? 'Approving…' : disputed ? 'Re-approve timesheet' : 'Approve timesheet'}
        </button>
        <button type="button" onClick={onClose} className="w-full h-11 mt-1 text-[#6B7280] font-semibold text-[14px]">
          Cancel
        </button>
      </div>
    </div>
  );
}

