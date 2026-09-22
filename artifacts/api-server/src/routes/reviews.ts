import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { sendError } from '../lib/httpError.js';

const router = Router();

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
