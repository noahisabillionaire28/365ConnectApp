import { Router } from 'express';
import { z } from 'zod';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { createNotification } from './notifications.js';
import { HttpError, sendError } from '../lib/httpError.js';
import { assertShiftOwner, loadShift } from '../lib/shiftAccess.js';
import { shiftDayLabel, formatHoursMinutes, formatUsd } from '../lib/shiftLabel.js';
import { setArrivalStatus, workerName } from './applications.js';

const router = Router();

const OT_THRESHOLD = 8;    // hours per shift before overtime
const OT_MULTIPLIER = 1.5; // overtime pay multiplier
const MAX_LATE_CLOCK_OUT_MS = 24 * 60 * 60 * 1000; // manager-supplied clock_out ≤ 24h after clock_in
/** Approved hours within this many hours of the clocked hours count as "unchanged". */
const UNCHANGED_TOLERANCE_H = 5 / 60;

type EntryRow = {
  id: string;
  shift_id: string;
  worker_id: string;
  clock_in: string | null;
  clock_out: string | null;
  break_minutes: number | null;
  break_started_at?: string | null;
  total_hours: number | null;
  total_pay: number | null;
  fee: number | null;
  approved: boolean | null;
  approved_at?: string | null;
  approved_pay?: number | null;
  /** Billable hours as computed at clock-out (before any poster change). */
  clocked_hours?: number | null;
  worker_ack?: 'accepted' | 'disputed' | null;
  worker_ack_at?: string | null;
  dispute_note?: string | null;
  [k: string]: unknown;
};

type PayShift = { pay_rate: number | null; pay_period: string | null };

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Regular / overtime split and pay for `billable` hours on a shift — the ONE
 * place this is computed, so the clock-out estimate and the approved figure
 * always agree: hourly shifts pay regular up to 8h then 1.5× beyond; anything
 * else is a flat rate.
 */
function computePay(billable: number, shift: PayShift): { regular: number; overtime: number; pay: number } {
  const hourly = isHourly(shift.pay_period);
  const regular = hourly ? Math.min(billable, OT_THRESHOLD) : billable;
  const overtime = hourly ? Math.max(0, billable - OT_THRESHOLD) : 0;
  const rate = Number(shift.pay_rate ?? 0);
  const pay = hourly
    ? (Number.isFinite(rate) && rate > 0 ? round2(regular * rate + overtime * rate * OT_MULTIPLIER) : 0)
    : payFor(billable, shift);
  return { regular: round2(regular), overtime: round2(overtime), pay };
}

/** Did the poster's approval change the hours (beyond the tolerance)? */
function hoursChanged(entry: Pick<EntryRow, 'approved' | 'total_hours' | 'clocked_hours'>): boolean {
  if (!entry.approved || entry.total_hours == null || entry.clocked_hours == null) return false;
  return Math.abs(Number(entry.total_hours) - Number(entry.clocked_hours)) > UNCHANGED_TOLERANCE_H;
}

/** Public JSON for a time entry: the row plus the derived hours_changed flag. */
function entryJson(entry: EntryRow): Record<string, unknown> {
  return {
    ...entry,
    clocked_hours: entry.clocked_hours ?? null,
    worker_ack: entry.worker_ack ?? null,
    worker_ack_at: entry.worker_ack_at ?? null,
    dispute_note: entry.dispute_note ?? null,
    hours_changed: hoursChanged(entry),
  };
}

/** A completed shift payment for one (shift, worker), as the timeline needs it. */
type PaidRow = { shift_id: string | null; created_at: string; net_amount: number | null; payment_type: string | null };

type PayStage = 'in_progress' | 'worked' | 'approved' | 'paid';

/**
 * The worker's pay timeline for an entry — Worked → Approved → Paid — with
 * the instant each step happened (null until it has), the poster's change /
 * the worker's answer on the Approved step, how the Paid step was recorded
 * ('stripe' through the app, 'manual' = the poster marked it paid outside the
 * app), and the stage the entry is at now.
 */
