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
export function getStafferDraft(): StafferPostDraft       { return { ...draft }; }
export function setStafferDraft(u: Partial<StafferPostDraft>) { draft = { ...draft, ...u }; }
export function resetStafferDraft()                       { draft = emptyDraft(); }
