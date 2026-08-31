/**
 * Module-level store for the unified 5-step Post Shift wizard.
 * Used by both client and staffer roles.
 * State persists across step navigations; call resetDraft() on wizard entry.
 */

export type PostShiftDraft = {
  // ── Step 1: Event type ───────────────────────────────────────────────────
  event_type: string; // Wedding, Corporate, Cocktail Party, …

  // ── Step 2: Job type(s) + title ──────────────────────────────────────────
  job_type:  string;   // primary type (first of job_types) — kept for compat
  job_types: string[]; // all worker types this shift needs (multi-select)
  title:     string;

  // ── Step 2: Location ─────────────────────────────────────────────────────
  location:  string;
  lat:       number;
  lng:       number;
  unit_info: string;  // suite/floor/unit (optional)

  // ── Step 3: Schedule + headcount ─────────────────────────────────────────
  date:            string; // YYYY-MM-DD
  start_time:      string; // HH:MM (24-hour)
  end_time:        string; // HH:MM (24-hour)
  spots_available: number;

  // ── Step 4: Compensation + details ───────────────────────────────────────
  pay_rate:     number;
  description:  string;
  requirements: string[]; // one requirement per line → string[]

  // ── Booking mode ─────────────────────────────────────────────────────────
  instant_claim: boolean; // true = any qualified worker can grab it, no approval
};

// ─── Default location (updated by initDraftLocation; survives resetDraft) ────
let _defaultLat = 25.7825;
let _defaultLng = -80.1298;

// ─── Empty draft ─────────────────────────────────────────────────────────────
function empty(): PostShiftDraft {
  return {
    event_type:      '',
    job_type:        '',
    job_types:       [],
    title:           '',
    location:        '',
    lat:             _defaultLat,
    lng:             _defaultLng,
    unit_info:       '',
    date:            '',
    start_time:      '18:00',
    end_time:        '23:00',
    spots_available: 1,
    pay_rate:        0,
    description:     '',
    requirements:    [],
    instant_claim:   false,
  };
}

/**
 * Resolve the best available location for the wizard and store it as the
 * default so it survives resetDraft().  Call once when the wizard mounts.
 * Priority: profile DB coords → browser geolocation → Miami constant.
 */
export async function initDraftLocation(
  profileLat: number | null,
  profileLng: number | null,
): Promise<void> {
  // 1. Profile coordinates
  if (profileLat && profileLng) {
    _defaultLat = profileLat;
    _defaultLng = profileLng;
    if (draft.lat === 25.7825 && draft.lng === -80.1298) {
      draft = { ...draft, lat: _defaultLat, lng: _defaultLng };
    }
    return;
  }
  // 2. Browser geolocation
  if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          _defaultLat = pos.coords.latitude;
          _defaultLng = pos.coords.longitude;
          if (draft.lat === 25.7825 && draft.lng === -80.1298) {
            draft = { ...draft, lat: _defaultLat, lng: _defaultLng };
          }
          resolve();
        },
        () => resolve(),
        { timeout: 5000, maximumAge: 60_000 },
      );
    });
  }
  // 3. Miami stays as-is (already the module default)
}

// ─── Singleton ────────────────────────────────────────────────────────────────
const DRAFT_KEY = '365connect:post-shift-draft';

function loadPersistedDraft(): PostShiftDraft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return { ...empty(), ...JSON.parse(raw) };
  } catch { /* corrupt — start fresh */ }
  return empty();
}

let draft: PostShiftDraft = loadPersistedDraft();

// ─── Public API ───────────────────────────────────────────────────────────────
export function getDraft(): PostShiftDraft {
  return { ...draft, requirements: [...draft.requirements], job_types: [...draft.job_types] };
}
export function setDraft(updates: Partial<PostShiftDraft>): void {
  draft = { ...draft, ...updates };
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* ignore */ }
}
export function resetDraft(): void {
  draft = empty();
  editShiftId = null;
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

// ─── Edit mode ────────────────────────────────────────────────────────────────
// Kept separate from draft fields — not a form value, just routing metadata.
// Set by the client when opening an existing shift for editing; cleared on resetDraft().
let editShiftId: string | null = null;
export function getEditShiftId(): string | null { return editShiftId; }
export function setEditShiftId(id: string | null): void { editShiftId = id; }

// ─── Derived helpers ──────────────────────────────────────────────────────────

/** Duration in decimal hours between two HH:MM strings (handles overnight). */
export function durationHours(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let s = sh * 60 + sm;
  let e = eh * 60 + em;
  if (e <= s) e += 24 * 60; // crosses midnight
  return (e - s) / 60;
}

/** Duration as a human-readable string, e.g. "6h" or "6h 30m". */
export function durationLabel(start: string, end: string): string {
  const hrs = durationHours(start, end);
  if (hrs === 0) return '—';
  const h = Math.floor(hrs);
  const m = Math.round((hrs - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Build an ISO datetime string from a date and HH:MM time.
 * If refTime is provided and time ≤ refTime, adds one day (handles midnight crossings).
 */
export function buildIso(date: string, time: string, refTime?: string): string {
  if (!date || !time) return '';
  let d = date;
  if (refTime) {
    const [rh, rm] = refTime.split(':').map(Number);
    const [th, tm] = time.split(':').map(Number);
    if (th * 60 + tm <= rh * 60 + rm) {
      const dt = new Date(`${date}T00:00:00`);
      dt.setDate(dt.getDate() + 1);
      d = dt.toISOString().split('T')[0];
    }
  }
  return `${d}T${time}:00`;
}

/** Format HH:MM to 12-hour "7:00 PM" display. */
export function fmt12h(hhmm: string): string {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Format YYYY-MM-DD to "Fri, Jan 10" display. */
export function fmtDate(iso: string): string {
  if (!iso) return '';
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}