function timelineFor(entry: EntryRow, paid: PaidRow | null) {
  const approved = !!entry.approved;
  const stage: PayStage = paid ? 'paid' : approved ? 'approved' : entry.clock_out ? 'worked' : 'in_progress';
  return {
    worked_at: entry.clock_out ?? null,
    approved_at: approved ? entry.approved_at ?? null : null,
    hours_changed: hoursChanged(entry),
    worker_ack: entry.worker_ack ?? null,
    acknowledged_at: entry.worker_ack_at ?? null,
    paid_at: paid?.created_at ?? null,
    paid_amount: paid ? round2(Number(paid.net_amount ?? 0)) : null,
    paid_method: paid ? (paid.payment_type === 'manual' ? 'manual' : 'stripe') : null,
    stage,
  };
}

/**
 * What the entry is worth right now: the approved figure once the poster
 * signed off, else the clock-out estimate from the same formula the approval
 * uses (so the two never disagree).
 */
function expectedPay(entry: EntryRow, shift: PayShift): number {
  if (entry.approved && entry.approved_pay != null) return round2(Number(entry.approved_pay));
  return computePay(round2(Number(entry.total_hours ?? 0)), shift).pay;
}

/**
 * Completed shift payments to a worker for these shifts, keyed by shift_id
 * (the earliest wins) — one batched query, never one per entry.
 */
async function paidByShift(workerId: string, shiftIds: string[]): Promise<Map<string, PaidRow>> {
  const map = new Map<string, PaidRow>();
  if (!shiftIds.length) return map;
  const { data, error } = await adminDb
    .from('payments')
    .select('shift_id, created_at, net_amount, payment_type')
    .eq('worker_id', workerId)
    .eq('status', 'completed')
    .in('shift_id', shiftIds)
    .order('created_at', { ascending: true });
  if (error) throw new HttpError(500, error.message);
  for (const p of (data ?? []) as PaidRow[]) if (p.shift_id && !map.has(p.shift_id)) map.set(p.shift_id, p);
  return map;
}

/** Hourly pay periods; anything else ('day', 'event', 'flat', 'shift') is a flat total. */
function isHourly(payPeriod: string | null | undefined): boolean {
  const p = (payPeriod ?? 'hr').trim().toLowerCase();
  return p === 'hr' || p === 'hour' || p === 'hourly' || p === 'h';
}

/** Gross hours between clock_in and clock_out. */
function grossHours(clockIn: string, clockOut: string): number {
  const ms = Date.parse(clockOut) - Date.parse(clockIn);
  return Number.isFinite(ms) ? Math.max(0, ms / 3_600_000) : 0;
}

/** Billable hours = gross − break (computed once, here). */
function billableHours(clockIn: string, clockOut: string, breakMinutes: number): number {
  return round2(Math.max(0, grossHours(clockIn, clockOut) - Math.max(0, breakMinutes) / 60));
}

/** Pay for the billable hours: hourly × rate, or the flat rate for non-hourly shifts. */
function payFor(hours: number, shift: PayShift): number {
  const rate = Number(shift.pay_rate ?? 0);
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return round2(isHourly(shift.pay_period) ? hours * rate : rate);
}

/**
 * Minutes of an open break as of `at`, or 0 when none. Closing a break means
 * adding this to break_minutes and clearing break_started_at.
 */
function openBreakMinutes(entry: EntryRow, at: Date): number {
  if (!entry.break_started_at) return 0;
  const started = Date.parse(entry.break_started_at);
  if (!Number.isFinite(started)) return 0;
  return Math.max(0, Math.round((at.getTime() - started) / 60_000));
}

/** Postgres "column does not exist" — migration 0022 not applied yet. */
function isMissingColumn(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return err.code === '42703' || err.code === 'PGRST204' || /break_started_at/.test(err.message ?? '');
}

/** Load a time entry the caller owns (as the worker), or throw 404. */
async function loadOwnEntry(id: string, workerId: string): Promise<EntryRow> {
  const { data, error } = await adminDb
    .from('time_entries').select('*').eq('id', id).eq('worker_id', workerId).maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, 'Not found');
  return data as EntryRow;
}

