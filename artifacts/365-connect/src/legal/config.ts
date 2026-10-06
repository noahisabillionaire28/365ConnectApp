/**
 * Legal document settings shared by the Terms of Service and Privacy Policy.
 *
 * The version strings are mirrored on the server in
 * artifacts/api-server/src/lib/legal.ts, which is authoritative: the app
 * fetches the current versions from GET /legal/versions and only falls back to
 * these constants when that request fails. Bump BOTH copies together (and the
 * effective dates in terms.ts / privacy.ts) to require every user to accept
 * the documents again. See docs/legal.md.
 */
export const LEGAL = {
  entityName: '365 Connect',
  entityNote: 'TODO: replace with the registered legal entity name (e.g. "365 Connect LLC") once formed',
  governingLaw: 'California',
  venueCounty: 'Los Angeles County',
  contactEmail: 'legal@365connect.app',
  contactEmailNote: 'TODO: replace with a monitored mailbox',
  mailingAddress: 'TODO: mailing address for legal notices',
  termsVersion: '2026-10-06',
  privacyVersion: '2026-10-06',
} as const;

export type LegalDocumentId = 'terms' | 'privacy';

export type LegalSection = {
  id: string;
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type LegalDocument = {
  title: string;
  effectiveDate: string;
  intro: string[];
  sections: LegalSection[];
};

/** "2026-10-06" → "October 6, 2026" for the effective-date line. */
export function formatLegalDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}
