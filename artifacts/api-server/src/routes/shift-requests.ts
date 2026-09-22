import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createNotification } from './notifications.js';
import { findTimeConflict } from './applications.js';
import { addWorkerToShiftChat } from '../lib/chat.js';
import { HttpError, sendError } from '../lib/httpError.js';
import { assertShiftOwner } from '../lib/shiftAccess.js';
import { bookWorker, isAcceptingWorkers, MSG_CLOSED, MSG_FULL } from '../lib/booking.js';

const router = Router();

/** Max workers invited by one broadcast call. */
const BROADCAST_CAP = 200;

/** GET /api/shift-requests?shift_id= — my shift requests (worker or client) */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { shift_id } = req.query as Record<string, string | undefined>;
    let q = adminDb
      .from('shift_requests')
      .select('*')
      .or(`worker_id.eq.${req.userId},client_id.eq.${req.userId}`);
    if (shift_id) q = q.eq('shift_id', shift_id);
    const { data: requests, error } = await q.order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    const rows = requests ?? [];
    const shiftIds = [...new Set(rows.map((r: any) => r.shift_id).filter((id: any) => id != null))];
    const workerIds = [...new Set(rows.map((r: any) => r.worker_id).filter((id: any) => id != null))];

    let shiftsById = new Map<string, any>();
    if (shiftIds.length) {
      const { data: shifts, error: shiftsError } = await adminDb
        .from('shifts')
        .select('id, title, job_type, start_time, end_time, location, pay_rate, pay_period, company_name')
        .in('id', shiftIds);
      if (shiftsError) return res.status(500).json({ error: shiftsError.message });
      shiftsById = new Map((shifts ?? []).map((s: any) => [s.id, s]));
    }

    let workersById = new Map<string, any>();
    if (workerIds.length) {
      const { data: workers, error: workersError } = await adminDb
        .from('users')
        .select('id, username, photo_url')
        .in('id', workerIds);
      if (workersError) return res.status(500).json({ error: workersError.message });
      workersById = new Map((workers ?? []).map((w: any) => [w.id, w]));
    }

    const merged = rows.map((r: any) => {
      const s = shiftsById.get(r.shift_id);
      const w = workersById.get(r.worker_id);
      return {
        ...r,
        shift_title: s?.title ?? null,
        job_type: s?.job_type ?? null,
        start_time: s?.start_time ?? null,
        end_time: s?.end_time ?? null,
        location: s?.location ?? null,
        pay_rate: s?.pay_rate ?? null,
        pay_period: s?.pay_period ?? null,
        company_name: s?.company_name ?? null,
        worker_username: w?.username ?? null,
        worker_photo: w?.photo_url ?? null,
      };
    });
    return res.json(merged);
  } catch (e) {
    return sendError(res, e);
  }
});

/** POST /api/shift-requests — create a shift request (owner invites one worker) */
router.post('/', requireAuth, requireRole('client', 'staffer'), async (req, res) => {
  const { shift_id, worker_id, message } = req.body as Record<string, string>;
  if (!shift_id || !worker_id) {
    return res.status(400).json({ error: 'shift_id and worker_id are required' });
  }
  try {
    const shift = await assertShiftOwner(shift_id, req.userId!);
    if (!isAcceptingWorkers(shift)) return res.status(409).json({ error: MSG_CLOSED });
    if (worker_id === req.userId) return res.status(409).json({ error: "You can't request yourself." });

    const { data, error } = await adminDb
      .from('shift_requests')
      .upsert(
        { shift_id, client_id: req.userId, worker_id, message: message ?? null },
        { onConflict: 'shift_id,worker_id', ignoreDuplicates: true },
      )
      .select()
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(409).json({ error: 'Request already exists' });

    const { data: w } = await adminDb.from('users').select('username').eq('id', worker_id).maybeSingle();
    const label = shift.title ? `"${shift.title}"` : 'a shift';
    // Notify the invited worker.
    await createNotification({
      userId: worker_id,
      fromUserId: req.userId,
      type: 'shift_invite',
      title: 'Shift request',
      body: `You've been requested for ${label}. Accept to claim your spot.`,
      shiftId: shift_id,
    });
    // Receipt to the requester.
    await createNotification({
      userId: req.userId!,
      fromUserId: worker_id,
      type: 'receipt',
      title: 'Request sent',
      body: `You requested ${w?.username ? `@${w.username}` : 'a worker'} for ${label}.`,
      shiftId: shift_id,
    });
    return res.status(201).json(data);
  } catch (e) {
    return sendError(res, e);
  }
});

