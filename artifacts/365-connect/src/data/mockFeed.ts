/**
 * Shared UI types for the shift feed. All actual data comes from Supabase —
 * see `src/lib/supabase.ts` (shiftRowToMockShift) and `src/hooks/useShifts.ts`.
 * No mock/sample arrays are exported from this file; only the shapes remain.
 */
export type StoryWorker = {
  id: string;
  username: string;
  photoUrl: string;
  isPremium: boolean;
  isAvailable: boolean;
};

export type MockShift = {
  id: string;
  jobType: string;
  /** All job types this shift accepts (job-type intersection filtering, AI match). */
  jobTypes: string[];
  companyName: string;
  coverImage: string;
  payRate: number;
  payPeriod: 'hr' | 'day' | 'event';
  date: string;
  startTime: string;
  endTime: string;
  /** Raw ISO timestamptz for the shift start — used for day-of-week matching, never displayed directly. */
  startTimeISO: string;
  distanceMiles: number;
  spotsAvailable: number;
  spotsTotal: number;
  location: string;
  aiMatchPct: number;
  description: string;
  requirements: string[];
  dressCode: string;
  dressCodeItems: string[];
  pointOfContact: string;
  contactPhone: string;
  lat: number;
  lng: number;
  clientId: string;
  status: 'open' | 'filled' | 'cancelled' | 'completed';
};
