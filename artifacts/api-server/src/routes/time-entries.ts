import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { createNotification } from './notifications.js';
import { HttpError, sendError } from '../lib/httpError.js';
import { assertShiftOwner } from '../lib/shiftAccess.js';
import { setArrivalStatus } from './applications.js';

const router = Router();

const OT_THRESHOLD = 8;    // hours per shift before overtime
const OT_MULTIPLIER = 1.5; // overtime pay multiplier
const MAX_LATE_CLOCK_OUT_MS = 24 * 60 * 60 * 1000; // manager-supplied clock_out ≤ 24h after clock_in

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
  [k: string]: unknown;
};

type PayShift = { pay_rate: number | null; pay_period: string | null };

const round2 = (n: number) => Math.round(n * 100) / 100;

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
 * with the shift's title/company and whether the shift has been paid out.
 */
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const { data: entries, error } = await adminDb
      .from('time_entries')
      .select('id, shift_id, clock_in, clock_out, break_minutes, total_hours, total_pay, approved, approved_at, approved_pay')
      .eq('worker_id', req.userId)
      .order('clock_in', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    const rows = entries ?? [];
    const shiftIds = [...new Set(rows.map((r) => r.shift_id).filter(Boolean))];

    const shiftMap = new Map<string, { title: string | null; company_name: string | null }>();
    const paidSet = new Set<string>();
    if (shiftIds.length) {
      const [{ data: shifts, error: sErr }, { data: pays, error: pErr }] = await Promise.all([
        adminDb.from('shifts').select('id, title, company_name').in('id', shiftIds),
        adminDb.from('payments').select('shift_id')
          .eq('worker_id', req.userId).eq('status', 'completed').in('shift_id', shiftIds),
      ]);
      if (sErr) return res.status(500).json({ error: sErr.message });
      if (pErr) return res.status(500).json({ error: pErr.message });
      for (const s of shifts ?? []) shiftMap.set(s.id, { title: s.title ?? null, company_name: s.company_name ?? null });
      for (const p of pays ?? []) if (p.shift_id) paidSet.add(p.shift_id);
    }

    return res.json(rows.map((r) => {
      const s = shiftMap.get(r.shift_id);
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
        shift_title: s?.title ?? null,
        company_name: s?.company_name ?? null,
        paid: paidSet.has(r.shift_id),
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

    const hourly = isHourly(shift.pay_period);
    const regular = hourly ? Math.min(billable, OT_THRESHOLD) : billable;
    const overtime = hourly ? Math.max(0, billable - OT_THRESHOLD) : 0;
    const rate = Number(shift.pay_rate ?? 0);
    const pay = hourly
      ? round2(regular * rate + overtime * rate * OT_MULTIPLIER)
      : payFor(billable, shift);

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
    return sendError(res, e);
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
    const pay = payFor(hours, payShift);

    const updates: Record<string, unknown> = {
      clock_out: clockOut,
      break_minutes: breakMinutes,
      total_hours: hours,
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
    return res.json(data);
  } catch (e) {
    return sendError(res, e);
  }
});

export default router;