/**
 * GET /api/time-entries/mine — the caller's own time entries, newest first,
 * with the shift's title/company, whether the shift has been paid out, the
 * pay `timeline` (Worked → Approved → Paid) and the `expected_pay`.
 */
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const { data: entries, error } = await adminDb
      .from('time_entries')
      .select('id, shift_id, worker_id, clock_in, clock_out, break_minutes, total_hours, total_pay, fee, approved, approved_at, approved_pay, regular_hours, overtime_hours, clocked_hours, worker_ack, worker_ack_at, dispute_note')
      .eq('worker_id', req.userId)
      .order('clock_in', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    const rows = (entries ?? []) as EntryRow[];
    const shiftIds = [...new Set(rows.map((r) => r.shift_id).filter(Boolean))];

    const shiftMap = new Map<string, { title: string | null; company_name: string | null; start_time: string | null } & PayShift>();
    let paidMap = new Map<string, PaidRow>();
    if (shiftIds.length) {
      const [{ data: shifts, error: sErr }, pays] = await Promise.all([
        adminDb.from('shifts').select('id, title, company_name, start_time, pay_rate, pay_period').in('id', shiftIds),
        paidByShift(req.userId!, shiftIds),
      ]);
      if (sErr) return res.status(500).json({ error: sErr.message });
      for (const s of shifts ?? []) {
        shiftMap.set(s.id, {
          title: s.title ?? null, company_name: s.company_name ?? null, start_time: s.start_time ?? null,
          pay_rate: s.pay_rate ?? null, pay_period: s.pay_period ?? null,
        });
      }
      paidMap = pays;
    }

    return res.json(rows.map((r) => {
      const s = shiftMap.get(r.shift_id);
      const paid = paidMap.get(r.shift_id) ?? null;
      return {
        id: r.id,
        shift_id: r.shift_id,
        clock_in: r.clock_in ?? null,
        clock_out: r.clock_out ?? null,
        break_minutes: r.break_minutes ?? 0,
        total_hours: r.total_hours ?? null,
        total_pay: r.total_pay ?? null,
        approved: r.approved ?? false,
        approved_at: r.approved_at ?? null,
        approved_pay: r.approved_pay ?? null,
        regular_hours: r.regular_hours ?? null,
        overtime_hours: r.overtime_hours ?? null,
        clocked_hours: r.clocked_hours ?? null,
        worker_ack: r.worker_ack ?? null,
        worker_ack_at: r.worker_ack_at ?? null,
        dispute_note: r.dispute_note ?? null,
        hours_changed: hoursChanged({ approved: r.approved, total_hours: r.total_hours, clocked_hours: r.clocked_hours }),
        shift_title: s?.title ?? null,
        company_name: s?.company_name ?? null,
        shift_start_time: s?.start_time ?? null,
        paid: !!paid,
        timeline: timelineFor(r, paid),
        expected_pay: expectedPay(r, { pay_rate: s?.pay_rate ?? null, pay_period: s?.pay_period ?? null }),
      };
    }));
  } catch (e) {
    return sendError(res, e);
  }
});

/**
 * POST /api/time-entries/approve — the shift owner (or admin) approves a
 * clocked-out timesheet. Computes regular vs overtime hours and the final
 * approved pay. Only after this can the worker be paid.
 * Body: { shift_id, worker_id, total_hours?, break_minutes?, clock_out? }
 *   total_hours / break_minutes — manager's confirmed billable hours / break.
 *   clock_out — forgot-to-clock-out fix: only when the entry has a clock_in and
 *   no clock_out; must be after clock_in and at most 24h later. Written first
 *   (closing any open break), then the normal hours/pay computation runs.
 */
