/**
 * Module-level store for the 7-step staffer shift-posting wizard.
 * Holds draft state between steps; reset clears everything.
 * Reuses durationLabel / buildIsoDateTimes helpers from postShiftStore.
 */

export type StafferPostDraft = {
  // ── Step 1: Title & Description ─────────────────────────────────────────
  title:       string;
  description: string;

  // ── Step 2: Job Types ───────────────────────────────────────────────────
  jobTypes: string[];

  // ── Step 3: Date & Time ─────────────────────────────────────────────────
  date:      string;   // YYYY-MM-DD
  startTime: string;   // HH:MM (24-hour)
  endTime:   string;   // HH:MM (24-hour)

  // ── Step 4: Location ────────────────────────────────────────────────────
  location: string;
  lat:      number;
  lng:      number;

  // ── Step 5: Compensation & Headcount ────────────────────────────────────
  payRate:       number;
  workersNeeded: number;

  // ── Step 6: Dress Code & Contact ────────────────────────────────────────
  dressCode:    string;
  contactName:  string;
  contactPhone: string;
};

// ─── Empty draft factory ──────────────────────────────────────────────────────
function emptyDraft(): StafferPostDraft {
  return {
    title:         '',
    description:   '',
    jobTypes:      [],
    date:          '',
    startTime:     '18:00',
    endTime:       '23:00',
    location:      '',
    lat:           25.7825,
    lng:           -80.1298,
    payRate:       0,
    workersNeeded: 1,
    dressCode:     '',
    contactName:   '',
    contactPhone:  '',
  };
}

// ─── Module-level singleton ───────────────────────────────────────────────────
let draft: StafferPostDraft = emptyDraft();

// ─── Public API ───────────────────────────────────────────────────────────────
export function getStafferDraft(): StafferPostDraft           { return { ...draft }; }
export function setStafferDraft(u: Partial<StafferPostDraft>) { draft = { ...draft, ...u }; }
export function resetStafferDraft()                           { draft = emptyDraft(); }

/**
 * Resolve a sensible default location for the staffer wizard.
 * Priority: saved profile lat/lng → browser geolocation → Miami constant.
 * Call this once when the staffer opens the wizard (Step 4 / location step).
 */
export async function initStafferDraftLocation(
  profileLat: number | null,
  profileLng: number | null,
): Promise<void> {
  // 1. Profile coordinates already stored
  if (profileLat && profileLng) {
    draft = { ...draft, lat: profileLat, lng: profileLng };
    return;
  }
  // 2. Browser geolocation
  if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          draft = { ...draft, lat: pos.coords.latitude, lng: pos.coords.longitude };
          resolve();
        },
        () => resolve(), // on error fall through to constant
        { timeout: 5000, maximumAge: 60_000 },
      );
    });
    if (draft.lat !== 25.7825) return; // geolocation succeeded
  }
  // 3. Miami constant (already the emptyDraft default — no change needed)
}
