/**
 * When a booked worker may clock in: from 10 minutes before the shift's start
 * (call time) until the shift ends. Mid-shift is fine (a late arrival still
 * clocks in); after the end it is closed. The server enforces the same rule.
 */
export const CLOCK_IN_OPENS_BEFORE_MS = 10 * 60_000;

export type ClockWindow = 'before' | 'open' | 'closed';

export function clockWindow(startISO: string | null | undefined, endISO: string | null | undefined, now = Date.now()): ClockWindow {
  const start = startISO ? Date.parse(startISO) : NaN;
  const end = endISO ? Date.parse(endISO) : NaN;
  if (Number.isFinite(end) && now > end) return 'closed';
  if (Number.isFinite(start) && now < start - CLOCK_IN_OPENS_BEFORE_MS) return 'before';
  return 'open';
}
