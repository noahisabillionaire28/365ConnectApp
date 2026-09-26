/**
 * Venue wall-clock ⇄ instant conversions, mirroring the web app's
 * lib/timezone.ts so a recurring series computes each occurrence exactly the
 * way the wizard computes a single shift.
 */

export const DEFAULT_SHIFT_TZ = 'America/New_York';

function isValidZone(tz: string): boolean {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

/** Wall-clock parts of an instant in a zone. */
function partsIn(ms: number, tz: string): { y: number; mo: number; d: number; h: number; mi: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  const parts = fmt.formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour') % 24, mi: get('minute') };
}

/** A venue date + time (YYYY-MM-DD, HH:MM) in `tz` → UTC ISO instant. */
export function zonedTimeToUtc(date: string, time: string, tz: string): string {
  const zone = isValidZone(tz) ? tz : DEFAULT_SHIFT_TZ;
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const wantedAsUtc = Date.UTC(y, mo - 1, d, h, mi);
  let guess = wantedAsUtc;
  for (let i = 0; i < 2; i++) {
    const p = partsIn(guess, zone);
    guess += wantedAsUtc - Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi);
  }
  return new Date(guess).toISOString();
}

/** The venue wall-clock date and time of a stored instant. */
export function utcToZonedParts(iso: string, tz: string): { date: string; time: string } {
  const zone = isValidZone(tz) ? tz : DEFAULT_SHIFT_TZ;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return { date: '', time: '' };
  const p = partsIn(ms, zone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { date: `${p.y}-${pad(p.mo)}-${pad(p.d)}`, time: `${pad(p.h)}:${pad(p.mi)}` };
}

/** YYYY-MM-DD → the following calendar day, YYYY-MM-DD. */
export function nextCalendarDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** True for a real calendar date written as YYYY-MM-DD. */
export function isCalendarDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** "Fri, Oct 3" for a YYYY-MM-DD date (zone-free, it is a calendar day). */
export function formatCalendarDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, d)));
}
