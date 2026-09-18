import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createNotification } from './notifications.js';
import { findTimeConflict } from './applications.js';
import { addWorkerToShiftChat } from '../lib/chat.js';

const router = Router();

/** Returns true if userId is the client that owns the given shift. */
async function ownsShift(userId: string, shiftId: string): Promise<boolean> {
  const { count } = await adminDb
    .from('shifts').select('*', { count: 'exact', head: true })
    .eq('id', shiftId).eq('client_id', userId);
  return (count ?? 0) > 0;
}

/** GET /api/shift-requests — my shift requests (worker or client) */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data: requests, error } = await adminDb
      .from('shift_requests')
      .select('*')
      .or(`worker_id.eq.${req.userId},client_id.eq.${req.userId}`)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    const rows = requests ?? [];
    const shiftIds = [...new Set(rows.map((r: any) => r.shift_id).filter((id: any) => id != null))];
    const workerIds = [...new Set(rows.map((r: any) => r.worker_id).filter((id: any) => id != null))];

    let shiftsById = new Map<string, any>();
    if (shiftIds.length) {
      const { data: shifts, error: shiftsError } = await adminDb
        .from('shifts')
        .select('id, title, job_type, start_time, end_time, location, pay_rate, company_name')
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
        company_name: s?.company_name ?? null,
        worker_username: w?.username ?? null,
        worker_photo: w?.photo_url ?? null,
      };
    });
    return res.json(merged);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** POST /api/shift-requests — create a shift request (client invites one worker) */
router.post('/', requireAuth, requireRole('client', 'staffer'), async (req, res) => {
  const { shift_id, worker_id, message } = req.body as Record<string, string>;
  try {
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

    const [{ data: w }, { data: sh }] = await Promise.all([
      adminDb.from('users').select('username').eq('id', worker_id).maybeSingle(),
      adminDb.from('shifts').select('title').eq('id', shift_id).maybeSingle(),
    ]);
    // Notify the invited worker.
    await createNotification({
      userId: worker_id,
      fromUserId: req.userId,
      type: 'shift_invite',
      title: 'Shift request',
      body: `You've been requested for ${sh?.title ? `"${sh.title}"` : 'a shift'}. Accept to claim your spot.`,
      shiftId: shift_id,
    });
    // Receipt to the requester.
    await createNotification({
      userId: req.userId!,
      fromUserId: worker_id,
      type: 'receipt',
      title: 'Request sent',
      body: `You requested ${w?.username ? `@${w.username}` : 'a worker'} for ${sh?.title ? `"${sh.title}"` : 'a shift'}.`,
      shiftId: shift_id,
    });
    return res.status(201).json(data);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/**
 * POST /api/shift-requests/broadcast — invite ALL workers to a shift at once.
 * Nowsta-style blast: every worker gets a request + notification, and whoever
 * accepts claims a spot (first-come, up to the shift's headcount). Owner/staffer.
 */
router.post('/broadcast', requireAuth, requireRole('client', 'staffer'), async (req, res) => {
  const { shift_id, message } = req.body as Record<string, string>;
  if (!shift_id) return res.status(400).json({ error: 'shift_id is required' });
  try {
    // Clients may only broadcast their own shifts; staffers/admins any shift.
    if (req.userRole === 'client' && !(await ownsShift(req.userId!, shift_id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { data: shift } = await adminDb
      .from('shifts').select('id, title').eq('id', shift_id).maybeSingle();
    if (!shift) return res.status(404).json({ error: 'Shift not found' });

    // Every worker on the platform (excluding the requester).
    const { data: workers, error: wErr } = await adminDb
      .from('users').select('id').eq('role', 'worker');
    if (wErr) return res.status(500).json({ error: wErr.message });
    const workerIds = (workers ?? []).map((w) => w.id).filter((id) => id !== req.userId);
    if (!workerIds.length) return res.json({ invited: 0 });

    // Create a request row for each (ignore ones that already exist).
    const rows = workerIds.map((worker_id) => ({
      shift_id, client_id: req.userId, worker_id, message: message ?? null,
    }));
    const { error: insErr } = await adminDb
      .from('shift_requests')
      .upsert(rows, { onConflict: 'shift_id,worker_id', ignoreDuplicates: true });
    if (insErr) return res.status(500).json({ error: insErr.message });

    // Notify every invited worker (best-effort).
    const label = shift.title ? `"${shift.title}"` : 'a shift';
    await Promise.all(workerIds.map((worker_id) =>
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
    await createNotification({
      userId: req.userId!,
      type: 'receipt',
      title: 'Workers invited',
      body: `You invited ${workerIds.length} worker${workerIds.length === 1 ? '' : 's'} to ${label}.`,
      shiftId: shift_id,
    });
    return res.json({ invited: workerIds.length });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/**
 * PATCH /api/shift-requests/:id — worker accepts or declines an invite.
 * Accepting BOOKS the worker (creates an accepted application) so they can clock
 * in — first-come up to the shift's headcount.
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

    // Accept → book the worker, or waitlist them if the shift is full.
    const { data: shift } = await adminDb
      .from('shifts')
      .select('id, title, client_id, spots_available, spots_filled')
      .eq('id', reqRow.shift_id).maybeSingle();
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    const spotsLeft = (shift.spots_available ?? 1) - (shift.spots_filled ?? 0);
    const label = shift.title ? `"${shift.title}"` : 'a shift';

    // Don't book into a time-overlapping shift.
    const conflict = await findTimeConflict(req.userId!, reqRow.shift_id);
    if (conflict) {
      return res.status(409).json({
        error: `This overlaps a shift you're already booked for${conflict.title ? ` ("${conflict.title}")` : ''}.`,
      });
    }

    // Mark the request accepted.
    await adminDb.from('shift_requests').update({ status: 'accepted' }).eq('id', reqRow.id);

    // Full → put them on standby (waitlist); a spot opening promotes them.
    if (spotsLeft <= 0) {
      const { data: standby, error: stErr } = await adminDb
        .from('applications')
        .upsert(
          { shift_id: reqRow.shift_id, worker_id: req.userId, status: 'standby' },
          { onConflict: 'shift_id,worker_id' },
        )
        .select().single();
      if (stErr) return res.status(500).json({ error: stErr.message });
      await createNotification({
        userId: req.userId!, fromUserId: shift.client_id, type: 'booking',
        title: "You're on standby",
        body: `${label} is full — you're on the waitlist. We'll notify you if a spot opens.`,
        shiftId: reqRow.shift_id,
      });
      return res.json({ status: 'standby', booking: standby });
    }

    // Book them: an accepted application (the DB trigger bumps spots_filled).
    const { data: booking, error: bErr } = await adminDb
      .from('applications')
      .upsert(
        { shift_id: reqRow.shift_id, worker_id: req.userId, status: 'accepted' },
        { onConflict: 'shift_id,worker_id' },
      )
      .select()
      .single();
    if (bErr) return res.status(500).json({ error: bErr.message });
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
    return res.status(500).json({ error: String(e) });
  }
});

export default router;
