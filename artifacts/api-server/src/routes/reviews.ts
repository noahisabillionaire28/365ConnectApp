import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { sendError } from '../lib/httpError.js';

const router = Router();

const PENDING_WINDOW_MS = 7 * 24 * 3600_000;
const PENDING_LIMIT = 5;

export type PendingReview = {
  shift_id: string;
  title: string | null;
  /** The shift's start instant (ISO). */
  date: string | null;
  counterpart_id: string;
  counterpart_name: string | null;
  role: 'worker' | 'poster';
};

/**
 * GET /api/reviews/pending — shifts from the last 7 days the caller has not
 * rated yet: as a worker, the poster of each completed shift they were booked
 * on; as a poster, each completed shift with a booked worker they have not
 * reviewed (the first unrated worker is the counterpart). Newest first, at
 * most 5. Drives the "Rate your last shift" / "Rate your crew" home cards.
 */
router.get('/pending', requireAuth, async (req, res) => {
  try {
    const me = req.userId!;
    const now = Date.now();
    const sinceISO = new Date(now - PENDING_WINDOW_MS).toISOString();
    const nowISO = new Date(now).toISOString();
    const items: PendingReview[] = [];

    // ── As a worker ─────────────────────────────────────────────────────────
    const { data: myApps, error: aErr } = await adminDb
      .from('applications').select('shift_id').eq('worker_id', me).eq('status', 'accepted');
    if (aErr) return res.status(500).json({ error: aErr.message });
    const workedIds = [...new Set((myApps ?? []).map((a) => a.shift_id).filter(Boolean))];
    if (workedIds.length) {
      const { data: shifts } = await adminDb
        .from('shifts')
        .select('id, title, client_id, start_time, end_time, company_name, status')
        .in('id', workedIds)
        .neq('status', 'cancelled')
        .gte('end_time', sinceISO)
        .lte('end_time', nowISO);
      const list = shifts ?? [];
      if (list.length) {
        const { data: mine } = await adminDb
          .from('reviews').select('shift_id').eq('reviewer_id', me).in('shift_id', list.map((s) => s.id));
        const rated = new Set((mine ?? []).map((r) => r.shift_id));
        const posterIds = [...new Set(list.map((s) => s.client_id).filter(Boolean))];
        const { data: posters } = posterIds.length
          ? await adminDb.from('users').select('id, username, company_name').in('id', posterIds)
          : { data: [] as { id: string; username: string | null; company_name: string | null }[] };
        const posterMap = new Map((posters ?? []).map((u) => [u.id, u]));
        for (const s of list) {
          if (!s.client_id || s.client_id === me || rated.has(s.id)) continue;
          const p = posterMap.get(s.client_id);
          items.push({
            shift_id: s.id, title: s.title ?? null, date: s.start_time ?? null,
            counterpart_id: s.client_id,
            counterpart_name: s.company_name || p?.company_name || (p?.username ? `@${p.username}` : null),
            role: 'worker',
          });
        }
      }
    }

    // ── As a poster ─────────────────────────────────────────────────────────
    const { data: posted } = await adminDb
      .from('shifts')
      .select('id, title, start_time, end_time, status')
      .eq('client_id', me)
      .neq('status', 'cancelled')
      .gte('end_time', sinceISO)
      .lte('end_time', nowISO);
    const postedList = posted ?? [];
    if (postedList.length) {
      const ids = postedList.map((s) => s.id);
      const [{ data: crew }, { data: given }] = await Promise.all([
        adminDb.from('applications').select('shift_id, worker_id').in('shift_id', ids).eq('status', 'accepted'),
        adminDb.from('reviews').select('shift_id, reviewee_id').eq('reviewer_id', me).in('shift_id', ids),
      ]);
      const ratedPairs = new Set((given ?? []).map((r) => `${r.shift_id}:${r.reviewee_id}`));
      const unrated = new Map<string, string>(); // shift → first unrated worker
      for (const c of crew ?? []) {
        if (ratedPairs.has(`${c.shift_id}:${c.worker_id}`) || unrated.has(c.shift_id)) continue;
        unrated.set(c.shift_id, c.worker_id);
      }
      const workerIds = [...new Set(unrated.values())];
      const { data: workers } = workerIds.length
        ? await adminDb.from('users').select('id, username').in('id', workerIds)
        : { data: [] as { id: string; username: string | null }[] };
      const nameMap = new Map((workers ?? []).map((u) => [u.id, u.username]));
      for (const s of postedList) {
        const w = unrated.get(s.id);
        if (!w) continue;
        const username = nameMap.get(w);
        items.push({
          shift_id: s.id, title: s.title ?? null, date: s.start_time ?? null,
          counterpart_id: w, counterpart_name: username ? `@${username}` : null, role: 'poster',
        });
      }
    }

    items.sort((a, b) => Date.parse(b.date ?? '') - Date.parse(a.date ?? ''));
    return res.json(items.slice(0, PENDING_LIMIT));
  } catch (e) {
    return sendError(res, e);
  }
});

