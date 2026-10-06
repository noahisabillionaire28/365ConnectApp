/**
 * Legal documents: current versions (public), the signed-in user's acceptance
 * status, and the accept mutation. Query keys live under ['legal', ...].
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { LEGAL, type LegalDocumentId } from '@/legal/config';

type VersionRow = { version: string; effective_date: string };
type VersionsResponse = { terms: VersionRow; privacy: VersionRow };
type StatusResponse = {
  current: VersionsResponse;
  accepted: { terms: { version: string; accepted_at: string } | null; privacy: { version: string; accepted_at: string } | null };
  needs_acceptance: boolean;
  /** True when the user accepted an earlier version (so the gate says "We've updated our Terms"). */
  outdated: boolean;
};

export type LegalVersion = { version: string; effectiveDate: string };
export type LegalVersions = Record<LegalDocumentId, LegalVersion>;
export type LegalStatus = {
  current: LegalVersions;
  accepted: Record<LegalDocumentId, { version: string; acceptedAt: string } | null>;
  needsAcceptance: boolean;
  outdated: boolean;
  /** Most recent acceptance of either document, for "You accepted on …". */
  acceptedAt: string | null;
};

export const legalKeys = {
  versions: ['legal', 'versions'] as const,
  status: (userId: string | null | undefined) => ['legal', 'status', userId ?? 'anon'] as const,
};

const FALLBACK_VERSIONS: LegalVersions = {
  terms:   { version: LEGAL.termsVersion,   effectiveDate: LEGAL.termsVersion },
  privacy: { version: LEGAL.privacyVersion, effectiveDate: LEGAL.privacyVersion },
};

function toVersions(v: VersionsResponse): LegalVersions {
  return {
    terms:   { version: v.terms.version,   effectiveDate: v.terms.effective_date },
    privacy: { version: v.privacy.version, effectiveDate: v.privacy.effective_date },
  };
}

function toStatus(s: StatusResponse): LegalStatus {
  const acc = (r: { version: string; accepted_at: string } | null) => (r ? { version: r.version, acceptedAt: r.accepted_at } : null);
  const dates = [s.accepted.terms?.accepted_at, s.accepted.privacy?.accepted_at].filter((d): d is string => !!d).sort();
  return {
    current: toVersions(s.current),
    accepted: { terms: acc(s.accepted.terms), privacy: acc(s.accepted.privacy) },
    needsAcceptance: s.needs_acceptance,
    outdated: s.outdated,
    acceptedAt: dates.length ? dates[dates.length - 1]! : null,
  };
}

/** Current document versions; falls back to the bundled constants offline. */
export function useLegalVersions() {
  return useQuery<LegalVersions, Error>({
    queryKey: legalKeys.versions,
    staleTime: 60 * 60_000,
    retry: 1,
    placeholderData: FALLBACK_VERSIONS,
    queryFn: async () => toVersions(await apiClient(null).get<VersionsResponse>('/legal/versions')),
  });
}

/** What the signed-in user has accepted and whether the gate must show. */
export function useLegalStatus() {
  const { user } = useAuth();
  return useQuery<LegalStatus, Error>({
    queryKey: legalKeys.status(user?.id),
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => toStatus(await apiClient(user!.id).get<StatusResponse>('/legal/status')),
  });
}

/** Record acceptance of both documents (idempotent on the server). */
export function useAcceptLegal() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation<LegalStatus, Error, LegalDocumentId[] | void>({
    mutationFn: async (docs) => toStatus(
      await apiClient(user?.id).post<StatusResponse>('/legal/accept', { documents: docs ?? ['terms', 'privacy'] }),
    ),
    onSuccess: (status) => {
      qc.setQueryData(legalKeys.status(user?.id), status);
    },
  });
}

/** Fire-and-forget acceptance right after sign-up (the row must already exist). */
export async function recordLegalAcceptance(userId: string): Promise<void> {
  await apiClient(userId).post('/legal/accept', { documents: ['terms', 'privacy'] });
}
