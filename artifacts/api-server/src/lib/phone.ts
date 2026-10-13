/**
 * Account phone numbers, stored as +<country code><number> (E.164 shape).
 *
 * People type numbers every which way: "(555) 123-4567", "555.123.4567",
 * "+44 20 7946 0958". Formatting characters are dropped; a 10-digit number
 * with no country code is taken as US/Canada (+1), as is an 11-digit one that
 * starts with 1. Anything else must start with "+" and a country code.
 */
import { HttpError } from './httpError.js';

export const PHONE_INVALID =
  'Enter a valid phone number, e.g. (555) 123-4567, or include the country code, e.g. +44 20 7946 0958.';

/** '' / null → null; otherwise the normalised number, or HttpError(400). */
export function normalizePhone(input: unknown): string | null {
  if (input == null) return null;
  if (typeof input !== 'string') throw new HttpError(400, PHONE_INVALID);
  const raw = input.trim();
  if (!raw) return null;
  if (raw.length > 32 || !/^\+?[0-9\s().\-]+$/.test(raw)) throw new HttpError(400, PHONE_INVALID);
  const plus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');
  let e164: string;
  if (plus) e164 = `+${digits}`;
  else if (digits.length === 10) e164 = `+1${digits}`;
  else if (digits.length === 11 && digits.startsWith('1')) e164 = `+${digits}`;
  else throw new HttpError(400, PHONE_INVALID);
  if (!/^\+[1-9][0-9]{6,14}$/.test(e164)) throw new HttpError(400, PHONE_INVALID);
  return e164;
}
