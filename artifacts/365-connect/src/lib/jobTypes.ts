/** The 14 canonical job types used across worker setup, feeds, and discovery. */
export const JOB_TYPES = [
  'Bartender', 'Server', 'DJ', 'Caterer',
  'Security', 'Hostess', 'Promotional Model', 'Brand Ambassador',
  'Captain', 'Manager', 'House Manager', 'Cleaner',
  'Housekeeper', 'Busser',
] as const;

export type JobType = (typeof JOB_TYPES)[number];

/** The event types a client hosts / an agency staffs (stored in users.secondary_job_types). */
export const EVENT_TYPES = [
  'Nightclub', 'Rooftop Event', 'Corporate Event', 'Private Party',
  'Wedding', 'Festival', 'Pool Party', 'Gala',
  'Concert', 'Pop-up', 'Sports Event', 'Brand Activation',
  'Birthday Party', 'Product Launch',
] as const;
