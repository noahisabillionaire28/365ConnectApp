/**
 * Small input validators shared by the routes. Anything that ends up inside
 * a PostgREST filter string (`.or(...)`, `.in(...)`) must pass one of these
 * first: the filter grammar treats commas, dots and parentheses as syntax, so
 * raw request input there can rewrite the query.
 */
import { HttpError } from './httpError.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Job and event type names as the app spells them: words, spaces, &, /, ' and -. */
const LABEL_RE = /^[A-Za-z0-9 &/'\-]{1,60}$/;

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

/** The value when it is a UUID, else a 400 naming the field. */
export function requireUuid(v: unknown, field: string): string {
  if (!isUuid(v)) throw new HttpError(400, `${field} must be a valid id.`);
  return v;
}

/** A plain label (job type, event type) safe to place in a filter, or null when absent. */
export function cleanLabel(v: unknown, field: string): string | null {
  if (v == null || v === '') return null;
  if (typeof v !== 'string' || !LABEL_RE.test(v.trim())) throw new HttpError(400, `${field} is not a valid value.`);
  return v.trim();
}

/** Trimmed text capped at `max` characters, or null when absent. */
export function cleanText(v: unknown, max: number, field: string): string | null {
  if (v == null) return null;
  if (typeof v !== 'string') throw new HttpError(400, `${field} must be text.`);
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}
