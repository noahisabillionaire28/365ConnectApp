/**
 * Module-level store for the unified 5-step Post Shift wizard.
 * Used by both client and staffer roles.
 * State persists across step navigations; call resetDraft() on wizard entry.
 */

import { browserTimeZone, zonedTimeToUtc } from '@/lib/timezone';
import { emptyRepeat, type RepeatRule } from '@/lib/recurrence';

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
  /** Recurrence: "Doesn't repeat" posts one shift; anything else posts a series. */
  repeat: RepeatRule;

  // ── Step 4: Compensation + details ───────────────────────────────────────
  pay_rate:     number;
  /** 'hr' (the wizard default) or a flat 'day' / 'event' rate on an edited shift. */
  pay_period:   'hr' | 'day' | 'event';
  description:  string;
  requirements: string[]; // one requirement per line → string[]

  // ── Day-of details (no wizard step yet; carried by templates and re-posts) ─
  dress_code_items:     string[];
  point_of_contact:     string;
  contact_phone:        string;
  parking_notes:        string;
  special_instructions: string;

  /**
   * The venue's IANA zone. Empty for a new shift (the poster's device zone is
   * used); set when editing so the stored zone survives an edit made from
   * somewhere else.
   */
  timezone: string;

  // ── Booking mode ─────────────────────────────────────────────────────────
  instant_claim: boolean; // true = any qualified worker can grab it, no approval
  /** 'roster' = only workers on the agency's roster can see and take it. */
  visibility: 'public' | 'roster';
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
    repeat:          emptyRepeat(),
    pay_rate:        0,
    pay_period:      'hr',
    description:     '',
    requirements:    [],
    dress_code_items:     [],
    point_of_contact:     '',
    contact_phone:        '',
    parking_notes:        '',
    special_instructions: '',
    timezone:        '',
    instant_claim:   false,
    visibility:      'public',
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
    if (raw) {
      const saved = JSON.parse(raw) as Partial<PostShiftDraft>;
      return { ...empty(), ...saved, repeat: { ...emptyRepeat(), ...(saved.repeat ?? {}) } };
    }
  } catch { /* corrupt — start fresh */ }
  return empty();
}

let draft: PostShiftDraft = loadPersistedDraft();