router.post('/approve', requireAuth, async (req, res) => {
  try {
    const body = req.body as {
      shift_id?: string; worker_id?: string;
      total_hours?: number; break_minutes?: number; clock_out?: string;
    };
    const { shift_id, worker_id } = body;
    if (!shift_id || !worker_id) return res.status(400).json({ error: 'shift_id and worker_id are required' });

    // Authorize first: the shift owner (or an admin). 403/404 otherwise.
    const shift = await assertShiftOwner(shift_id, req.userId!);

    const { data: found } = await adminDb
      .from('time_entries').select('*')
      .eq('shift_id', shift_id).eq('worker_id', worker_id).maybeSingle();
    if (!found) return res.status(404).json({ error: 'Timesheet not found' });
    let entry = found as EntryRow;
    if (!entry.clock_in) return res.status(409).json({ error: 'Worker has not clocked in.' });

    // Forgot-to-clock-out: the owner supplies the clock_out instant.
    if (!entry.clock_out && body.clock_out != null) {
      if (typeof body.clock_out !== 'string') return res.status(400).json({ error: 'clock_out must be an ISO timestamp' });
      const outMs = Date.parse(body.clock_out);
      const inMs = Date.parse(entry.clock_in);
      if (!Number.isFinite(outMs)) return res.status(400).json({ error: 'clock_out must be an ISO timestamp' });
      if (outMs <= inMs) return res.status(400).json({ error: 'clock_out must be after clock_in.' });
      if (outMs - inMs > MAX_LATE_CLOCK_OUT_MS) return res.status(400).json({ error: 'clock_out must be within 24 hours of clock_in.' });
      const outAt = new Date(outMs);
      const closedBreak = (entry.break_minutes ?? 0) + openBreakMinutes(entry, outAt);
      const fix: Record<string, unknown> = { clock_out: outAt.toISOString(), break_minutes: closedBreak };
      if ('break_started_at' in entry) fix.break_started_at = null;
      const { data: fixed, error: fixErr } = await adminDb
        .from('time_entries').update(fix).eq('id', entry.id).select().single();
      if (fixErr) return res.status(500).json({ error: fixErr.message });
      entry = fixed as EntryRow;
    }
    if (!entry.clock_in) return res.status(409).json({ error: 'Worker has not clocked in.' });
    if (!entry.clock_out) return res.status(409).json({ error: 'Worker has not clocked out yet.' });
    const clockIn: string = entry.clock_in;
    const clockOut: string = entry.clock_out;

    // Billable hours: manager override, else clocked minus break (computed once here).
    const breakMin = typeof body.break_minutes === 'number' && Number.isFinite(body.break_minutes)
      ? Math.max(0, Math.round(body.break_minutes))
      : (entry.break_minutes ?? 0);
    let billable: number;
    if (typeof body.total_hours === 'number' && Number.isFinite(body.total_hours)) {
      billable = round2(Math.max(0, body.total_hours));
    } else {
      billable = billableHours(clockIn, clockOut, breakMin);
    }

    const { regular, overtime, pay } = computePay(billable, shift);

    // What the worker clocked (before this approval), for the "changed" check
    // and so the app can show "5h 12m → 4h 45m" later. A forgot-to-clock-out
    // fix has no clocked figure of its own: the poster's clock-out and the
    // worker's original break stand in for it.
    const clocked = entry.clocked_hours != null
      ? Number(entry.clocked_hours)
      : entry.total_hours != null
      ? Number(entry.total_hours)
      : billableHours(clockIn, clockOut, entry.break_minutes ?? 0);
    const changed = Math.abs(billable - clocked) > UNCHANGED_TOLERANCE_H;

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
        clocked_hours: round2(clocked),
        // A (re)approval asks the worker again.
        worker_ack: null,
        worker_ack_at: null,
        dispute_note: null,
      })
      .eq('id', entry.id)
      .select().single();
    if (error) return res.status(500).json({ error: error.message });

    await createNotification({
      userId: entry.worker_id,
      fromUserId: req.userId,
      type: changed ? 'hours_updated' : 'timesheet_approved',
      title: changed ? 'Hours updated' : 'Hours approved',
      body: changed
        ? `Hours updated: ${formatHoursMinutes(clocked)} → ${formatHoursMinutes(billable)} · ${formatUsd(pay)}. Tap to accept or dispute`
        : `Hours approved · ${formatHoursMinutes(billable)} · ${formatUsd(pay)}`,
      shiftId: entry.shift_id,
      url: `/shift/${entry.shift_id}`,
    });
    return res.json(entryJson(updated as EntryRow));
  } catch (e) {
    return sendError(res, e);
  }
});

