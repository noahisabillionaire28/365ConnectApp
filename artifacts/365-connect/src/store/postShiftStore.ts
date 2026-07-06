/**
 * Module-level store for the 5-step shift-posting wizard.
 * Holds draft state between steps; reset clears everything.
 */

export type PostShiftDraft = {
  // ── Step 1: Who ──────────────────────────────────────────────────────────
  jobTypes:     string[];                  // multi-selected job type labels
  workerCounts: Record<string, number>;    // { "Bartender": 2, "Server": 4 }

  // ── Step 2: When ─────────────────────────────────────────────────────────
  date:      string;    // YYYY-MM-DD
  startTime: string;    // HH:MM  (24-hour)
  endTime:   string;    // HH:MM  (24-hour)
  repeat:    'once' | 'weekly' | 'custom';

  // ── Step 3: Where ────────────────────────────────────────────────────────
  location:     string;
  lat:          number;
  lng:          number;
  unit:         string;   // suite / floor / unit
  parkingNotes: string;

  // ── Step 4: Details ──────────────────────────────────────────────────────
  payRate:            number;
  dressCode:          string;
  description:        string;
  contactName:        string;
  contactPhone:       string;
  specialInstructions: string;
};

// ─── Empty draft factory ──────────────────────────────────────────────────────
function emptyDraft(): PostShiftDraft {
  return {
    jobTypes:            [],
    workerCounts:        {},
    date:                '',
    startTime:           '18:00',
    endTime:             '23:00',
    repeat:              'once',
    location:            '',
    lat:                 25.7825,
    lng:                 -80.1298,
    unit:                '',
    parkingNotes:        '',
    payRate:             0,
    dressCode:           '',
    description:         '',
    contactName:         '',
    contactPhone:        '',
    specialInstructions: '',
  };
}

// ─── Module-level singleton ───────────────────────────────────────────────────
let draft: PostShiftDraft = emptyDraft();

// ─── Public API ───────────────────────────────────────────────────────────────
export function getDraft(): PostShiftDraft       { return { ...draft, workerCounts: { ...draft.workerCounts } }; }
export function setDraft(updates: Partial<PostShiftDraft>) { draft = { ...draft, ...updates }; }
export function resetDraft()                     { draft = emptyDraft(); }

// ─── Derived helpers ──────────────────────────────────────────────────────────

/** Total number of workers across all selected job types */
export function totalWorkers(wc: Record<string, number>): number {
  return Object.values(wc).reduce((a, b) => a + b, 0);
}

/** Duration in decimal hours between two HH:MM strings (handles overnight) */
export function durationHours(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let startMins = sh * 60 + sm;
  let endMins   = eh * 60 + em;
  if (endMins <= startMins) endMins += 24 * 60;
  return (endMins - startMins) / 60;
}

/** Duration as a human-readable string e.g. "6h" or "6h 30m" */
export function durationLabel(start: string, end: string): string {
  const hrs  = durationHours(start, end);
  if (hrs === 0) return '—';
  const h = Math.floor(hrs);
  const m = Math.round((hrs - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Build ISO datetime strings from date + time */
export function buildIsoDateTimes(date: string, startTime: string, endTime: string): {
  startIso: string;
  endIso: string;
} {
  if (!date || !startTime || !endTime) return { startIso: '', endIso: '' };
  const startIso = `${date}T${startTime}:00`;
  // If end ≤ start → next calendar day
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const crossesMidnight = eh * 60 + em <= sh * 60 + sm;
  let endDate = date;
  if (crossesMidnight) {
    const d = new Date(`${date}T00:00:00`);
    d.setDate(d.getDate() + 1);
    endDate = d.toISOString().split('T')[0];
  }
  return { startIso, endIso: `${endDate}T${endTime}:00` };
}