/** Case-insensitive job-type overlap between a worker and a shift. */
function matchesJobTypes(
  worker: { job_types: string[] | null; primary_job_type: string | null },
  wanted: Set<string>,
): boolean {
  if (!wanted.size) return true;
  const mine = new Set<string>();
  for (const t of worker.job_types ?? []) if (typeof t === 'string') mine.add(t.trim().toLowerCase());
  if (worker.primary_job_type) mine.add(worker.primary_job_type.trim().toLowerCase());
  for (const t of mine) if (wanted.has(t)) return true;
  return false;
}

/**
 * POST /api/shift-requests/broadcast — invite matching workers to a shift at once.
 * Owner (or admin) only. Targets available workers whose job types overlap the
 * shift's (all available workers when the shift has none), skips anyone who
 * already has a request or application for the shift, caps at 200 per call,
 * and only notifies the workers whose request rows were newly created.
 */
router.post('/broadcast', requireAuth, requireRole('client', 'staffer'), async (req, res) => {
  const { shift_id, message } = req.body as Record<string, string>;
  if (!shift_id) return res.status(400).json({ error: 'shift_id is required' });
  try {
    const shift = await assertShiftOwner(shift_id, req.userId!);
    if (!isAcceptingWorkers(shift)) return res.status(409).json({ error: MSG_CLOSED });

    // Job types the shift accepts (job_types[], falling back to job_type).
    const wanted = new Set<string>();
    for (const t of shift.job_types ?? []) if (typeof t === 'string' && t.trim()) wanted.add(t.trim().toLowerCase());
    if (!wanted.size && shift.job_type?.trim()) wanted.add(shift.job_type.trim().toLowerCase());

    // Available workers (is_available null counts as available).
    const { data: workers, error: wErr } = await adminDb
      .from('users')
      .select('id, job_types, primary_job_type, is_available')
      .eq('role', 'worker')
      .or('is_available.is.null,is_available.eq.true');
    if (wErr) return res.status(500).json({ error: wErr.message });

    // Anyone already invited to / applied for this shift.
    const [{ data: existingReqs }, { data: existingApps }] = await Promise.all([
      adminDb.from('shift_requests').select('worker_id').eq('shift_id', shift_id),
      adminDb.from('applications').select('worker_id').eq('shift_id', shift_id),
    ]);
    const skip = new Set<string>([req.userId!]);
    for (const r of existingReqs ?? []) skip.add(r.worker_id);
    for (const a of existingApps ?? []) skip.add(a.worker_id);
    if (shift.client_id) skip.add(shift.client_id);

    const targets = (workers ?? [])
      .filter((w) => w.is_available !== false)
      .filter((w) => !skip.has(w.id))
      .filter((w) => matchesJobTypes(w, wanted))
      .slice(0, BROADCAST_CAP)
      .map((w) => w.id);
    if (!targets.length) return res.json({ invited: 0, matched: 0 });

    // Insert a request row for each; RETURNING only yields the newly created rows.
    const rows = targets.map((worker_id) => ({
      shift_id, client_id: req.userId, worker_id, message: message ?? null,
    }));
    const { data: inserted, error: insErr } = await adminDb
      .from('shift_requests')
      .upsert(rows, { onConflict: 'shift_id,worker_id', ignoreDuplicates: true })
      .select('worker_id');
    if (insErr) return res.status(500).json({ error: insErr.message });
    const invitedIds = [...new Set((inserted ?? []).map((r) => r.worker_id as string))];

    // Notify (in-app + SSE + email via createNotification) only the newly invited.
    const label = shift.title ? `"${shift.title}"` : 'a shift';
    await Promise.all(invitedIds.map((worker_id) =>
      createNotification({
        userId: worker_id,
        fromUserId: req.userId,
        type: 'shift_invite',
        title: 'New shift available',
        body: `You've been invited to ${label}. Accept to claim your spot.`,
        shiftId: shift_id,
      }),
    ));
    // Receipt to the requester.
    if (invitedIds.length) {
      await createNotification({
        userId: req.userId!,
        type: 'receipt',
        title: 'Workers invited',
        body: `You invited ${invitedIds.length} worker${invitedIds.length === 1 ? '' : 's'} to ${label}.`,
        shiftId: shift_id,
      });
    }
    return res.json({ invited: invitedIds.length, matched: targets.length });
  } catch (e) {
    return sendError(res, e);
  }
});

