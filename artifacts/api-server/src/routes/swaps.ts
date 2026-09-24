/**
 * Shift swaps — a booked worker hands their spot to another worker.
 *
 *   worker A  POST /swaps                 offers their spot to worker B
 *   worker B  POST /swaps/:id/respond     accepts or declines
 *   poster    POST /swaps/:id/decide      approves (the spot moves) or declines
 *   worker A  POST /swaps/:id/cancel      pulls the offer while it is in flight
 *   worker    GET  /swaps/mine            incoming offers + my outgoing swaps
 *   poster    GET  /swaps?shift_id=       every swap on one of their shifts
 *
 * Approval is atomic from the roster's point of view: A's application becomes
 * 'withdrawn' (callout_reason 'swap'), B is booked through the capacity-safe
 * helper — and if that fails A is put straight back. Chat membership and
 * shift_requests are kept in step; capacity is re-derived.
 */
import { Router } from 'express';
import { z } from 'zod';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createNotification } from './notifications.js';
import { findTimeConflict, workerName } from './applications.js';
import { HttpError, sendError } from '../lib/httpError.js';
import { assertShiftOwner, loadShift, rosterAllows, type ShiftRow } from '../lib/shiftAccess.js';
import { bookWorker, markRequestAccepted, syncShiftCapacity } from '../lib/booking.js';
import { formatShiftInstant, shiftDayLabel } from '../lib/shiftLabel.js';
import { ensureShiftGroupChat, insertSystemMessage, isBlockedEitherWay } from '../lib/chat.js';
import { broadcastToUser } from '../lib/sseManager.js';
import { ACTIVE_SWAP_STATUSES, type SwapRow } from '../lib/swaps.js';

const router = Router();

const uuid = z.string().uuid('Invalid id');
const offerBody = z.object({
  shift_id: uuid,
  to_worker_id: uuid,
  note: z.string().trim().max(300, 'Note is too long').optional(),
});
const respondBody = z.object({ action: z.enum(['accept', 'decline']) });
const decideBody = z.object({ action: z.enum(['approve', 'decline']) });

const ACTIVE = [...ACTIVE_SWAP_STATUSES] as string[];
const ON_SHIFT_STATUSES = new Set(['accepted', 'standby', 'pending']);

/** The shift columns the swap lists carry. */
const SWAP_SHIFT_COLUMNS =
  'id, client_id, title, job_type, company_name, start_time, end_time, timezone, location, pay_rate, pay_period, status';

type SwapShift = {
  id: string; client_id: string | null; title: string | null; job_type: string | null;
  company_name: string | null; start_time: string | null; end_time: string | null;
  timezone: string | null; location: string | null; pay_rate: number | null;
  pay_period: string | null; status: string | null;
};

type UserSummary = { id: string; username: string | null; photo_url: string | null; rating: number | null };

/** Why a swap cannot be started / moved on this shift right now, or null. */
function swapBlocker(shift: Pick<ShiftRow, 'status' | 'start_time'>): string | null {
  if (shift.status === 'cancelled') return 'This shift was cancelled.';
  if (shift.status !== 'open' && shift.status !== 'filled') return 'This shift is no longer accepting workers.';
  const startMs = shift.start_time ? Date.parse(shift.start_time) : NaN;
  if (Number.isFinite(startMs) && Date.now() >= startMs) return 'This shift has already started.';
  return null;
}

async function loadSwap(id: string): Promise<SwapRow> {
  const { data, error } = await adminDb.from('shift_swaps').select('*').eq('id', id).maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, 'Swap not found');
  return data as SwapRow;
}

async function usersById(ids: string[]): Promise<Map<string, UserSummary>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const { data, error } = await adminDb.from('users').select('id, username, photo_url, rating').in('id', unique);
  if (error) throw new HttpError(500, error.message);
  return new Map((data ?? []).map((u) => [u.id, u as UserSummary]));
}

