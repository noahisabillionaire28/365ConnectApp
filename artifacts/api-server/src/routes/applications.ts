import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createNotification } from './notifications.js';

const router = Router();

/** A worker's @handle for use in notification copy, or a neutral fallback. */
async function workerName(id: string): Promise<string> {
  const { data } = await adminDb.from('users').select('username').eq('id', id).maybeSingle();
  return data?.username ? `@${data.username}` : 'the worker';
}

/** A shift's title wrapped in quotes for notification copy, or a neutral fallback. */
async function shiftLabel(id: string): Promise<string> {
  const { data } = await adminDb.from('shifts').select('title').eq('id', id).maybeSingle();
  return data?.title ? `"${data.title}"` : 'a shift';
}

/**
 * Returns a conflicting already-booked shift if `targetShiftId` overlaps in time
 * with any shift the worker is already accepted for (double-booking guard), else
 * null. Two shifts overlap when tStart < otherEnd && otherStart < tEnd.
 */
async function findTimeConflict(
  workerId: string,
  targetShiftId: string,
): Promise<{ title: string | null; start: string; end: string } | null> {
  const { data: target } = await adminDb
    .from('shifts').select('start_time, end_time').eq('id', targetShiftId).maybeSingle();
  if (!target?.start_time || !target?.end_time) return null;
  const tStart = Date.parse(target.start_time), tEnd = Date.parse(target.end_time);
  if (!Number.isFinite(tStart) || !Number.isFinite(tEnd)) return null;

  const { data: apps } = await adminDb
    .from('applications').select('shift_id').eq('worker_id', workerId).eq('status', 'accepted');
  const otherIds = [...new Set((apps ?? []).map((a) => a.shift_id))].filter((id) => id !== targetShiftId);
  if (!otherIds.length) return null;

  const { data: shifts } = await adminDb
    .from('shifts').select('id, title, start_time, end_time, status')
    .in('id', otherIds as string[]);
  for (const s of shifts ?? []) {
    if (s.status === 'cancelled') continue;
    const sStart = Date.parse(s.start_time), sEnd = Date.parse(s.end_time);
    if (!Number.isFinite(sStart) || !Number.isFinite(sEnd)) continue;
    if (tStart < sEnd && sStart < tEnd) return { title: s.title, start: s.start_time, end: s.end_time };
  }
  return null;
}

/** Returns true if userId is the client that owns the given shift. */
async function ownsShift(userId: string, shiftId: string): Promise<boolean> {
  const { count } = await adminDb
    .from('shifts')
    .select('*', { count: 'exact', head: true })
    .eq('id', shiftId)
    .eq('client_id', userId);
  return (count ?? 0) > 0;
}

