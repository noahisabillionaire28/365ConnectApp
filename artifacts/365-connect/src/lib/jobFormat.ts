/**
 * Formatting for job cards, in the venue's time zone:
 *   dayParts      → { date: "Oct 15", rel: "Today" | "Tomorrow" | "Friday" }
 *   timeRange     → "10:30a – 6:00p PDT"
 *   shortPlace    → "Beverly Hills, Wilshire Blvd" from a long geocoder string
 *   untilLabel    → "1h 8min"
 */
import { utcToZonedParts, zoneAbbrev, DEFAULT_SHIFT_TZ } from './timezone';

const zoneOf = (tz?: string | null) => tz || DEFAULT_SHIFT_TZ;

function dayDiff(iso: string, tz: string): number {
  const a = utcToZonedParts(new Date().toISOString(), tz).date;
  const b = utcToZonedParts(iso, tz).date;
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function dayParts(iso: string, tz?: string | null): { date: string; rel: string } {
  const zone = zoneOf(tz);
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: zone });
  const diff = dayDiff(iso, zone);
  const rel = diff === 0 ? 'Today'
    : diff === 1 ? 'Tomorrow'
    : diff === -1 ? 'Yesterday'
    : diff > 1 && diff < 7 ? d.toLocaleDateString('en-US', { weekday: 'long', timeZone: zone })
    : d.toLocaleDateString('en-US', { weekday: 'short', timeZone: zone });
  return { date, rel };
}

/** "10:30a", "6p" style clock time. */
function clock(iso: string, zone: string): string {
  const t = new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: zone });
  const m = /^(\d{1,2}):(\d{2})\s?(AM|PM)$/i.exec(t);
  if (!m) return t;
  return `${m[1]}${m[2] === '00' ? '' : `:${m[2]}`}${m[3][0].toLowerCase()}`;
}

export function timeRange(startISO: string | null | undefined, endISO: string | null | undefined, tz?: string | null): string {
  if (!startISO) return '';
  const zone = zoneOf(tz);
  const abbr = zoneAbbrev(startISO, zone);
  const range = endISO ? `${clock(startISO, zone)} – ${clock(endISO, zone)}` : clock(startISO, zone);
  return abbr ? `${range} ${abbr}` : range;
}

/** The useful part of a long address: first two comma parts, without the country/ZIP tail. */
export function shortPlace(location: string | null | undefined): string {
  if (!location) return '';
  const parts = location.split(',').map((p) => p.trim()).filter(Boolean)
    .filter((p) => !/^(united states|usa|us)$/i.test(p) && !/^\d{5}(-\d{4})?$/.test(p));
  return parts.slice(0, 2).join(', ');
}

/** "1h 8min" / "25min" until `ms`, or null once passed. */
export function untilLabel(ms: number): string | null {
  const diff = ms - Date.now();
  if (!(diff > 0)) return null;
  const mins = Math.ceil(diff / 60_000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h${m ? ` ${m}min` : ''}` : `${m}min`;
}

/** Turn-by-turn directions: Apple Maps on Apple devices, Google Maps elsewhere. */
export function directionsUrl(lat: number, lng: number, label: string): string {
  const apple = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
  return apple
    ? `https://maps.apple.com/?daddr=${lat},${lng}&q=${encodeURIComponent(label)}`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/** Two-letter monogram for a business without a logo. */
export function initials(name: string | null | undefined): string {
  const words = (name ?? '').replace(/^@/, '').split(/[\s._-]+/).filter(Boolean);
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase() || '·';
}
