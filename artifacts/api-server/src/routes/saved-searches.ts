/**
 * Saved search alerts — a worker keeps up to three filter sets and the cron
 * (routes/cron.ts, alertSavedSearches) notifies them when a new open public
 * shift matches one.
 */
import { Router } from 'express';
import { z } from 'zod';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendError } from '../lib/httpError.js';

const router = Router();

export const MAX_SAVED_SEARCHES = 3;

const SELECT = 'id, user_id, job_types, max_distance_miles, min_pay, event_type, created_at, last_notified_at';

const createBody = z.object({
  job_types: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
  max_distance_miles: z.coerce.number().positive().max(500).nullable().optional(),
  min_pay: z.coerce.number().positive().max(10_000).nullable().optional(),
  event_type: z.string().trim().min(1).max(60).nullable().optional(),
}).refine(
  (b) => b.job_types.length > 0 || b.max_distance_miles != null || b.min_pay != null || !!b.event_type,
  { message: 'Pick at least one filter to save.' },
);

/** GET /api/saved-searches — the caller's saved searches, newest first. */
router.get('/', requireAuth, requireRole('worker'), async (req, res) => {
  const { data, error } = await adminDb
    .from('saved_searches').select(SELECT)
    .eq('user_id', req.userId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data ?? []);
});

/** POST /api/saved-searches — save the current filters (max 3 per user). */
router.post('/', requireAuth, requireRole('worker'), async (req, res) => {
  try {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
    const b = parsed.data;

    const { count, error: cErr } = await adminDb
      .from('saved_searches').select('*', { count: 'exact', head: true }).eq('user_id', req.userId);
    if (cErr) return res.status(500).json({ error: cErr.message });
    if ((count ?? 0) >= MAX_SAVED_SEARCHES) {
      return res.status(409).json({ error: `You can save up to ${MAX_SAVED_SEARCHES} searches. Remove one first.` });
    }

    const { data, error } = await adminDb
      .from('saved_searches')
      .insert({
        user_id: req.userId,
        job_types: b.job_types,
        max_distance_miles: b.max_distance_miles ?? null,
        min_pay: b.min_pay ?? null,
        event_type: b.event_type ?? null,
      })
      .select(SELECT).single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  } catch (e) {
    return sendError(res, e);
  }
});

/** DELETE /api/saved-searches/:id — remove one of the caller's saved searches. */
router.delete('/:id', requireAuth, requireRole('worker'), async (req, res) => {
  const { error } = await adminDb
    .from('saved_searches').delete()
    .eq('id', String(req.params.id)).eq('user_id', req.userId);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

export default router;