async function shiftsById(ids: string[]): Promise<Map<string, SwapShift>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const { data, error } = await adminDb.from('shifts').select(SWAP_SHIFT_COLUMNS).in('id', unique);
  if (error) throw new HttpError(500, error.message);
  return new Map((data ?? []).map((s) => [s.id, s as SwapShift]));
}

/**
 * The person a worker swaps with must be another worker account that is not
 * the poster, not suspended, and not blocked either way. Throws an HttpError
 * with a message the offering worker can be shown.
 */
async function assertSwapTarget(workerId: string, actorId: string, shift: ShiftRow): Promise<void> {
  if (shift.client_id && workerId === shift.client_id) {
    throw new HttpError(409, "You can't swap with the shift's poster.");
  }
  const { data: target, error } = await adminDb
    .from('users').select('id, role, status').eq('id', workerId).maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!target) throw new HttpError(404, 'Worker not found');
  if (target.role !== 'worker') throw new HttpError(409, 'You can only swap with a worker account.');
  if (target.status === 'suspended' || target.status === 'banned') {
    throw new HttpError(409, "That worker can't take shifts right now.");
  }
  if (await isBlockedEitherWay(actorId, workerId)) throw new HttpError(403, "You can't swap with this worker.");
}

/** "Bartender shift on Sat, Oct 4 · 5:00 PM PDT at Corbin Events" */
function shiftBlurb(shift: SwapShift | ShiftRow): string {
  const role = shift.job_type || shift.title || 'shift';
  const when = formatShiftInstant(shift.start_time, shift.timezone);
  const company = 'company_name' in shift && shift.company_name ? ` at ${shift.company_name}` : '';
  return `${role} shift${when ? ` on ${when}` : ''}${company}`;
}

/**
 * POST /api/swaps { shift_id, to_worker_id, note? } — a booked worker offers
 * their spot to another worker. The target is told; nothing changes on the
 * roster until they accept and the poster approves.
 */
router.post('/', requireAuth, requireRole('worker'), async (req, res) => {
  const parsed = offerBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'shift_id and to_worker_id are required' });
  }
  const { shift_id, to_worker_id, note } = parsed.data;
  const me = req.userId!;
  try {
    if (to_worker_id === me) return res.status(409).json({ error: "You can't swap a shift with yourself." });
    const shift = await loadShift(shift_id);
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    const blocker = swapBlocker(shift);
    if (blocker) return res.status(409).json({ error: blocker });

    // I must hold a confirmed spot on this shift.
    const { data: mine, error: mErr } = await adminDb
      .from('applications').select('id, status').eq('shift_id', shift_id).eq('worker_id', me).maybeSingle();
    if (mErr) return res.status(500).json({ error: mErr.message });
    if (!mine || mine.status !== 'accepted') return res.status(409).json({ error: "You're not booked for this shift." });

    await assertSwapTarget(to_worker_id, me, shift);
    const them = await workerName(to_worker_id);

    // They must not already be on the shift in any live capacity.
    const { data: theirs } = await adminDb
      .from('applications').select('status').eq('shift_id', shift_id).eq('worker_id', to_worker_id).maybeSingle();
    if (theirs && ON_SHIFT_STATUSES.has(theirs.status)) {
      return res.status(409).json({ error: `${them} is already on this shift.` });
    }
    if (!(await rosterAllows(shift, to_worker_id))) {
      return res.status(403).json({ error: `This shift is roster-only and ${them} isn't on the agency's roster.` });
    }
    const conflict = await findTimeConflict(to_worker_id, shift_id);
    if (conflict) {
      return res.status(409).json({
        error: `${them} is already booked for an overlapping shift${conflict.title ? ` ("${conflict.title}")` : ''}.`,
      });
    }

    // One swap in flight per booking (the partial unique index backs this up).
    const { count: activeCount } = await adminDb
      .from('shift_swaps').select('*', { count: 'exact', head: true })
      .eq('application_id', mine.id).in('status', ACTIVE);
    if (activeCount) return res.status(409).json({ error: 'You already have a swap pending.' });

    const { data: row, error: iErr } = await adminDb
      .from('shift_swaps')
      .insert({
        shift_id, application_id: mine.id, from_worker_id: me, to_worker_id,
        status: 'offered', note: note || null,
      })
      .select()
      .maybeSingle();
    if (iErr) {
      if (iErr.code === '23505') return res.status(409).json({ error: 'You already have a swap pending.' });
      return res.status(500).json({ error: iErr.message });
    }
    if (!row) return res.status(500).json({ error: 'Could not create the swap.' });

    const meName = await workerName(me);
    const { data: full } = await adminDb.from('shifts').select(SWAP_SHIFT_COLUMNS).eq('id', shift_id).maybeSingle();
    await createNotification({
      userId: to_worker_id,
      fromUserId: me,
      type: 'swap_offer',
      title: 'Shift swap offer',
      body: `${meName} wants you to take their ${shiftBlurb((full as SwapShift | null) ?? shift)}.${note ? ` "${note}"` : ''}`,
      shiftId: shift_id,
      url: `/shift/${shift_id}`,
    });
    const target = (await usersById([to_worker_id])).get(to_worker_id);
    return res.status(201).json({ ...row, to_username: target?.username ?? null });
  } catch (e) {
    return sendError(res, e);
  }
});

