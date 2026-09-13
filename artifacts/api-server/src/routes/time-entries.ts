import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/** GET /api/time-entries/:shiftId — time entry for this shift+worker */
router.get('/:shiftId', requireAuth, async (req, res) => {
  const { data, error } = await adminDb
    .from('time_entries')
    .select('*')
    .eq('shift_id', req.params.shiftId)
    .eq('worker_id', req.userId)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data ?? null);
});

/** POST /api/time-entries — clock in */
router.post('/', requireAuth, async (req, res) => {
  const { shift_id } = req.body as Record<string, unknown>;
  if (!shift_id || typeof shift_id !== 'string') {
    return res.status(400).json({ error: 'shift_id is required' });
  }

  // Only a worker booked (accepted) onto this shift may clock in.
  const { count } = await adminDb
    .from('applications')
    .select('*', { count: 'exact', head: true })
    .eq('shift_id', shift_id)
    .eq('worker_id', req.userId)
    .eq('status', 'accepted');
  if (!count) {
    return res.status(403).json({ error: 'You are not booked for this shift.' });
  }

  const payload = { shift_id, worker_id: req.userId, clock_in: new Date().toISOString() };
  const { data, error } = await adminDb
    .from('time_entries')
    .upsert(payload, { onConflict: 'shift_id,worker_id', ignoreDuplicates: true })
    .select()
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(409).json({ error: 'Already clocked in' });
  return res.status(201).json(data);
});

/** PATCH /api/time-entries/:id — clock out / update */
router.patch('/:id', requireAuth, async (req, res) => {
  const { clock_out, break_minutes, total_hours, total_pay, fee } = req.body as Record<string, unknown>;

  // Mirror the SQL COALESCE($n, col): only overwrite columns that were supplied.
  const updates: Record<string, unknown> = {};
  if (clock_out != null) updates.clock_out = clock_out;
  if (break_minutes != null) updates.break_minutes = break_minutes;
  if (total_hours != null) updates.total_hours = total_hours;
  if (total_pay != null) updates.total_pay = total_pay;
  if (fee != null) updates.fee = fee;

  let data: unknown;
  let error: { message: string } | null;
  if (Object.keys(updates).length === 0) {
    // No fields supplied: the original UPDATE was a no-op that still returned the
    // existing row (or 404). Reproduce that with a plain fetch.
    ({ data, error } = await adminDb
      .from('time_entries')
      .select('*')
      .eq('id', req.params.id)
      .eq('worker_id', req.userId)
      .maybeSingle());
  } else {
    ({ data, error } = await adminDb
      .from('time_entries')
      .update(updates)
      .eq('id', req.params.id)
      .eq('worker_id', req.userId)
      .select()
      .maybeSingle());
  }
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Not found' });
  return res.json(data);
});

export default router;
