import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';

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

/** POST /api/reviews — create review */
router.post('/', requireAuth, async (req, res) => {
  const { shift_id, reviewee_id, rating, comment, positive_tags, negative_tags } = req.body as Record<string, unknown>;
  const payload = {
    shift_id,
    reviewer_id: req.userId,
    reviewee_id,
    rating,
    comment: comment ?? null,
    positive_tags: positive_tags ?? [],
    negative_tags: negative_tags ?? [],
  };
  const { data, error } = await adminDb
    .from('reviews')
    .upsert(payload, { onConflict: 'shift_id,reviewer_id,reviewee_id', ignoreDuplicates: true })
    .select()
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(409).json({ error: 'Review already submitted' });
  return res.status(201).json(data);
});

export default router;