/**
 * GET /api/swaps/mine — for a worker: offers waiting on me (incoming) and the
 * swaps I started that are in flight or were decided in the last 7 days
 * (outgoing), each with a shift summary and the other worker.
 */
router.get('/mine', requireAuth, async (req, res) => {
  const me = req.userId!;
  try {
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const [{ data: inRows, error: inErr }, { data: outRows, error: outErr }] = await Promise.all([
      adminDb.from('shift_swaps').select('*')
        .eq('to_worker_id', me).eq('status', 'offered')
        .order('created_at', { ascending: false }).limit(50),
      adminDb.from('shift_swaps').select('*')
        .eq('from_worker_id', me)
        .or(`status.in.(offered,accepted),created_at.gte.${since}`)
        .order('created_at', { ascending: false }).limit(50),
    ]);
    if (inErr) return res.status(500).json({ error: inErr.message });
    if (outErr) return res.status(500).json({ error: outErr.message });
    const incomingRaw = (inRows ?? []) as SwapRow[];
    const outgoingRaw = (outRows ?? []) as SwapRow[];
    const all = [...incomingRaw, ...outgoingRaw];
    const [shifts, users] = await Promise.all([
      shiftsById(all.map((s) => s.shift_id)),
      usersById(all.flatMap((s) => [s.from_worker_id, s.to_worker_id])),
    ]);
    const now = Date.now();
    const serialize = (s: SwapRow, counterpartId: string) => ({
      id: s.id, shift_id: s.shift_id, from_worker_id: s.from_worker_id, to_worker_id: s.to_worker_id,
      status: s.status, note: s.note, created_at: s.created_at, responded_at: s.responded_at, decided_at: s.decided_at,
      shift: shifts.get(s.shift_id) ?? null,
      counterpart: users.get(counterpartId) ?? { id: counterpartId, username: null, photo_url: null, rating: null },
    });
    // An offer on a shift that started or was cancelled is dead even if the
    // sweep has not run yet.
    const live = (s: SwapRow) => {
      const sh = shifts.get(s.shift_id);
      if (!sh) return false;
      if (sh.status !== 'open' && sh.status !== 'filled') return false;
      const start = sh.start_time ? Date.parse(sh.start_time) : NaN;
      return !Number.isFinite(start) || start > now;
    };
    return res.json({
      incoming: incomingRaw.filter(live).map((s) => serialize(s, s.from_worker_id)),
      outgoing: outgoingRaw.map((s) => serialize(s, s.to_worker_id)),
    });
  } catch (e) {
    return sendError(res, e);
  }
});

/**
 * GET /api/swaps?shift_id= — the poster's view: every swap on one of their
 * shifts, newest first, with both workers.
 */
