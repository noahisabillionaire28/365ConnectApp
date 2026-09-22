/**
 * Shift times are real instants (UTC) tagged with the venue's IANA time zone.
 * A poster enters a wall-clock time ("6:00 PM") for the venue; we convert it
 * to an instant with the venue zone, store that, and render it back in the
 * venue zone so every viewer sees "6:00 PM" while all lifecycle logic (clock-in
 * windows, late flags, reminders) compares real instants.
 */

/** Used for legacy rows that were saved before shifts carried a time zone. */
export const DEFAULT_SHIFT_TZ = 'America/New_York';

/** The zone this device is in — the best guess for a venue the poster is near. */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_SHIFT_TZ;
  } catch {
    return DEFAULT_SHIFT_TZ;
  }
}

function isValidZone(tz: string): boolean {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

/** Wall-clock parts of an instant in a zone. */
function partsIn(ms: number, tz: string): { y: number; mo: number; d: number; h: number; mi: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  const get = (type: string) => Number(fmt.formatToParts(new Date(ms)).find((p) => p.type === type)?.value ?? 0);
  // Intl may render midnight as "24" in some engines with hour12:false.
  const h = get('hour') % 24;
  return { y: get('year'), mo: get('month'), d: get('day'), h, mi: get('minute') };
}

/**
 * Convert a venue wall-clock date + time (YYYY-MM-DD, HH:MM) in `tz` to a UTC
 * ISO instant. Two-pass offset correction handles daylight-saving edges.
 */
export function zonedTimeToUtc(date: string, time: string, tz: string): string {
  const zone = isValidZone(tz) ? tz : DEFAULT_SHIFT_TZ;
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const wantedAsUtc = Date.UTC(y, mo - 1, d, h, mi);

  let guess = wantedAsUtc;
  for (let i = 0; i < 2; i++) {
    const p = partsIn(guess, zone);
    const shownAsUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi);
    guess += wantedAsUtc - shownAsUtc;
  }
  return new Date(guess).toISOString();
}

/** The venue wall-clock date and time (for editing) of a stored instant. */
export function utcToZonedParts(iso: string, tz: string): { date: string; time: string } {
  const zone = isValidZone(tz) ? tz : DEFAULT_SHIFT_TZ;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return { date: '', time: '' };
  const p = partsIn(ms, zone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { date: `${p.y}-${pad(p.mo)}-${pad(p.d)}`, time: `${pad(p.h)}:${pad(p.mi)}` };
}

/** Short zone label like "EDT" / "PST" for an instant, or '' if unknown. */
export function zoneAbbrev(iso: string, tz: string): string {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
      .formatToParts(new Date(iso)).find((p) => p.type === 'timeZoneName');
    return part?.value ?? '';
  } catch {
    return '';
  }
}
