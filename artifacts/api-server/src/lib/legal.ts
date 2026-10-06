/**
 * Current legal document versions — the single source of truth.
 *
 * The frontend mirrors these in artifacts/365-connect/src/legal/config.ts and
 * fetches them from GET /legal/versions at runtime, falling back to its copy
 * only when the API is unreachable. Bumping a version here (and in the app's
 * documents) makes every user see the acceptance gate once. See docs/legal.md.
 */
import { adminDb } from './supabaseAdmin.js';

export type LegalDocumentId = 'terms' | 'privacy';
export const LEGAL_DOCUMENT_IDS: readonly LegalDocumentId[] = ['terms', 'privacy'] as const;

export const LEGAL_VERSIONS: Record<LegalDocumentId, { version: string; effectiveDate: string }> = {
  terms:   { version: '2026-10-06', effectiveDate: '2026-10-06' },
  privacy: { version: '2026-10-06', effectiveDate: '2026-10-06' },
};

/** The snake_case shape GET /legal/versions and /legal/status return. */
export function currentVersionsBody() {
  return {
    terms:   { version: LEGAL_VERSIONS.terms.version,   effective_date: LEGAL_VERSIONS.terms.effectiveDate },
    privacy: { version: LEGAL_VERSIONS.privacy.version, effective_date: LEGAL_VERSIONS.privacy.effectiveDate },
  };
}

/** True when both accepted versions match the current ones. */
export function isCurrent(terms: string | null | undefined, privacy: string | null | undefined): boolean {
  return terms === LEGAL_VERSIONS.terms.version && privacy === LEGAL_VERSIONS.privacy.version;
}

// ── Per-user "has accepted the current versions" cache ──────────────────────
// Consulted by requireLegal on every authenticated write. Short-lived so that
// an acceptance recorded by another serverless instance is seen within
// seconds; dropped at once on this instance when the user accepts.
const TTL_MS = 20_000;
const MAX_ENTRIES = 5_000;
const cache = new Map<string, { current: boolean; expires: number }>();

export async function userLegalIsCurrent(userId: string): Promise<boolean> {
  const hit = cache.get(userId);
  if (hit && hit.expires > Date.now()) return hit.current;

  const { data } = await adminDb
    .from('users')
    .select('terms_version, privacy_version')
    .eq('id', userId)
    .maybeSingle();
  const current = isCurrent(data?.terms_version as string | null, data?.privacy_version as string | null);

  // Only cache rows that exist and are current; a user mid-acceptance gets the
  // fresh answer on the next request rather than a cached "no".
  if (data && current) {
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
    cache.set(userId, { current, expires: Date.now() + TTL_MS });
  }
  return current;
}

export function invalidateLegal(userId: string): void {
  cache.delete(userId);
}