/**
 * PATCH /api/shift-requests/:id — worker accepts or declines an invite.
 * Accepting BOOKS the worker (creates an accepted application) so they can clock
 * in — first-come up to the shift's headcount. When the shift is full the
 * worker is placed on standby (application + request both 'standby') and the
 * response is { status: 'standby' } so the UI can say "You're on standby".
 */
router.patch('/:id', requireAuth, async (req, res) => {
  const { status } = req.body as { status: 'accepted' | 'declined' };
  if (!['accepted', 'declined'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    // Load the request (must belong to this worker + still pending).
    const { data: reqRow, error: rErr } = await adminDb
      .from('shift_requests')
      .select('id, shift_id, client_id, worker_id, status')
      .eq('id', req.params.id)
      .eq('worker_id', req.userId)
      .maybeSingle();
    if (rErr) return res.status(500).json({ error: rErr.message });
    if (!reqRow) return res.status(404).json({ error: 'Not found or not authorized' });
    if (reqRow.status !== 'pending') return res.status(409).json({ error: 'Already decided' });

    // Decline is a simple status flip.
    if (status === 'declined') {
      const { data, error } = await adminDb
        .from('shift_requests').update({ status: 'declined' })
        .eq('id', reqRow.id).select().maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    }

    const { data: shift } = await adminDb
      .from('shifts')
      .select('id, title, client_id, status, end_time')
      .eq('id', reqRow.shift_id).maybeSingle();
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    const label = shift.title ? `"${shift.title}"` : 'a shift';

    // Don't book into a time-overlapping shift.
    const conflict = await findTimeConflict(req.userId!, reqRow.shift_id);
    if (conflict) {
      return res.status(409).json({
        error: `This overlaps a shift you're already booked for${conflict.title ? ` ("${conflict.title}")` : ''}.`,
      });
    }

    // Try to book; a full shift → standby, a closed/ended shift → 409.
    let booking: Record<string, unknown> | null = null;
    try {
      const r = await bookWorker(reqRow.shift_id, req.userId!, 'offer');
      booking = r.application as unknown as Record<string, unknown>;
    } catch (e) {
      if (!(e instanceof HttpError) || e.status !== 409 || e.message !== MSG_FULL) throw e;
      // Full → waitlist: application AND request go to 'standby'.
      const { data: standby, error: stErr } = await adminDb
        .from('applications')
        .upsert(
          { shift_id: reqRow.shift_id, worker_id: req.userId, status: 'standby' },
          { onConflict: 'shift_id,worker_id' },
        )
        .select().single();
      if (stErr) return res.status(500).json({ error: stErr.message });
      const { error: rqErr } = await adminDb
        .from('shift_requests').update({ status: 'standby' }).eq('id', reqRow.id);
      if (rqErr) return res.status(500).json({ error: rqErr.message });
      await createNotification({
        userId: req.userId!, fromUserId: shift.client_id, type: 'booking',
        title: "You're on standby",
        body: `${label} is full — you're on the waitlist. We'll notify you if a spot opens.`,
        shiftId: reqRow.shift_id,
      });
      return res.json({ status: 'standby', booking: standby });
    }

    // Booked → mark the request accepted.
    await adminDb.from('shift_requests').update({ status: 'accepted' }).eq('id', reqRow.id);
    await addWorkerToShiftChat(reqRow.shift_id, req.userId!);

    // Confirm to the worker.
    await createNotification({
      userId: req.userId!,
      fromUserId: shift.client_id,
      type: 'booking',
      title: "You're booked!",
      body: `You accepted ${label}. You're confirmed — clock in when you arrive.`,
      shiftId: reqRow.shift_id,
    });
    // Tell the owner someone accepted.
    if (shift.client_id) {
      const { data: me } = await adminDb
        .from('users').select('username').eq('id', req.userId).maybeSingle();
      await createNotification({
        userId: shift.client_id,
        fromUserId: req.userId,
        type: 'receipt',
        title: 'Invite accepted',
        body: `${me?.username ? `@${me.username}` : 'A worker'} accepted ${label}.`,
        shiftId: reqRow.shift_id,
      });
    }
    return res.json({ status: 'accepted', booking });
  } catch (e) {
    return sendError(res, e);
  }
});

export default router;
