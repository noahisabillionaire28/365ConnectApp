/**
 * Legal documents — current versions, the caller's acceptance status, and
 * recording acceptance. Status and accept use requireSession (not
 * requireAuth) so a user can accept before their profile row is complete and
 * regardless of moderation status; the acceptance gate in the app depends on
 * these two routes rendering for everyone who is signed in.
 */
import { Router } from 'express';
import { z } from 'zod';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireSession } from '../middleware/auth.js';
import { sendError } from '../lib/httpError.js';
import { clientIp } from '../lib/rateLimit.js';
import {
  LEGAL_VERSIONS, LEGAL_DOCUMENT_IDS, currentVersionsBody, isCurrent, invalidateLegal, type LegalDocumentId,
} from '../lib/legal.js';

const router = Router();

type AcceptanceRow = { document: LegalDocumentId; version: string; accepted_at: string };

/** Latest acceptance per document for a user, plus the gating columns on users. */
async function statusFor(userId: string) {
  const [{ data: rows, error: rErr }, { data: user, error: uErr }] = await Promise.all([
    adminDb
      .from('legal_acceptances')
      .select('document, version, accepted_at')
      .eq('user_id', userId)
      .order('accepted_at', { ascending: false })
      .limit(50),
    adminDb.from('users').select('terms_version, privacy_version').eq('id', userId).maybeSingle(),
  ]);
  if (rErr) throw rErr;
  if (uErr) throw uErr;

  const latest: Record<LegalDocumentId, AcceptanceRow | null> = { terms: null, privacy: null };
  for (const r of (rows ?? []) as AcceptanceRow[]) {
    if ((r.document === 'terms' || r.document === 'privacy') && !latest[r.document]) latest[r.document] = r;
  }

  // Gate on the users columns (what requireLegal checks); the acceptance rows
  // supply the dates.
  const termsV = (user?.terms_version as string | null) ?? latest.terms?.version ?? null;
  const privacyV = (user?.privacy_version as string | null) ?? latest.privacy?.version ?? null;
  const needs = !isCurrent(termsV, privacyV);
  const everAccepted = !!(termsV || privacyV);

  return {
    current: currentVersionsBody(),
    accepted: {
      terms:   latest.terms   ? { version: latest.terms.version,   accepted_at: latest.terms.accepted_at }   : null,
      privacy: latest.privacy ? { version: latest.privacy.version, accepted_at: latest.privacy.accepted_at } : null,
    },
    needs_acceptance: needs,
    outdated: needs && everAccepted,
  };
}

/** GET /api/legal/versions — public: current versions and effective dates. */
router.get('/versions', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.json(currentVersionsBody());
});

/** GET /api/legal/status — what the caller has accepted and whether the gate must show. */
router.get('/status', requireSession, async (req, res) => {
  try {
    return res.json(await statusFor(req.userId!));
  } catch (e) {
    return sendError(res, e);
  }
});

const acceptBody = z.object({
  documents: z.array(z.enum(['terms', 'privacy'])).min(1).max(2),
});

/**
 * POST /api/legal/accept { documents: ['terms','privacy'] } — record that the
 * caller accepted the CURRENT version of each listed document. Idempotent: a
 * repeat for a version already on file adds no row. Updates users.*_version
 * so requireLegal can gate on one indexed read.
 */
router.post('/accept', requireSession, async (req, res) => {
  try {
    const parsed = acceptBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
    const userId = req.userId!;
    const docs = [...new Set(parsed.data.documents)].filter((d): d is LegalDocumentId => LEGAL_DOCUMENT_IDS.includes(d));

    // The acceptance row references users; make sure the profile row exists
    // (a brand-new account may accept before onboarding has filled it in).
    // Only the id is written, so nothing existing is overwritten.
    const { error: upErr } = await adminDb
      .from('users')
      .upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true });
    if (upErr) throw upErr;

    const { data: existing, error: exErr } = await adminDb
      .from('legal_acceptances')
      .select('document, version')
      .eq('user_id', userId)
      .in('document', docs);
    if (exErr) throw exErr;
    const already = new Set((existing ?? []).map((r) => `${r.document}:${r.version}`));

    const ip = clientIp(req);
    const ua = (req.get('user-agent') ?? '').slice(0, 512) || null;
    const inserts = docs
      .filter((d) => !already.has(`${d}:${LEGAL_VERSIONS[d].version}`))
      .map((d) => ({ user_id: userId, document: d, version: LEGAL_VERSIONS[d].version, ip, user_agent: ua }));
    if (inserts.length) {
      const { error } = await adminDb.from('legal_acceptances').insert(inserts);
      if (error) throw error;
    }

    const patch: Record<string, string> = {};
    if (docs.includes('terms'))   patch.terms_version   = LEGAL_VERSIONS.terms.version;
    if (docs.includes('privacy')) patch.privacy_version = LEGAL_VERSIONS.privacy.version;
    const { error: uErr } = await adminDb.from('users').update(patch).eq('id', userId);
    if (uErr) throw uErr;
    invalidateLegal(userId);

    return res.json(await statusFor(userId));
  } catch (e) {
    return sendError(res, e);
  }
});

export default router;
