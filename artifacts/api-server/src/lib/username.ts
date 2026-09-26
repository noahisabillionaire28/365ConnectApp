/**
 * Handle (@username) rules, shared by POST /users and PATCH /users/me.
 * Stored lower-case; 2–30 chars of a-z, 0-9, "_" and "."; a short list of
 * names that would be confusing or impersonate the platform is refused.
 */
import { HttpError } from './httpError.js';

export const USERNAME_RE = /^[a-z0-9_.]{2,30}$/;

const RESERVED = new Set([
  'admin', 'administrator', 'support', 'help', '365connect', '365_connect', 'connect365',
  'root', 'system', 'null', 'undefined', 'me', 'api', 'staff', 'moderator', 'official',
]);

/** Lower-cased, validated handle, or an HttpError(400) the caller can send. */
export function normalizeUsername(raw: unknown): string {
  if (typeof raw !== 'string') throw new HttpError(400, 'Choose a handle to continue.');
  const handle = raw.trim().toLowerCase();
  if (!USERNAME_RE.test(handle)) {
    throw new HttpError(400, 'Handles are 2–30 characters: letters, numbers, _ and . only.');
  }
  if (RESERVED.has(handle)) throw new HttpError(409, 'That handle is reserved. Try another.');
  return handle;
}

/** True for the Postgres unique-violation error PostgREST relays. */
export function isUniqueViolation(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === '23505' || /duplicate key/i.test(error?.message ?? '');
}

export const HANDLE_TAKEN = 'That handle is taken. Try another.';
