import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { createNotification } from './notifications.js';

const router = Router();

const OT_THRESHOLD = 8;    // hours per shift before overtime
const OT_MULTIPLIER = 1.5; // overtime pay multiplier

/**
 * POST /api/time-entries/:id/approve — the shift owner/staffer approves a
 * clocked-out timesheet. Computes regular vs overtime hours and the final
 * approved pay. Only after this can the worker be paid.
 * Body: { total_hours?, break_minutes? } — manager's confirmed billable hours.
 */
router.post('/approve', requireAuth, async (req, res) => {
  try {
    const { shift_id, worker_id } = req.body as { shift_id?: string; worker_id?: string };
    if (!shift_id || !worker_id) return res.status(400).json({ error: 'shift_id and worker_id are required' });
    const { data: entry } = await adminDb
      .from('time_entries').select('*')
      .eq('shift_id', shift_id).eq('worker_id', worker_id).maybeSingle();
    if (!entry) return res.status(404).json({ error: 'Timesheet not found' });
    if (!entry.clock_out) return res.status(409).json({ error: 'Worker has not clocked out yet.' });

    const { data: shift } = await adminDb
      .from('shifts').select('client_id, pay_rate, title').eq('id', entry.shift_id).maybeSingle();
    if (!shift) return res.status(404).json({ error: 'Shift not found' });

    // Authorize: shift owner, a staffer, or an admin.
    const { data: me } = await adminDb
      .from('users').select('role, is_admin').eq('id', req.userId).maybeSingle();
    const isPrivileged = shift.client_id === req.userId
      || me?.role === 'staffer' || me?.role === 'admin' || me?.is_admin === true;
    if (!isPrivileged) return res.status(403).json({ error: 'Forbidden' });

    // Billable hours: manager override, else clocked minus break.
    const body = req.body as { total_hours?: number; break_minutes?: number };
    const breakMin = body.break_minutes ?? entry.break_minutes ?? 0;
    let billable: number;
    if (typeof body.total_hours === 'number' && Number.isFinite(body.total_hours)) {
      billable = Math.max(0, body.total_hours);
    } else {
      const grossH = (Date.parse(entry.clock_out) - Date.parse(entry.clock_in)) / 3_600_000;
      billable = Math.max(0, grossH - breakMin / 60);
    }
    billable = Math.round(billable * 100) / 100;

    const regular = Math.min(billable, OT_THRESHOLD);
    const overtime = Math.max(0, billable - OT_THRESHOLD);
    const rate = Number(shift.pay_rate ?? 0);
    const pay = Math.round((regular * rate + overtime * rate * OT_MULTIPLIER) * 100) / 100;

    const { data: updated, error } = await adminDb
      .from('time_entries')
      .update({
        approved: true,
        approved_at: new Date().toISOString(),
        approved_by: req.userId,
        break_minutes: breakMin,
        total_hours: billable,
        regular_hours: regular,
        overtime_hours: overtime,
        total_pay: pay,
        approved_pay: pay,
      })
      .eq('id', entry.id)
      .select().single();
    if (error) return res.status(500).json({ error: error.message });

    await createNotification({
      userId: entry.worker_id,
      fromUserId: req.userId,
      type: 'timesheet_approved',
      title: 'Timesheet approved',
      body: `Your hours for ${shift.title ? `"${shift.title}"` : 'the shift'} were approved (${billable}h${overtime > 0 ? `, ${overtime}h OT` : ''}). Payment is on its way.`,
      shiftId: entry.shift_id,
    });
    return res.json(updated);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

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

  // Clock-in window: not more than 1 hour before the shift's start (call time).
  const { data: sh } = await adminDb
    .from('shifts').select('start_time').eq('id', shift_id).maybeSingle();
  const startMs = sh?.start_time ? Date.parse(sh.start_time) : NaN;
  if (Number.isFinite(startMs) && Date.now() < startMs - 60 * 60 * 1000) {
    return res.status(409).json({ error: 'Clock-in has not opened for this shift yet.' });
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
