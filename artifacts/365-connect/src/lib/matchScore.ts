import type { MockShift } from '@/data/mockFeed';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export type MatchProfile = {
  primaryJobType: string | null;
  secondaryJobTypes: string[];
  availability: Record<string, boolean> | null;
  rating: number;
};

/**
 * AI Match Score (Shift Detail only): job-type match 40 + availability match 30
 * + rating 20 + distance 10 = 100 pts max.
 */
export function computeMatchScore(shift: MockShift, profile: MatchProfile): number {
  const workerTypes = [profile.primaryJobType, ...profile.secondaryJobTypes].filter(Boolean) as string[];
  const jobTypePts = shift.jobTypes.some((t) => workerTypes.includes(t)) ? 40 : 0;

  const dayKey = DAY_KEYS[new Date(shift.startTimeISO).getDay()];
  const availabilityPts = profile.availability && profile.availability[dayKey] ? 30 : 0;

  const ratingPts = Math.round((Math.min(5, Math.max(0, profile.rating)) / 5) * 20);

  const d = shift.distanceMiles;
  const distancePts = Math.max(0, Math.min(10, Math.round(10 * (1 - Math.max(0, d - 5) / 15))));

  return Math.max(0, Math.min(100, jobTypePts + availabilityPts + ratingPts + distancePts));
}