/** GET /api/reviews/:userId — reviews for a user */
router.get('/:userId', async (req, res) => {
  let viewerRole: string | null = null;
  if (req.userId) {
    const { data: viewer } = await adminDb
      .from('users')
      .select('role')
      .eq('id', req.userId)
      .maybeSingle();
    viewerRole = viewer?.role ?? null;
  }
  const isClientOrStaffer = viewerRole === 'client' || viewerRole === 'staffer';

  const { data: reviews, error } = await adminDb
    .from('reviews')
    .select('id, shift_id, reviewer_id, reviewee_id, rating, comment, positive_tags, negative_tags, created_at')
    .eq('reviewee_id', req.params.userId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const rows = reviews ?? [];

  // Flatten the reviewer (users) columns via a second query + merge, so the
  // response keeps the flat reviewer_username / reviewer_photo field names.
  const reviewerIds = [...new Set(rows.map((r) => r.reviewer_id).filter((id) => id != null))];
  const reviewerMap = new Map<string, { username: string | null; photo_url: string | null }>();
  if (reviewerIds.length) {
    const { data: reviewers, error: rErr } = await adminDb
      .from('users')
      .select('id, username, photo_url')
      .in('id', reviewerIds);
    if (rErr) return res.status(500).json({ error: rErr.message });
    for (const u of reviewers ?? []) {
      reviewerMap.set(u.id, { username: u.username, photo_url: u.photo_url });
    }
  }

  const result = rows.map((r) => {
    const reviewer = reviewerMap.get(r.reviewer_id);
    return {
      id: r.id,
      shift_id: r.shift_id,
      reviewer_id: r.reviewer_id,
      reviewee_id: r.reviewee_id,
      rating: r.rating,
      comment: r.comment,
      positive_tags: r.positive_tags,
      negative_tags: isClientOrStaffer ? r.negative_tags : [],
      created_at: r.created_at,
      reviewer_username: reviewer?.username ?? null,
      reviewer_photo: reviewer?.photo_url ?? null,
    };
  });
  return res.json(result);
});

/** Application statuses that count as "worked (or was booked for) the shift". */
const PARTICIPANT_STATUSES = ['accepted', 'no_show'];

async function hasParticipantApplication(shiftId: string, workerId: string): Promise<boolean> {
  const { count } = await adminDb
    .from('applications')
    .select('*', { count: 'exact', head: true })
    .eq('shift_id', shiftId)
    .eq('worker_id', workerId)
    .in('status', PARTICIPANT_STATUSES);
  return (count ?? 0) > 0;
}

/**
 * POST /api/reviews — create review. The reviewer must have participated in
 * the shift: either they own the shift and the reviewee was booked on it
 * (accepted / no_show), or they were booked on it and the reviewee is the
 * shift owner. 403 otherwise.
 */
router.post('/', requireAuth, async (req, res) => {
  const { shift_id, reviewee_id, rating, comment, positive_tags, negative_tags } = req.body as Record<string, unknown>;
  if (!shift_id || typeof shift_id !== 'string' || !reviewee_id || typeof reviewee_id !== 'string') {
    return res.status(400).json({ error: 'shift_id and reviewee_id are required' });
  }
  const ratingNum = Number(rating);
  if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ error: 'rating must be between 1 and 5' });
  }
  if (reviewee_id === req.userId) return res.status(409).json({ error: "You can't review yourself." });

  try {
    const { data: shift, error: sErr } = await adminDb
      .from('shifts').select('id, client_id').eq('id', shift_id).maybeSingle();
    if (sErr) return res.status(500).json({ error: sErr.message });
    if (!shift) return res.status(404).json({ error: 'Shift not found' });

    let allowed = false;
    if (shift.client_id === req.userId) {
      // Owner reviewing a worker who was booked on the shift.
      allowed = await hasParticipantApplication(shift_id, reviewee_id);
    } else if (reviewee_id === shift.client_id) {
      // Worker reviewing the shift owner — the worker must have been booked.
      allowed = await hasParticipantApplication(shift_id, req.userId!);
    }
    if (!allowed) return res.status(403).json({ error: 'You can only review people you worked this shift with.' });

    const payload = {
      shift_id,
      reviewer_id: req.userId,
      reviewee_id,
      rating: ratingNum,
      comment: typeof comment === 'string' ? comment : null,
      positive_tags: Array.isArray(positive_tags) ? positive_tags : [],
      negative_tags: Array.isArray(negative_tags) ? negative_tags : [],
    };
    const { data, error } = await adminDb
      .from('reviews')
      .upsert(payload, { onConflict: 'shift_id,reviewer_id,reviewee_id', ignoreDuplicates: true })
      .select()
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(409).json({ error: 'Review already submitted' });
    return res.status(201).json(data);
  } catch (e) {
    return sendError(res, e);
  }
});

export default router;
