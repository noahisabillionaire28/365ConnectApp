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
  /** Informational policies: shown and linked, never part of the acceptance set. */
  refundsVersion: '2026-10-06',
  cookiesVersion: '2026-10-06',
} as const;

/** The two documents a user must accept (sign-up checkbox, LegalGate, server gate). */
export type LegalDocumentId = 'terms' | 'privacy';
/** Every public legal page, including the informational policies. */
export type LegalPageId = LegalDocumentId | 'refunds' | 'cookies';

export const LEGAL_PAGE_IDS: readonly LegalPageId[] = ['terms', 'privacy', 'refunds', 'cookies'] as const;

/** A cross-reference rendered under a section ("See also: Refund & Cancellation Policy"). */
export type LegalLink = { label: string; page: LegalPageId };

export type LegalSection = {
  id: string;
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  /** Optional trailing paragraphs rendered after the bullets. */
  after?: string[];
  links?: LegalLink[];
};

export type LegalDocument = {
  title: string;
  /** Short name for footers and settings rows. */
  shortTitle: string;
  effectiveDate: string;
  intro: string[];
  sections: LegalSection[];
};

/** A config value that still needs the owner's input (see docs/legal.md). */
export function isLegalPlaceholder(value: string): boolean {
  return /^TODO\b/i.test(value.trim());
}

/** "2026-10-06" → "October 6, 2026" for the effective-date line. */
export function formatLegalDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}
