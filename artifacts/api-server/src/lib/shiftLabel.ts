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

/** "Sat, Mar 14 · 6:00 PM EDT" — an instant rendered in the shift's own zone. */
export function formatShiftInstant(iso: string | null | undefined, tz?: string | null, opts: { dateOnly?: boolean; timeOnly?: boolean } = {}): string {
  const ms = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(ms)) return '';
  const zone = tz || undefined;
  const fmt = (o: Intl.DateTimeFormatOptions) => {
    try { return new Intl.DateTimeFormat('en-US', { ...o, timeZone: zone }).format(new Date(ms)); }
    catch { return new Intl.DateTimeFormat('en-US', o).format(new Date(ms)); }
  };
  const date = fmt({ weekday: 'short', month: 'short', day: 'numeric' });
  const time = fmt({ hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  if (opts.dateOnly) return date;
  if (opts.timeOnly) return time;
  return `${date} · ${time}`;
}

/** "Sat, Mar 14 · 6:00 PM – 11:00 PM EDT" for a start/end pair in the shift's zone. */
export function formatShiftWindow(start: string | null | undefined, end: string | null | undefined, tz?: string | null): string {
  const s = formatShiftInstant(start, tz);
  const e = formatShiftInstant(end, tz, { timeOnly: true });
  if (!s) return '';
  // Same-day end: "Sat, Mar 14 · 6:00 PM – 11:00 PM EDT"; otherwise spell both out.
  const sameDay = formatShiftInstant(start, tz, { dateOnly: true }) === formatShiftInstant(end, tz, { dateOnly: true });
  if (!e) return s;
  return sameDay ? `${s.replace(/ [A-Z]{2,5}$/, '')} – ${e}` : `${s} – ${formatShiftInstant(end, tz)}`;
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