router.get('/', requireAuth, async (req, res) => {
  const { shift_id } = req.query as Record<string, string | undefined>;
  try {
    if (!shift_id) return res.status(400).json({ error: 'shift_id is required' });
    await assertShiftOwner(shift_id, req.userId!);
    const { data, error } = await adminDb
      .from('shift_swaps').select('*').eq('shift_id', shift_id).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    const rows = (data ?? []) as SwapRow[];
    const ids = rows.flatMap((s) => [s.from_worker_id, s.to_worker_id]);
    const users = await usersById(ids);
    // Shifts actually worked (clocked out) — one query for every worker listed.
    const worked = new Map<string, number>();
    if (ids.length) {
      const { data: entries } = await adminDb
        .from('time_entries').select('worker_id').in('worker_id', [...new Set(ids)]).not('clock_out', 'is', null);
      for (const e of entries ?? []) worked.set(e.worker_id, (worked.get(e.worker_id) ?? 0) + 1);
    }
    const person = (id: string) => {
      const u = users.get(id);
      return {
        id, username: u?.username ?? null, photo_url: u?.photo_url ?? null,
        rating: u?.rating ?? null, shifts_worked: worked.get(id) ?? 0,
      };
    };
    return res.json(rows.map((s) => ({
      id: s.id, shift_id: s.shift_id, application_id: s.application_id, status: s.status, note: s.note,
      created_at: s.created_at, responded_at: s.responded_at, decided_at: s.decided_at,
      from_worker: person(s.from_worker_id),
      to_worker: person(s.to_worker_id),
    })));
  } catch (e) {
    return sendError(res, e);
  }
});

/**
 * POST /api/swaps/:id/respond { action: 'accept' | 'decline' } — the worker
 * who was offered the spot answers. Accepting re-checks the double-booking
 * guard and hands the swap to the poster for approval.
 */
router.post('/:id/respond', requireAuth, requireRole('worker'), async (req, res) => {
  const parsed = respondBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'action must be accept or decline' });
  const me = req.userId!;
  try {
    const swap = await loadSwap(String(req.params.id));
    if (swap.to_worker_id !== me) return res.status(403).json({ error: 'This offer is not for you.' });
    if (swap.status !== 'offered') return res.status(409).json({ error: 'This offer is no longer open.' });
    const shift = await loadShift(swap.shift_id);
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    const blocker = swapBlocker(shift);
    if (blocker) return res.status(409).json({ error: blocker });

    const now = new Date().toISOString();
    const fromName = await workerName(swap.from_worker_id);
    const meName = await workerName(me);
    const dayLabel = shiftDayLabel(shift, { withTitle: false });

    if (parsed.data.action === 'decline') {
      const { error } = await adminDb
        .from('shift_swaps').update({ status: 'declined_by_worker', responded_at: now })
        .eq('id', swap.id).eq('status', 'offered');
      if (error) return res.status(500).json({ error: error.message });
      await createNotification({
        userId: swap.from_worker_id, fromUserId: me, type: 'swap_declined',
        title: 'Swap declined',
        body: `${meName} declined your swap offer for ${dayLabel}. You're still booked.`,
        shiftId: swap.shift_id, url: `/shift/${swap.shift_id}`,
      });
      return res.json({ id: swap.id, status: 'declined_by_worker' });
    }

    // Accept: the offering worker must still hold the spot, and I must be free.
    const { data: app } = await adminDb
      .from('applications').select('status').eq('id', swap.application_id).maybeSingle();
    if (!app || app.status !== 'accepted') {
      await adminDb.from('shift_swaps').update({ status: 'cancelled', decided_at: now }).eq('id', swap.id).eq('status', 'offered');
      return res.status(409).json({ error: `${fromName} is no longer booked for this shift.` });
    }
    const conflict = await findTimeConflict(me, swap.shift_id);
    if (conflict) {
      return res.status(409).json({
        error: `This overlaps a shift you're already booked for${conflict.title ? ` ("${conflict.title}")` : ''}.`,
      });
    }
    const { data: updated, error: uErr } = await adminDb
      .from('shift_swaps').update({ status: 'accepted', responded_at: now })
      .eq('id', swap.id).eq('status', 'offered').select('id').maybeSingle();
    if (uErr) return res.status(500).json({ error: uErr.message });
    if (!updated) return res.status(409).json({ error: 'This offer is no longer open.' });

    if (shift.client_id) {
      await createNotification({
        userId: shift.client_id, fromUserId: me, type: 'swap_pending',
        title: 'Swap needs your approval',
        body: `Swap needs your approval: ${fromName} → ${meName} for ${dayLabel}.`,
        shiftId: swap.shift_id, url: `/shift/${swap.shift_id}/applicants`,
      });
    }
    await createNotification({
      userId: swap.from_worker_id, fromUserId: me, type: 'swap_accepted',
      title: 'Swap accepted',
      body: `${meName} accepted your swap for ${dayLabel}. Waiting for the poster to approve it.`,
      shiftId: swap.shift_id, url: `/shift/${swap.shift_id}`,
    });
    return res.json({ id: swap.id, status: 'accepted' });
  } catch (e) {
    return sendError(res, e);
  }
});

