/**
 * Copy helpers shared by routes and cron for notification text.
 */

type DayLabelShift = { title?: string | null; start_time?: string | null; timezone?: string | null };

/**
 * "Saturday's shift" — the shift's weekday in its own time zone, for day-of
 * copy. With `withTitle` (default) the quoted title follows: Saturday's shift
 * ("Corbin gala"). Falls back to the quoted title, then to "the shift".
 */
export function shiftDayLabel(shift: DayLabelShift, opts: { withTitle?: boolean } = {}): string {
  const withTitle = opts.withTitle !== false;
  const ms = shift.start_time ? Date.parse(shift.start_time) : NaN;
  if (Number.isFinite(ms)) {
    try {
      const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: shift.timezone || undefined }).format(new Date(ms));
      return `${weekday}'s shift${withTitle && shift.title ? ` ("${shift.title}")` : ''}`;
    } catch { /* bad time zone: fall through */ }
  }
  return shift.title ? `"${shift.title}"` : 'the shift';
}

/** 5.2 → "5h 12m"; 8 → "8h"; 0.5 → "30m". */
export function formatHoursMinutes(hours: number): string {
  const total = Math.max(0, Math.round((Number(hours) || 0) * 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** 166.4 → "$166.40". */
export function formatUsd(amount: number): string {
  return (Number(amount) || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
