/**
 * Handle (@username) helpers shared by role select and the setup screens.
 * The server is the source of truth (lower-case, 2–30 chars of a-z 0-9 _ .,
 * unique regardless of case); this mirrors its rules for instant feedback.
 */

export const USERNAME_RE = /^[a-z0-9_.]{2,30}$/;

/** Handles the server refuses outright (mirrors the API's reserved list). */
export const RESERVED_HANDLES = new Set([
  'admin', 'administrator', 'support', 'help', '365connect', '365_connect', 'connect365',
  'root', 'system', 'null', 'undefined', 'me', 'api', 'staff', 'moderator', 'official',
]);

/**
 * The message the server would answer with for this handle, or null when it
 * passes the format and reserved-name rules (uniqueness is checked separately).
 */
export function handleFormatError(raw: string): string | null {
  const handle = raw.trim().toLowerCase();
  if (!handle) return 'Choose a handle to continue.';
  if (!USERNAME_RE.test(handle)) return 'Handles are 2–30 characters: letters, numbers, _ and . only.';
  if (RESERVED_HANDLES.has(handle)) return 'That handle is reserved. Try another.';
  return null;
}

/** The part of an email before "@", reduced to handle characters. */
function emailPrefix(email: string | undefined): string {
  return (email ?? '').split('@')[0].toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 15) || 'user';
}

/**
 * A placeholder handle for a brand-new account: the email prefix plus a
 * 6-character suffix from the user id, so the person is discoverable right
 * after role select. The worker setup asks them to choose a real one.
 */
export function generateUsername(email: string | undefined, userId: string): string {
  const suffix = userId.replace(/[^a-z0-9]/gi, '').slice(-6).toLowerCase();
  return `${emailPrefix(email)}_${suffix}`;
}

/** The same placeholder with a fresh random suffix (after a "handle taken" answer). */
export function generateUsernameWithRandomSuffix(email: string | undefined): string {
  return `${emailPrefix(email)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** True when a stored handle is one of the auto-generated placeholders above. */
export function isAutoHandle(username: string | null | undefined, email: string | undefined): boolean {
  if (!username) return false;
  const prefix = emailPrefix(email).replace(/[.]/g, '\\.');
  return new RegExp(`^${prefix}_[a-z0-9]{6}$`).test(username);
}

/** A display name turned into a handle candidate ("Acme Events" → "acme_events"). */
export function slugifyHandle(name: string): string {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24);
  return base.length >= 2 ? base : `${base || 'user'}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Did the API refuse the handle because someone else has it? */
export function isHandleTakenError(err: unknown): boolean {
  return err instanceof Error && /taken|reserved/i.test(err.message);
}

/**
 * Save a handle through `save`, retrying with a random suffix when the API
 * answers "taken". Returns the handle that stuck. Any other error is thrown.
 */
export async function saveHandleWithRetry(
  base: string,
  save: (handle: string) => Promise<unknown>,
  attempts = 4,
): Promise<string> {
  let candidate = base;
  for (let i = 0; i < attempts; i++) {
    try {
      await save(candidate);
      return candidate;
    } catch (err) {
      if (!isHandleTakenError(err) || i === attempts - 1) throw err;
      candidate = `${base.slice(0, 24)}_${Math.random().toString(36).slice(2, 6)}`;
    }
  }
  return candidate;
}