const ackBody = z.object({
  action: z.enum(['accept', 'dispute']),
  note: z.string().trim().max(500, 'Note is too long').optional(),
});

/**
 * POST /api/time-entries/:id/ack — the worker answers the approved hours.
 * Body: { action: 'accept' | 'dispute', note? }. Only the entry's worker, and
 * only once the poster approved. A dispute files a payment dispute and tells
 * the poster; accepting records the answer and nothing else.
 */
router.post('/:id/ack', requireAuth, async (req, res) => {
  try {
    const parsed = ackBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
    const { action, note } = parsed.data;

    const entry = await loadOwnEntry(String(req.params.id), req.userId!);
    if (!entry.approved) return res.status(409).json({ error: 'These hours have not been approved yet.' });
    if (entry.worker_ack) return res.status(409).json({ error: 'You already answered these hours.' });

    const ack = action === 'accept' ? 'accepted' : 'disputed';
    const { data: updated, error } = await adminDb
      .from('time_entries')
      .update({ worker_ack: ack, worker_ack_at: new Date().toISOString(), dispute_note: action === 'dispute' ? (note || null) : null })
      .eq('id', entry.id)
      .select().single();
    if (error) return res.status(500).json({ error: error.message });

    if (action === 'dispute') {
      const shift = await loadShift(entry.shift_id);
      if (shift?.client_id) {
        const { error: dErr } = await adminDb.from('disputes').insert({
          type: 'payment',
          reason: note || 'Worker disputes approved hours',
          reported_user_id: shift.client_id,
          reported_by_user_id: req.userId,
          shift_id: entry.shift_id,
          status: 'open',
        });
        if (dErr) console.error('[time-entries] dispute insert failed:', dErr.message);
        const name = await workerName(req.userId!);
        await createNotification({
          userId: shift.client_id,
          fromUserId: req.userId,
          type: 'hours_disputed',
          title: 'Hours disputed',
          body: `${name} disputed the approved hours for ${shiftDayLabel(shift)}.${note ? ` "${note}"` : ''}`,
          shiftId: entry.shift_id,
          url: `/shift/${entry.shift_id}/applicants`,
        });
      }
    }
    return res.json(entryJson(updated as EntryRow));
  } catch (e) {
    return sendError(res, e);
  }
});

/**
 * GET /api/time-entries/:shiftId — the caller's own time entry for this shift
 * (null before clock-in), with its pay `timeline` and `expected_pay`.
 */
router.get('/:shiftId', requireAuth, async (req, res) => {
  try {
    const shiftId = String(req.params.shiftId);
    const { data, error } = await adminDb
      .from('time_entries')
      .select('*')
      .eq('shift_id', shiftId)
      .eq('worker_id', req.userId)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.json(null);
    const entry = data as EntryRow;
    const [{ data: shift }, paidMap] = await Promise.all([
      adminDb.from('shifts').select('pay_rate, pay_period').eq('id', shiftId).maybeSingle(),
      paidByShift(req.userId!, [shiftId]),
    ]);
    const paid = paidMap.get(shiftId) ?? null;
    return res.json({
      ...entryJson(entry),
      paid: !!paid,
      timeline: timelineFor(entry, paid),
      expected_pay: expectedPay(entry, { pay_rate: shift?.pay_rate ?? null, pay_period: shift?.pay_period ?? null }),
    });
  } catch (e) {
    return sendError(res, e);
  }
});

