/**
 * Recurring-shift rules for the post-shift wizard. A rule plus the chosen
 * shift date expands to a short list of local calendar dates (YYYY-MM-DD);
 * the server creates one shift per date. Dates are calendar days in the
 * venue's zone, so everything here is zone-free arithmetic on Y-M-D.
 */

export const MAX_SERIES_OCCURRENCES = 12;

export type RepeatType = 'none' | 'daily' | 'weekly' | 'custom';

export type RepeatRule = {
  type: RepeatType;
  /** Weekly only: 0 = Sunday … 6 = Saturday. */
  weekdays: number[];
  /** Custom only: extra dates on top of the shift date. */
  custom_dates: string[];
  /** Daily / weekly: stop on a date, or after N shifts. */
  ends: 'on' | 'after';
  end_date: string;
  count: number;
};

export const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export function emptyRepeat(): RepeatRule {
  return { type: 'none', weekdays: [], custom_dates: [], ends: 'after', end_date: '', count: 4 };
}

function toUtcDate(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return Number.isFinite(dt.getTime()) ? dt : null;
}

function toYmd(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

/** Days from a date, as YYYY-MM-DD. */
export function addDays(ymd: string, days: number): string {
  const dt = toUtcDate(ymd);
  if (!dt) return ymd;
  dt.setUTCDate(dt.getUTCDate() + days);
  return toYmd(dt);
}

/** 0 = Sunday … 6 = Saturday for a YYYY-MM-DD date. */
export function weekdayOf(ymd: string): number {
  return toUtcDate(ymd)?.getUTCDay() ?? 0;
}

/**
 * The local dates a rule produces, sorted, starting at `date`, never more
 * than MAX_SERIES_OCCURRENCES. "Doesn't repeat" gives just the date itself.
 */
export function expandOccurrences(date: string, rule: RepeatRule): string[] {
  if (!date || !toUtcDate(date)) return [];
  if (rule.type === 'none') return [date];

  if (rule.type === 'custom') {
    const all = new Set<string>([date, ...rule.custom_dates.filter((d) => !!toUtcDate(d))]);
    return [...all].sort().slice(0, MAX_SERIES_OCCURRENCES);
  }

  const limit = rule.ends === 'after'
    ? Math.min(Math.max(1, rule.count), MAX_SERIES_OCCURRENCES)
    : MAX_SERIES_OCCURRENCES;
  const endDate = rule.ends === 'on' && toUtcDate(rule.end_date) ? rule.end_date : null;
  if (rule.ends === 'on' && !endDate) return [date];

  const weekdays = rule.type === 'weekly'
    ? (rule.weekdays.length ? rule.weekdays : [weekdayOf(date)])
    : null;

  const out: string[] = [];
  // Daily walks day by day; weekly walks day by day too but keeps only the
  // chosen weekdays (12 shifts × 7 days is a small bound either way).
  for (let i = 0, cur = date; out.length < limit && i < 7 * MAX_SERIES_OCCURRENCES + 7; i++, cur = addDays(cur, 1)) {
    if (endDate && cur > endDate) break;
    if (weekdays && !weekdays.includes(weekdayOf(cur))) continue;
    out.push(cur);
  }
  return out;
}

/** "Fri Oct 3" for a YYYY-MM-DD date. */
export function shortDate(ymd: string, withYear = false): string {
  const dt = toUtcDate(ymd);
  if (!dt) return ymd;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC', ...(withYear ? { year: 'numeric' } : {}),
  }).format(dt);
}

/** "5 shifts · Fri Oct 3 – Fri Oct 31" (or "1 shift · Fri Oct 3"). */
export function summarizeSeries(dates: string[]): string {
  if (!dates.length) return 'No dates yet';
  const n = dates.length;
  const label = `${n} shift${n === 1 ? '' : 's'}`;
  if (n === 1) return `${label} · ${shortDate(dates[0])}`;
  return `${label} · ${shortDate(dates[0])} – ${shortDate(dates[n - 1])}`;
}

/** Short rule copy for summaries: "Weekly on Mon, Wed". */
export function describeRule(rule: RepeatRule): string {
  switch (rule.type) {
    case 'daily':  return 'Daily';
    case 'weekly': return `Weekly on ${(rule.weekdays.length ? rule.weekdays : []).map((d) => WEEKDAY_NAMES[d].slice(0, 3)).join(', ') || 'the shift day'}`;
    case 'custom': return 'Custom dates';
    default:       return "Doesn't repeat";
  }
}
