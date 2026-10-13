/**
 * Account phone numbers. Mirrors the server's normalisation (api-server
 * lib/phone.ts) so the form can say "that doesn't look right" before saving:
 * formatting is dropped, 10 digits (or 11 starting with 1) mean US/Canada,
 * anything else needs a leading + and country code. Stored as +<digits>.
 */

export const PHONE_HINT = 'US numbers need no country code. Elsewhere, start with + and the country code.';

/** '' → null; a valid number → '+<digits>'; anything else → undefined. */
export function normalizePhone(input: string): string | null | undefined {
  const raw = input.trim();
  if (!raw) return null;
  if (raw.length > 32 || !/^\+?[0-9\s().\-]+$/.test(raw)) return undefined;
  const digits = raw.replace(/\D/g, '');
  let e164: string;
  if (raw.startsWith('+')) e164 = `+${digits}`;
  else if (digits.length === 10) e164 = `+1${digits}`;
  else if (digits.length === 11 && digits.startsWith('1')) e164 = `+${digits}`;
  else return undefined;
  return /^\+[1-9][0-9]{6,14}$/.test(e164) ? e164 : undefined;
}

/** '+15551234567' → '(555) 123-4567'; other countries stay as stored. */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return '';
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}