/**
 * Move the spot from A to B. Throws HttpError on a business failure, with
 * A's booking restored. Chat and request rows are synced best-effort.
 */
async function performSwap(swap: SwapRow, shift: ShiftRow, names: { from: string; to: string }): Promise<void> {
  // 1. Release A's spot (kept as a withdrawn application tagged 'swap').
  const { data: released, error: rErr } = await adminDb
    .from('applications')
    .update({ status: 'withdrawn', callout_reason: 'swap', arrival_status: null, arrival_status_at: null })
    .eq('id', swap.application_id)
    .eq('status', 'accepted')
    .select('id')
    .maybeSingle();
  if (rErr) throw new HttpError(500, rErr.message);
  if (!released) throw new HttpError(409, `${names.from} is no longer booked for this shift.`);

  // 2. Book B; if that fails for any reason, put A straight back.
  try {
    await bookWorker(shift.id, swap.to_worker_id, 'accept');
  } catch (e) {
    await adminDb.from('applications').update({ status: 'accepted', callout_reason: null }).eq('id', swap.application_id);
    await syncShiftCapacity(shift.id);
    throw e;
  }
  await markRequestAccepted(shift.id, swap.to_worker_id);
  await syncShiftCapacity(shift.id);

  // 3. Swap chat membership with a single system line.
  try {
    const conv = await ensureShiftGroupChat(shift.id);
    if (conv) {
      const members = new Set(conv.participant_ids ?? []);
      members.delete(swap.from_worker_id);
      members.add(swap.to_worker_id);
      const list = [...members];
      await adminDb.from('conversations').update({ participant_ids: list }).eq('id', conv.id);
      await insertSystemMessage({ ...conv, participant_ids: list }, `${names.from} swapped their spot to ${names.to}`, conv.created_by);
      broadcastToUser(swap.from_worker_id, 'conversation_update', { conversationId: conv.id });
      broadcastToUser(swap.to_worker_id, 'conversation_update', { conversationId: conv.id });
    }
  } catch (e) {
    console.error('[swaps] chat sync failed:', e);
  }
}

/**
 * POST /api/swaps/:id/decide { action: 'approve' | 'decline' } — the shift
 * owner (or an admin) rules on a swap. Approving requires the other worker to
 * have accepted; declining is allowed at any point while it is in flight.
 */