/** How far from the venue a worker may be and still clock in. */
const GEOFENCE_MILES = 1;

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const clockInBody = z.object({
  shift_id: z.string().min(1, 'shift_id is required'),
  /** The worker's live GPS position, checked against the venue. */
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

/**
 * POST /api/time-entries { shift_id, lat?, lng? } — clock in.
 * Server-side guards (the app checks the same things for a friendlier flow,
 * but only this copy is trusted): the worker is booked, the shift is not
 * cancelled, it has not ended, clock-in has opened (1h before start), and —
 * when the shift has venue coordinates — the worker is within 1 mile of them.
 */
router.post('/', requireAuth, async (req, res) => {
  const parsed = clockInBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' });
  const { shift_id, lat, lng } = parsed.data;

  // Only a worker booked (accepted) onto this shift may clock in.
  const { data: booked } = await adminDb
    .from('applications')
    .select('id, shift_id, worker_id, arrival_status')
    .eq('shift_id', shift_id)
    .eq('worker_id', req.userId)
    .eq('status', 'accepted')
    .maybeSingle();
  if (!booked) {
    return res.status(403).json({ error: 'You are not booked for this shift.' });
  }

  const { data: sh } = await adminDb
    .from('shifts').select('start_time, end_time, status, lat, lng').eq('id', shift_id).maybeSingle();
  if (!sh) return res.status(404).json({ error: 'Shift not found' });
  if (sh.status === 'cancelled') {
    return res.status(409).json({ error: 'This shift was cancelled, so there is nothing to clock in to.' });
  }
  const now = Date.now();
  // Clock-in window: not more than 1 hour before the shift's start (call
  // time), and never once the shift has ended.
  const startMs = sh.start_time ? Date.parse(sh.start_time) : NaN;
  const endMs = sh.end_time ? Date.parse(sh.end_time) : NaN;
  if (Number.isFinite(startMs) && now < startMs - 60 * 60 * 1000) {
    return res.status(409).json({ error: 'Clock-in has not opened for this shift yet.' });
  }
  if (Number.isFinite(endMs) && now > endMs) {
    return res.status(409).json({ error: 'This shift has already ended, so clock-in is closed. Message the organizer if you worked it.' });
  }

  // Geofence: with venue coordinates on file, the worker has to be there.
  const venueLat = sh.lat != null ? Number(sh.lat) : NaN;
  const venueLng = sh.lng != null ? Number(sh.lng) : NaN;
  if (Number.isFinite(venueLat) && Number.isFinite(venueLng)) {
    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ error: 'We need your location to confirm you are at the venue. Turn on location access and try again.' });
    }
    const distance = haversineMiles(lat, lng, venueLat, venueLng);
    if (distance > GEOFENCE_MILES) {
      const shown = distance < 10 ? distance.toFixed(1) : Math.round(distance).toString();
      return res.status(409).json({
        error: `You're about ${shown} mi from the venue. Get within ${GEOFENCE_MILES} mile to clock in.`,
        distance_miles: Math.round(distance * 10) / 10,
      });
    }
  }

  const payload = { shift_id, worker_id: req.userId, clock_in: new Date().toISOString() };
  const { data, error } = await adminDb
    .from('time_entries')
    .upsert(payload, { onConflict: 'shift_id,worker_id', ignoreDuplicates: true })
    .select()
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(409).json({ error: 'Already clocked in' });
  // Clocking in means they're here: mark the application 'arrived' (the owner
  // sees "Clocked in", so no extra notification is sent).
  await setArrivalStatus(booked, 'arrived', { notify: false });
  return res.status(201).json(data);
});

/**
 * POST /api/time-entries/:id/break/start — the worker starts a break.
 * Requires a clocked-in, not-yet-clocked-out entry with no open break.
 */
router.post('/:id/break/start', requireAuth, async (req, res) => {
  try {
    const entry = await loadOwnEntry(String(req.params.id), req.userId!);
    if (!entry.clock_in) return res.status(409).json({ error: 'Not clocked in.' });
    if (entry.clock_out) return res.status(409).json({ error: 'Already clocked out.' });
    if (entry.break_started_at) return res.status(409).json({ error: 'A break is already in progress.' });
    const { data, error } = await adminDb
      .from('time_entries')
      .update({ break_started_at: new Date().toISOString() })
      .eq('id', entry.id)
      .select().single();
    if (error) {
      if (isMissingColumn(error)) return res.status(503).json({ error: 'Break tracking is not enabled on the server yet.' });
      return res.status(500).json({ error: error.message });
    }
    return res.json(data);
  } catch (e) {
    return sendError(res, e);
  }
});

/**
 * POST /api/time-entries/:id/break/stop — the worker ends the open break.
 * Adds the elapsed minutes to break_minutes and clears break_started_at.
 */
