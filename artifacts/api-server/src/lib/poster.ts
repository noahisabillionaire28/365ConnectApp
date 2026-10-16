/**
 * How a shift's poster is named on job cards, chats and receipts.
 *
 * An agency (staffer) is known by its agency name; a client by their own
 * name, or their company when that is all they gave. The handle is the
 * last resort. The bio is never a label.
 */
export type PosterRow = {
  id?: string;
  username?: string | null;
  name?: string | null;
  company_name?: string | null;
  role?: string | null;
};

export const POSTER_COLS = 'id, username, name, company_name, role, photo_url';

export function posterLabel(u: PosterRow | null | undefined): string | null {
  if (!u) return null;
  const name = u.name?.trim() || null;
  const company = u.company_name?.trim() || null;
  const handle = u.username ? `@${u.username}` : null;
  return (u.role === 'staffer' ? company || name : name || company) || handle;
}

/** Posters by id, for labelling a list of shifts in one query. */
export async function posterMap(db: { from: (t: string) => any }, clientIds: (string | null | undefined)[]): Promise<Map<string, PosterRow & { photo_url?: string | null }>> {
  const ids = [...new Set(clientIds.filter((id): id is string => !!id))];
  const map = new Map<string, PosterRow & { photo_url?: string | null }>();
  if (!ids.length) return map;
  const { data } = await db.from('users').select(POSTER_COLS).in('id', ids);
  for (const u of data ?? []) map.set(u.id as string, u);
  return map;
}

/** The label a shift shows: one typed for the shift itself, else the poster's. */
export function shiftLabel(shift: { company_name?: string | null; client_id?: string | null }, posters: Map<string, PosterRow>): string | null {
  return shift.company_name?.trim() || posterLabel(shift.client_id ? posters.get(shift.client_id) : null);
}
