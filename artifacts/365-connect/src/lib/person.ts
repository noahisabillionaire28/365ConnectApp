/**
 * How a person or business is named everywhere in the app. Mirrors the API's
 * personLabel: an agency (staffer) goes by its agency name, everyone else by
 * their own name (a client's company when that is all they gave), and the
 * @handle only when there is nothing better.
 */
export type Named = {
  name?: string | null;
  username?: string | null;
  company_name?: string | null;
  role?: string | null;
};

export function personName(p: Named | null | undefined, fallback = ''): string {
  if (!p) return fallback;
  const name = p.name?.trim() || null;
  const company = p.company_name?.trim() || null;
  const handle = p.username ? `@${p.username}` : null;
  return (p.role === 'staffer' ? company || name : name || company) || handle || fallback;
}

/** "@handle" as a second line, only when the first line is not already the handle. */
export function handleLine(p: Named | null | undefined): string | null {
  if (!p?.username) return null;
  return personName(p) === `@${p.username}` ? null : `@${p.username}`;
}

/** Does this person match a typed search (by name or handle)? */
export function matchesPerson(p: Named, query: string): boolean {
  const q = query.trim().replace(/^@/, '').toLowerCase();
  if (!q) return true;
  return (p.username ?? '').toLowerCase().includes(q) || (p.name ?? '').toLowerCase().includes(q)
    || (p.company_name ?? '').toLowerCase().includes(q);
}
