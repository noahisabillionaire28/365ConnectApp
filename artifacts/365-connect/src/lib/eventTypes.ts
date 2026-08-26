/** Canonical event types a client/staffer chooses when posting a shift. */
export const EVENT_TYPES = [
  'Cocktail Party',
  'Wedding',
  'Dinner Party',
  'Bar Mitzvah',
  'Corporate',
  'Other',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];