router.post('/:id/break/stop', requireAuth, async (req, res) => {
  try {
    const entry = await loadOwnEntry(String(req.params.id), req.userId!);
    if (entry.clock_out) return res.status(409).json({ error: 'Already clocked out.' });
    if (!entry.break_started_at) return res.status(409).json({ error: 'No break in progress.' });
    const now = new Date();
    const breakMinutes = (entry.break_minutes ?? 0) + openBreakMinutes(entry, now);
    const { data, error } = await adminDb
      .from('time_entries')
      .update({ break_minutes: breakMinutes, break_started_at: null })
      .eq('id', entry.id)
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  } catch (e) {
    return sendError(res, e);
  }
});

/**
 * PATCH /api/time-entries/:id — clock out (worker-owned).
 * The server sets clock_out = now, closes any open break, and computes
 * total_hours = (clock_out − clock_in) − break and total_pay from the shift's
 * pay_rate / pay_period. Client-supplied total_hours / total_pay / fee are
 * ignored. A client break_minutes is honoured only when the server has no
 * break of its own on record (legacy clients).
 */
router.patch('/:id', requireAuth, async (req, res) => {
  const body = req.body as Record<string, unknown>;
  try {
    const entry = await loadOwnEntry(String(req.params.id), req.userId!);
    if (!entry.clock_in) return res.status(409).json({ error: 'Not clocked in.' });
    if (entry.clock_out) return res.status(409).json({ error: 'Already clocked out.' });
    if (body.clock_out == null) return res.status(400).json({ error: 'clock_out is required' });

    const now = new Date();
    let breakMinutes = (entry.break_minutes ?? 0) + openBreakMinutes(entry, now);
    const serverTrackedBreak = (entry.break_minutes ?? 0) > 0 || !!entry.break_started_at;
    if (!serverTrackedBreak && typeof body.break_minutes === 'number' && Number.isFinite(body.break_minutes)) {
      breakMinutes = Math.max(0, Math.round(body.break_minutes));
    }

    const { data: shift } = await adminDb
      .from('shifts').select('pay_rate, pay_period').eq('id', entry.shift_id).maybeSingle();
    const payShift: PayShift = { pay_rate: shift?.pay_rate ?? null, pay_period: shift?.pay_period ?? null };

    const clockOut = now.toISOString();
    const hours = billableHours(entry.clock_in, clockOut, breakMinutes);
    // Same formula the poster's approval uses, so the two numbers agree.
    const { regular, overtime, pay } = computePay(hours, payShift);

    const updates: Record<string, unknown> = {
      clock_out: clockOut,
      break_minutes: breakMinutes,
      total_hours: hours,
      clocked_hours: hours,
      regular_hours: regular,
      overtime_hours: overtime,
      total_pay: pay,
      fee: 0,
    };
    if ('break_started_at' in entry) updates.break_started_at = null;

    const { data, error } = await adminDb
      .from('time_entries')
      .update(updates)
      .eq('id', entry.id)
      .eq('worker_id', req.userId)
      .select()
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Not found' });

    // The trust moment: tell the worker exactly what was recorded.
    await createNotification({
      userId: entry.worker_id,
      type: 'hours_recorded',
      title: 'Shift complete',
      body: `You worked ${formatHoursMinutes(hours)} · ${formatUsd(pay)} (pending approval)`,
      shiftId: entry.shift_id,
      url: `/shift/${entry.shift_id}`,
    });
    // …and the poster that there is a timesheet waiting for them.
    const owned = await loadShift(entry.shift_id);
    if (owned?.client_id) {
      await createNotification({
        userId: owned.client_id,
        fromUserId: entry.worker_id,
        type: 'timesheet_submitted',
        title: 'Timesheet submitted',
        body: `${await workerName(entry.worker_id)} clocked out of ${shiftDayLabel(owned)} · ${formatHoursMinutes(hours)} · ${formatUsd(pay)}. Review and approve it from the roster.`,
        shiftId: entry.shift_id,
        url: `/shift/${entry.shift_id}/applicants`,
      });
    }
    return res.json(entryJson(data as EntryRow));
  } catch (e) {
    return sendError(res, e);
  }
});

export default router;