router.post('/:id/decide', requireAuth, async (req, res) => {
  const parsed = decideBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'action must be approve or decline' });
  const me = req.userId!;
  try {
    const swap = await loadSwap(String(req.params.id));
    const shift = await assertShiftOwner(swap.shift_id, me);
    if (!ACTIVE.includes(swap.status)) return res.status(409).json({ error: 'This swap has already been decided.' });
    const now = new Date().toISOString();
    const fromName = await workerName(swap.from_worker_id);
    const toName = await workerName(swap.to_worker_id);
    const dayLabel = shiftDayLabel(shift, { withTitle: false });

    if (parsed.data.action === 'decline') {
      const { error } = await adminDb
        .from('shift_swaps').update({ status: 'declined_by_poster', decided_at: now, decided_by: me })
        .eq('id', swap.id).in('status', ACTIVE);
      if (error) return res.status(500).json({ error: error.message });
      await createNotification({
        userId: swap.from_worker_id, fromUserId: me, type: 'swap_declined',
        title: 'Swap declined',
        body: `The poster declined your swap to ${toName} for ${dayLabel}. You're still booked.`,
        shiftId: swap.shift_id, url: `/shift/${swap.shift_id}`,
      });
      await createNotification({
        userId: swap.to_worker_id, fromUserId: me, type: 'swap_declined',
        title: 'Swap declined',
        body: `The poster declined ${fromName}'s swap to you for ${dayLabel}.`,
        shiftId: swap.shift_id, url: `/shift/${swap.shift_id}`,
      });
      return res.json({ id: swap.id, status: 'declined_by_poster' });
    }

    if (swap.status !== 'accepted') {
      return res.status(409).json({ error: `${toName} hasn't accepted this swap yet.` });
    }
    const blocker = swapBlocker(shift);
    if (blocker) return res.status(409).json({ error: blocker });
    const conflict = await findTimeConflict(swap.to_worker_id, swap.shift_id);
    if (conflict) {
      return res.status(409).json({
        error: `${toName} is already booked for an overlapping shift${conflict.title ? ` ("${conflict.title}")` : ''}.`,
      });
    }

    await performSwap(swap, shift, { from: fromName, to: toName });
    const { error: sErr } = await adminDb
      .from('shift_swaps').update({ status: 'approved', decided_at: now, decided_by: me }).eq('id', swap.id);
    if (sErr) console.error('[swaps] approve status update failed:', sErr.message);

    await createNotification({
      userId: swap.from_worker_id, fromUserId: me, type: 'swap_approved',
      title: 'Swap approved',
      body: `Your swap was approved: ${toName} now has your spot on ${dayLabel}.`,
      shiftId: swap.shift_id, url: `/shift/${swap.shift_id}`,
    });
    await createNotification({
      userId: swap.to_worker_id, fromUserId: me, type: 'swap_approved',
      title: "You're booked!",
      body: `The poster approved your swap with ${fromName}. You're confirmed for ${dayLabel}.`,
      shiftId: swap.shift_id, url: `/shift/${swap.shift_id}`,
    });
    return res.json({ id: swap.id, status: 'approved' });
  } catch (e) {
    return sendError(res, e);
  }
});

/**
 * POST /api/swaps/:id/cancel — the offering worker pulls a swap that is still
 * in flight. The other worker is told only if they had accepted.
 */
router.post('/:id/cancel', requireAuth, requireRole('worker'), async (req, res) => {
  const me = req.userId!;
  try {
    const swap = await loadSwap(String(req.params.id));
    if (swap.from_worker_id !== me) return res.status(403).json({ error: 'Forbidden' });
    if (!ACTIVE.includes(swap.status)) return res.status(409).json({ error: 'This swap is no longer in flight.' });
    const now = new Date().toISOString();
    const { error } = await adminDb
      .from('shift_swaps').update({ status: 'cancelled', decided_at: now })
      .eq('id', swap.id).in('status', ACTIVE);
    if (error) return res.status(500).json({ error: error.message });
    if (swap.status === 'accepted') {
      const shift = await loadShift(swap.shift_id);
      await createNotification({
        userId: swap.to_worker_id, fromUserId: me, type: 'swap_declined',
        title: 'Swap cancelled',
        body: `${await workerName(me)} cancelled the swap they offered you for ${shiftDayLabel(shift ?? {}, { withTitle: false })}.`,
        shiftId: swap.shift_id, url: `/shift/${swap.shift_id}`,
      });
    }
    return res.json({ id: swap.id, status: 'cancelled' });
  } catch (e) {
    return sendError(res, e);
  }
});

export default router;