/** GET /api/applications?shift_id=&worker_id= */
router.get('/', requireAuth, async (req, res) => {
  const { shift_id, worker_id, status } = req.query as Record<string, string>;
  try {
    if (shift_id) {
      // Only the shift owner may see the applicants for their shift.
      if (!(await ownsShift(req.userId!, shift_id))) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      let q = adminDb.from('applications').select('*').eq('shift_id', shift_id);
      if (status) q = q.eq('status', status);
      const { data: apps, error } = await q.order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });

      const workerIds = [...new Set((apps ?? []).map((a) => a.worker_id))];

      const { data: users, error: uErr } = await adminDb
        .from('users')
        .select(
          'id, username, photo_url, rating, job_types, primary_job_type, certifications, bio',
        )
        .in('id', workerIds);
      if (uErr) return res.status(500).json({ error: uErr.message });
      const userMap = new Map((users ?? []).map((u) => [u.id, u]));

      // Time-entry state — clock in/out + the ACTUAL hours & pay for this shift.
      const entryMap = new Map<string, {
        clock_in: string | null; clock_out: string | null;
        total_hours: number | null; total_pay: number | null;
      }>();
      if (workerIds.length) {
        const { data: entries } = await adminDb
          .from('time_entries')
          .select('worker_id, clock_in, clock_out, total_hours, total_pay')
          .eq('shift_id', shift_id)
          .in('worker_id', workerIds);
        for (const t of entries ?? []) {
          entryMap.set(t.worker_id, {
            clock_in: t.clock_in ?? null,
            clock_out: t.clock_out ?? null,
            total_hours: t.total_hours ?? null,
            total_pay: t.total_pay ?? null,
          });
        }
      }

      // Shift end time — used to flag a booked worker who never showed as no-show.
      const { data: shiftTimes } = await adminDb
        .from('shifts').select('end_time').eq('id', shift_id).maybeSingle();
      const shiftEndMs = shiftTimes?.end_time ? Date.parse(shiftTimes.end_time) : NaN;
      const nowMs = Date.now();

      // Whether the owner has already reviewed each worker for this shift.
      const reviewedSet = new Set<string>();
      if (workerIds.length) {
        const { data: revs } = await adminDb
          .from('reviews')
          .select('reviewee_id')
          .eq('shift_id', shift_id)
          .eq('reviewer_id', req.userId)
          .in('reviewee_id', workerIds);
        for (const r of revs ?? []) reviewedSet.add(r.reviewee_id);
      }

      // Whether each worker has already been paid for this shift (prevents
      // the owner from paying — and being charged — twice for the same shift).
      const paidSet = new Set<string>();
      if (workerIds.length) {
        const { data: pays } = await adminDb
          .from('payments')
          .select('worker_id')
          .eq('shift_id', shift_id)
          .eq('status', 'completed')
          .in('worker_id', workerIds);
        for (const p of pays ?? []) paidSet.add(p.worker_id);
      }

      const merged = (apps ?? []).map((a) => {
        const u = userMap.get(a.worker_id);
        const e = entryMap.get(a.worker_id);
        // Attendance: where this worker is in the shift lifecycle.
        //   applied → not booked yet · booked → accepted, not on-site
        //   on_site → clocked in · done → clocked out
        //   no_show → booked but the shift ended and they never clocked in
        let attendance: 'applied' | 'booked' | 'on_site' | 'done' | 'no_show';
        if (a.status !== 'accepted') attendance = 'applied';
        else if (e?.clock_out) attendance = 'done';
        else if (e?.clock_in) attendance = 'on_site';
        else if (Number.isFinite(shiftEndMs) && nowMs > shiftEndMs) attendance = 'no_show';
        else attendance = 'booked';
        return {
          ...a,
          username: u?.username ?? null,
          photo_url: u?.photo_url ?? null,
          rating: u?.rating ?? null,
          job_types: u?.job_types ?? null,
          primary_job_type: u?.primary_job_type ?? null,
          certifications: u?.certifications ?? null,
          bio: u?.bio ?? null,
          clock_in: e?.clock_in ?? null,
          clock_out: e?.clock_out ?? null,
          total_hours: e?.total_hours ?? null,
          total_pay: e?.total_pay ?? null,
          attendance,
          already_reviewed: reviewedSet.has(a.worker_id),
          paid: paidSet.has(a.worker_id),
        };
      });
      return res.json(merged);
    }
    // Any other listing is scoped to the caller's own applications only.
    // (An explicit worker_id belonging to someone else is not honoured.)
    if (worker_id && worker_id !== 'me' && worker_id !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { data: apps, error } = await adminDb
      .from('applications')
      .select('*')
      .eq('worker_id', req.userId)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    const shiftIds = [...new Set((apps ?? []).map((a) => a.shift_id))];
    const { data: shifts, error: sErr } = await adminDb
      .from('shifts')
      .select(
        'id, title, job_type, start_time, end_time, location, pay_rate, pay_period, company_name',
      )
      .in('id', shiftIds);
    if (sErr) return res.status(500).json({ error: sErr.message });

    const shiftMap = new Map((shifts ?? []).map((s) => [s.id, s]));
    const merged = (apps ?? []).map((a) => {
      const s = shiftMap.get(a.shift_id);
      return {
        ...a,
        title: s?.title ?? null,
        job_type: s?.job_type ?? null,
        start_time: s?.start_time ?? null,
        end_time: s?.end_time ?? null,
        location: s?.location ?? null,
        pay_rate: s?.pay_rate ?? null,
        pay_period: s?.pay_period ?? null,
        company_name: s?.company_name ?? null,
      };
    });
    return res.json(merged);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** GET /api/applications/status/:shiftId - caller's own status for a shift */
router.get('/status/:shiftId', requireAuth, async (req, res) => {
  try {
    const { data, error } = await adminDb
      .from('applications')
      .select('status')
      .eq('shift_id', req.params.shiftId)
      .eq('worker_id', req.userId)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ status: data?.status ?? null });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** GET /api/applications/my-shift-ids - set of shift IDs I've applied to */
router.get('/my-shift-ids', requireAuth, async (req, res) => {
  try {
    const { data, error } = await adminDb
      .from('applications')
      .select('shift_id, status')
      .eq('worker_id', req.userId);
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** POST /api/applications - a worker applies to a shift (always as themselves, pending) */
router.post('/', requireAuth, requireRole('worker'), async (req, res) => {
  const { shift_id, match_score, message } = req.body as Record<string, unknown>;
  try {
    const conflict = await findTimeConflict(req.userId!, shift_id as string);
    if (conflict) {
      return res.status(409).json({
        error: `This overlaps a shift you're already booked for${conflict.title ? ` ("${conflict.title}")` : ''}.`,
      });
    }
    const { data, error } = await adminDb
      .from('applications')
      .upsert(
        {
          shift_id,
          worker_id: req.userId,
          status: 'pending',
          match_score: match_score ?? null,
          message: message ?? null,
        },
        { onConflict: 'shift_id,worker_id', ignoreDuplicates: true },
      )
      .select()
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(409).json({ error: 'Already applied' });
    return res.status(201).json(data);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/**
 * PATCH /api/applications/:id - update an application's status.
 * The applicant (worker) may only 'withdraw' their own application.
 * The shift's owning client may accept/reject/decline or reset to pending.
 */
router.patch('/:id', requireAuth, async (req, res) => {
  const { status } = req.body as { status: string };
  const validStatuses = ['pending', 'accepted', 'rejected', 'declined', 'withdrawn'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    const { data: appRow, error: aErr } = await adminDb
      .from('applications')
      .select('worker_id, shift_id')
      .eq('id', req.params.id)
      .maybeSingle();
    if (aErr) return res.status(500).json({ error: aErr.message });
    if (!appRow) return res.status(404).json({ error: 'Not found' });

    const { data: shiftRow, error: sErr } = await adminDb
      .from('shifts')
      .select('client_id')
      .eq('id', appRow.shift_id)
      .maybeSingle();
    if (sErr) return res.status(500).json({ error: sErr.message });

    const app = { worker_id: appRow.worker_id, client_id: shiftRow?.client_id };

    const isApplicant = app.worker_id === req.userId;
    const isShiftOwner = app.client_id === req.userId;

    if (isApplicant && !isShiftOwner) {
      // Workers may only withdraw their own application, never self-accept.
      if (status !== 'withdrawn') {
        return res.status(403).json({ error: 'Workers may only withdraw an application' });
      }
    } else if (!isShiftOwner) {
      // Neither the applicant nor the shift owner.
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Double-booking guard: don't confirm a worker who's already booked for an
    // overlapping shift.
    if (status === 'accepted') {
      const conflict = await findTimeConflict(appRow.worker_id, appRow.shift_id);
      if (conflict) {
        return res.status(409).json({
          error: `This worker is already booked for an overlapping shift${conflict.title ? ` ("${conflict.title}")` : ''}.`,
        });
      }
    }

    const { data, error } = await adminDb
      .from('applications')
      .update({ status })
      .eq('id', req.params.id)
      .select()
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Not found' });

    // Notify the worker when the owner books them, and send the owner a receipt.
    if (status === 'accepted' && isShiftOwner) {
      const label = await shiftLabel(appRow.shift_id);
      await createNotification({
        userId: appRow.worker_id,
        fromUserId: req.userId,
        type: 'booking',
        title: "You're booked!",
        body: `You've been accepted for ${label}.`,
        shiftId: appRow.shift_id,
      });
      await createNotification({
        userId: req.userId!,
        fromUserId: appRow.worker_id,
        type: 'receipt',
        title: 'Worker booked',
        body: `You booked ${await workerName(appRow.worker_id)} for ${label}.`,
        shiftId: appRow.shift_id,
      });
    }
    // Receipt to the owner/staffer when they remove (decline/reject) a worker.
    if ((status === 'declined' || status === 'rejected') && isShiftOwner) {
      const label = await shiftLabel(appRow.shift_id);
      await createNotification({
        userId: req.userId!,
        fromUserId: appRow.worker_id,
        type: 'receipt',
        title: 'Worker removed',
        body: `You removed ${await workerName(appRow.worker_id)} from ${label}.`,
        shiftId: appRow.shift_id,
      });
    }
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/**
 * POST /api/applications/assign - directly assign a worker to a shift.
 * Only the shift's owning client (or a staffer acting for them) may do this.
 */
router.post('/assign', requireAuth, requireRole('client', 'staffer'), async (req, res) => {
  const { shift_id, worker_id } = req.body as Record<string, string>;
  if (!shift_id || !worker_id) {
    return res.status(400).json({ error: 'shift_id and worker_id are required' });
  }
  try {
    // Clients may only assign on shifts they own. Staffers may assign on any shift.
    if (req.userRole === 'client' && !(await ownsShift(req.userId!, shift_id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    // Double-booking guard.
    const assignConflict = await findTimeConflict(worker_id, shift_id);
    if (assignConflict) {
      return res.status(409).json({
        error: `This worker is already booked for an overlapping shift${assignConflict.title ? ` ("${assignConflict.title}")` : ''}.`,
      });
    }
    const { data, error } = await adminDb
      .from('applications')
      .upsert(
        { shift_id, worker_id, status: 'accepted' },
        { onConflict: 'shift_id,worker_id' },
      )
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    const label = await shiftLabel(shift_id);
    await createNotification({
      userId: worker_id,
      fromUserId: req.userId,
      type: 'booking',
      title: "You're booked!",
      body: `You've been assigned to ${label}.`,
      shiftId: shift_id,
    });
    // Receipt to the owner/staffer who made the booking.
    await createNotification({
      userId: req.userId!,
      fromUserId: worker_id,
      type: 'receipt',
      title: 'Worker booked',
      body: `You booked ${await workerName(worker_id)} for ${label}.`,
      shiftId: shift_id,
    });
    return res.status(201).json(data);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/**
 * POST /api/applications/claim - a worker instantly claims an open-claim shift.
 * No approval step: if the shift is marked instant_claim and has an open spot,
 * the worker is confirmed immediately (first-come, first-served).
 */
router.post('/claim', requireAuth, requireRole('worker'), async (req, res) => {
  const { shift_id } = req.body as Record<string, string>;
  if (!shift_id) return res.status(400).json({ error: 'shift_id is required' });
  try {
    const { data: shift, error: sErr } = await adminDb
      .from('shifts')
      .select('id, title, client_id, status, spots_available, spots_filled, instant_claim')
      .eq('id', shift_id)
      .maybeSingle();
    if (sErr) return res.status(500).json({ error: sErr.message });
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    if (!shift.instant_claim) return res.status(403).json({ error: 'This shift is not open for instant claim.' });
    if (shift.status !== 'open') return res.status(409).json({ error: 'This shift is no longer open.' });
    const spotsLeft = (shift.spots_available ?? 1) - (shift.spots_filled ?? 0);
    if (spotsLeft <= 0) return res.status(409).json({ error: 'This shift is already full.' });

    // Double-booking guard: can't claim a shift overlapping one you're booked for.
    const claimConflict = await findTimeConflict(req.userId!, shift_id);
    if (claimConflict) {
      return res.status(409).json({
        error: `This overlaps a shift you're already booked for${claimConflict.title ? ` ("${claimConflict.title}")` : ''}.`,
      });
    }

    // Confirm the worker directly. The DB trigger on an accepted insert
    // increments spots_filled and notifies the worker.
    const { data, error } = await adminDb
      .from('applications')
      .upsert(
        { shift_id, worker_id: req.userId, status: 'accepted' },
        { onConflict: 'shift_id,worker_id' },
      )
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    const label = await shiftLabel(shift_id);
    // Confirmation to the worker who claimed it.
    await createNotification({
      userId: req.userId!,
      fromUserId: shift.client_id,
      type: 'booking',
      title: "You're booked!",
      body: `You claimed ${label}. You're confirmed.`,
      shiftId: shift_id,
    });
    // Alert the shift owner that a worker grabbed the shift.
    if (shift.client_id) {
      await createNotification({
        userId: shift.client_id,
        fromUserId: req.userId,
        type: 'receipt',
        title: 'Shift claimed',
        body: `${await workerName(req.userId!)} claimed ${label}.`,
        shiftId: shift_id,
      });
    }
    return res.status(201).json(data);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

export default router;