// ─── Public API ───────────────────────────────────────────────────────────────
export function getDraft(): PostShiftDraft {
  return {
    ...draft,
    requirements: [...draft.requirements],
    job_types: [...draft.job_types],
    dress_code_items: [...draft.dress_code_items],
    repeat: { ...draft.repeat, weekdays: [...draft.repeat.weekdays], custom_dates: [...draft.repeat.custom_dates] },
  };
}
export function setDraft(updates: Partial<PostShiftDraft>): void {
  draft = { ...draft, ...updates };
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* ignore */ }
}
export function resetDraft(): void {
  draft = empty();
  editShiftId = null;
  editInSeries = false;
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

// ─── Edit mode ────────────────────────────────────────────────────────────────
// Kept separate from draft fields — not a form value, just routing metadata.
// Set by the client when opening an existing shift for editing; cleared on resetDraft().
let editShiftId: string | null = null;
/** The shift being edited belongs to a recurring series (the edit only touches it). */
let editInSeries = false;
export function getEditShiftId(): string | null { return editShiftId; }
export function setEditShiftId(id: string | null, opts: { inSeries?: boolean } = {}): void {
  editShiftId = id;
  editInSeries = !!id && !!opts.inSeries;
}
export function getEditInSeries(): boolean { return editInSeries; }

// ─── Templates ────────────────────────────────────────────────────────────────

/** Everything a template keeps: the draft minus its dates and recurrence. */
export type TemplatePayload = {
  title?: string;
  event_type?: string | null;
  job_type?: string;
  job_types?: string[];
  location?: string | null;
  lat?: number | null;
  lng?: number | null;
  unit_info?: string | null;
  pay_rate?: number;
  pay_period?: 'hr' | 'day' | 'event';
  spots_available?: number;
  dress_code?: string | null;
  dress_code_items?: string[];
  requirements?: string[];
  description?: string | null;
  point_of_contact?: string | null;
  contact_phone?: string | null;
  parking_notes?: string | null;
  special_instructions?: string | null;
  visibility?: 'public' | 'roster';
  instant_claim?: boolean;
  /** Venue wall-clock HH:MM. */
  start_time?: string;
  end_time?: string;
  timezone?: string;
};

/** The template a draft would save. */
export function draftToTemplatePayload(d: PostShiftDraft = draft): TemplatePayload {
  return {
    title:            d.title,
    event_type:       d.event_type || null,
    job_type:         d.job_type,
    job_types:        d.job_types.length ? d.job_types : (d.job_type ? [d.job_type] : []),
    location:         d.location || null,
    lat:              d.lat,
    lng:              d.lng,
    unit_info:        d.unit_info || null,
    pay_rate:         d.pay_rate,
    pay_period:       d.pay_period,
    spots_available:  d.spots_available,
    dress_code_items: d.dress_code_items,
    requirements:     d.requirements,
    description:      d.description || null,
    point_of_contact: d.point_of_contact || null,
    contact_phone:    d.contact_phone || null,
    parking_notes:    d.parking_notes || null,
    special_instructions: d.special_instructions || null,
    visibility:       d.visibility,
    instant_claim:    d.instant_claim,
    start_time:       d.start_time,
    end_time:         d.end_time,
    timezone:         d.timezone || browserTimeZone(),
  };
}

const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/**
 * Start a fresh draft from a template. Dates and recurrence stay empty so the
 * poster only has to pick when; everything else is filled in.
 */
export function loadDraftFromTemplate(p: TemplatePayload): void {
  const base = empty();
  const jobTypes = strList(p.job_types);
  const jobType = p.job_type || jobTypes[0] || '';
  const payPeriod = p.pay_period === 'day' || p.pay_period === 'event' ? p.pay_period : 'hr';
  draft = {
    ...base,
    title:            p.title ?? '',
    event_type:       p.event_type ?? '',
    job_type:         jobType,
    job_types:        jobTypes.length ? jobTypes : (jobType ? [jobType] : []),
    location:         p.location ?? '',
    lat:              typeof p.lat === 'number' && Number.isFinite(p.lat) ? p.lat : base.lat,
    lng:              typeof p.lng === 'number' && Number.isFinite(p.lng) ? p.lng : base.lng,
    unit_info:        p.unit_info ?? '',
    start_time:       p.start_time || base.start_time,
    end_time:         p.end_time || base.end_time,
    spots_available:  Math.max(1, Number(p.spots_available) || 1),
    pay_rate:         Math.max(0, Number(p.pay_rate) || 0),
    pay_period:       payPeriod,
    description:      p.description ?? '',
    requirements:     strList(p.requirements),
    dress_code_items: strList(p.dress_code_items),
    point_of_contact: p.point_of_contact ?? '',
    contact_phone:    p.contact_phone ?? '',
    parking_notes:    p.parking_notes ?? '',
    special_instructions: p.special_instructions ?? '',
    // The venue zone is chosen when the shift is posted, not by the template.
    timezone:         '',
    instant_claim:    !!p.instant_claim,
    visibility:       p.visibility === 'roster' ? 'roster' : 'public',
  };
  editShiftId = null;
  editInSeries = false;
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* ignore */ }
}

// ─── Last post (for "Save as template" on the success screen) ─────────────────
// The draft is cleared the moment a post succeeds; the success screen still
// needs the details to offer saving them as a template.
let lastPosted: TemplatePayload | null = null;
export function rememberLastPosted(p: TemplatePayload): void { lastPosted = p; }
export function getLastPosted(): TemplatePayload | null { return lastPosted; }

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
export function buildIso(date: string, time: string, refTime?: string, tz: string = browserTimeZone()): string {
  if (!date || !time) return '';
  let d = date;
  if (refTime) {
    const [rh, rm] = refTime.split(':').map(Number);
    const [th, tm] = time.split(':').map(Number);
    if (th * 60 + tm <= rh * 60 + rm) {
      const [y, m, day] = date.split('-').map(Number);
      const next = new Date(Date.UTC(y, m - 1, day + 1));
      d = next.toISOString().split('T')[0];
    }
  }
  // A real instant: the venue's wall-clock time converted with its zone.
  return zonedTimeToUtc(d, time, tz);
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
