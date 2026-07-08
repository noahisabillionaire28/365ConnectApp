/** The 14 canonical job types used across worker setup, feeds, and discovery. */
export const JOB_TYPES = [
  'Bartender', 'Server', 'DJ', 'Caterer',
  'Security', 'Hostess', 'Promotional Model', 'Brand Ambassador',
  'Captain', 'Manager', 'House Manager', 'Cleaner',
  'Housekeeper', 'Busser',
] as const;

export type JobType = (typeof JOB_TYPES)[number];
