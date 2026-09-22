/**
 * Match insights.
 *   GET /api/match/shift/:id   — owner: ranked candidates (pending/standby/accepted) with reasons
 *   GET /api/match/me/:id      — worker: my own score + reason for this shift
 * Add ?refresh=1 to bypass the cache.
 */
import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { assertShiftOwner } from '../lib/shiftAccess.js';
import { sendError } from '../lib/httpError.js';
import { insightsFor, aiConfigured, type Shift } from '../lib/matching.js';

const router = Router();
const SHIFT_COLS = 'id, client_id, title, description, job_type, job_types, event_type, start_time, end_time, timezone, lat, lng, pay_rate, requirements';

async function loadFull(id: string): Promise<Shift | null> {
  const { data } = await adminDb.from('shifts').select(SHIFT_COLS).eq('id', id).maybeSingle();
  return (data as Shift | null) ?? null;
}

router.get('/shift/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  try {
    await assertShiftOwner(id, req.userId!);
    const shift = await loadFull(id);
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    const { data: apps } = await adminDb
      .from('applications').select('worker_id, status').eq('shift_id', id)
      .in('status', ['pending', 'standby', 'accepted']);
    const ids = (apps ?? []).map((a) => a.worker_id as string);
    const insights = await insightsFor(shift, ids, { force: req.query.refresh === '1' });
    return res.json({
      ai: aiConfigured(),
      candidates: insights.map((i) => ({
        worker_id: i.worker_id, score: i.score, reason: i.reason, source: i.source,
        history: {
          shifts_with_you: i.signals.shiftsWithThisPoster, shifts_worked: i.signals.shiftsWorked,
          no_shows: i.signals.noShows, on_time_rate: i.signals.onTimeRate, distance_miles: i.signals.distanceMiles,
        },
      })),
    });
  } catch (e) { return sendError(res, e); }
});

router.get('/me/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  try {
    const shift = await loadFull(id);
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    const [i] = await insightsFor(shift, [req.userId!], { force: req.query.refresh === '1' });
    if (!i) return res.status(404).json({ error: 'No insight' });
    return res.json({ ai: aiConfigured(), score: i.score, reason: i.reason, source: i.source });
  } catch (e) { return sendError(res, e); }
});

export default router;
