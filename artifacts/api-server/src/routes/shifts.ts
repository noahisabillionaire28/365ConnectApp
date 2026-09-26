import { Router } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createNotification } from './notifications.js';
import { findTimeConflictInWindow } from './applications.js';
import { ensureShiftGroupChat, insertSystemMessage } from '../lib/chat.js';
import { rosterAllows, assertShiftOwner } from '../lib/shiftAccess.js';
import { getRoleInfo } from '../lib/roleCache.js';
import { sendError } from '../lib/httpError.js';
import { formatShiftInstant, formatShiftWindow, formatUsd } from '../lib/shiftLabel.js';
import {
  zonedTimeToUtc, utcToZonedParts, nextCalendarDay, isCalendarDate, formatCalendarDate,
} from '../lib/shiftTime.js';

const router = Router();

/** A recurring series creates at most this many shifts. */
export const MAX_SERIES_OCCURRENCES = 12;

/**
 * Day-of details (who to call, where to park, special instructions) are for
 * the people actually on the shift. Everyone else sees the listing without
 * them.
 */
const PRIVATE_SHIFT_FIELDS = ['contact_phone', 'point_of_contact', 'special_instructions', 'parking_notes'] as const;

/** Owner, admin, or a worker who is booked / on the waitlist for the shift. */
async function canSeePrivateDetails(shift: { id: string; client_id: string | null }, viewerId: string): Promise<boolean> {
  if (shift.client_id === viewerId) return true;
  const { count } = await adminDb
    .from('applications')
    .select('*', { count: 'exact', head: true })
    .eq('shift_id', shift.id)
    .eq('worker_id', viewerId)
    .in('status', ['accepted', 'standby']);
  if ((count ?? 0) > 0) return true;
  return (await getRoleInfo(viewerId)).isAdmin;
}

/**
 * Roster-only shifts are readable by the poster, workers on their roster and
 * admins. Everyone else (including signed-out viewers) gets a 404, the same
 * answer as a shift that does not exist, so the link discloses nothing.
 */
async function canViewShift(
  shift: { client_id: string | null; visibility?: string | null },
  viewerId: string | null | undefined,
): Promise<boolean> {
  if ((shift.visibility ?? 'public') !== 'roster') return true;
  if (!viewerId) return false;
  if (shift.client_id === viewerId) return true;
  if (await rosterAllows(shift, viewerId)) return true;
  return (await getRoleInfo(viewerId)).isAdmin;
}

// ─── Validation ───────────────────────────────────────────────────────────────

const isoInstant = z.string().refine((s) => Number.isFinite(Date.parse(s)), 'Invalid date/time');
const ianaZone = z.string().min(1).max(64).refine((tz) => {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}, 'Invalid time zone');

const STATUSES = ['open', 'filled', 'cancelled', 'completed'] as const;
const PAY_PERIODS = ['hr', 'day', 'event'] as const;

const shiftFields = z.object({
  title:           z.string().trim().min(3, 'Title must be at least 3 characters').max(80, 'Title is too long'),
  description:     z.string().max(4000).nullable().optional(),
  location:        z.string().max(300).nullable().optional(),
  event_type:      z.string().max(60).nullable().optional(),
  job_type:        z.string().trim().min(1, 'Pick a job type').max(60),
  job_types:       z.array(z.string().trim().min(1).max(60)).max(10).optional(),
  pay_rate:        z.coerce.number().positive('Pay must be greater than zero').max(10_000),
  pay_period:      z.enum(PAY_PERIODS).optional(),
  start_time:      isoInstant,
  end_time:        isoInstant,
  timezone:        ianaZone.optional(),
  spots_available: z.coerce.number().int().min(1, 'At least one spot').max(200),
  lat:             z.coerce.number().min(-90).max(90).nullable().optional(),
  lng:             z.coerce.number().min(-180).max(180).nullable().optional(),
  cover_image:     z.string().max(2000).nullable().optional(),
  company_name:    z.string().max(120).nullable().optional(),
  requirements:    z.array(z.string().max(200)).max(30).optional(),
  dress_code:      z.string().max(300).nullable().optional(),
  dress_code_items: z.array(z.string().max(100)).max(30).optional(),
  point_of_contact: z.string().max(120).nullable().optional(),
  contact_phone:   z.string().max(40).nullable().optional(),
  unit_info:       z.string().max(120).nullable().optional(),
  parking_notes:   z.string().max(1000).nullable().optional(),
  special_instructions: z.string().max(4000).nullable().optional(),
  repeat_type:     z.string().max(30).optional(),
  instant_claim:   z.coerce.boolean().optional(),
  status:          z.enum(STATUSES).optional(),
  /** 'roster' = only workers on the poster's roster can see/apply/claim. */
  visibility:      z.enum(['public', 'roster']).optional(),
});

/** Ids of posters who have the viewer on their roster (follower = poster). */
async function rosterPostersFor(viewerId: string): Promise<string[]> {
  const { data } = await adminDb.from('follows').select('follower_id').eq('following_id', viewerId);
  return (data ?? []).map((f) => f.follower_id as string);
}

/** Cross-field rules shared by create and update. */
function timeProblems(start?: string, end?: string, requireFuture = false): string | null {
  if (start && end) {
    const s = Date.parse(start), e = Date.parse(end);
    if (e <= s) return 'End time must be after the start time';
    if (e - s > 24 * 3600_000) return 'A shift cannot be longer than 24 hours';
    if (e - s < 30 * 60_000) return 'A shift must be at least 30 minutes';
  }
  if (requireFuture && end && Date.parse(end) < Date.now()) return 'That date and time has already passed';
  return null;
}

function firstIssue(err: z.ZodError): string {
  const i = err.issues[0];
  return i ? `${i.message}` : 'Invalid shift';
}

// ─── Lazy lifecycle sweep ─────────────────────────────────────────────────────

/**
 * Shifts whose end has passed are marked completed. Runs opportunistically on
 * the reads that show lifecycle state, so no cron is needed.
 */
async function sweepEnded(clientId?: string) {
  let q = adminDb.from('shifts')
    .update({ status: 'completed' })
    .in('status', ['open', 'filled'])
    .lt('end_time', new Date().toISOString());
  if (clientId) q = q.eq('client_id', clientId);
  await q;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/** GET /api/shifts — open shifts, optional filters (past shifts are never returned). Signed-in only. */
router.get('/', requireAuth, async (req, res) => {
  const { job_type, status = 'open', limit = '50', offset = '0', event_id } = req.query as Record<string, string>;
  const lim = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
  const off = Math.max(parseInt(offset) || 0, 0);
  // event_id lists all positions of one event, regardless of status.
  let q = event_id
    ? adminDb.from('shifts').select('*').eq('event_id', event_id)
    : adminDb.from('shifts').select('*').eq('status', status);
  if (!event_id) {
    // Roster-only shifts are visible to the poster and to workers on their
    // roster, whatever status is asked for.
    const allowed = [req.userId!, ...await rosterPostersFor(req.userId!)];
    q = q.or(`visibility.eq.public,client_id.in.(${allowed.join(',')})`);
  }
  if (!event_id && status === 'open') {
    // The feed shows what a worker can still take: not ended, soonest first.
    q = q.gt('end_time', new Date().toISOString()).order('start_time', { ascending: true });
  } else {
    q = q.order('created_at', { ascending: false });
  }
  if (job_type) {
    q = q.or(`job_type.eq.${job_type},job_types.cs.{${job_type}}`);
  }
  const { data: rawShifts, error } = await q.range(off, off + lim - 1);
  if (error) return res.status(500).json({ error: error.message });

  // The event_id branch skipped the visibility filter above: drop the
  // roster-only positions this viewer may not see.
  let shifts = rawShifts ?? [];
  if (event_id && shifts.some((s: any) => s.visibility === 'roster')) {
    const visible: any[] = [];
    for (const s of shifts) if (await canViewShift(s, req.userId)) visible.push(s);
    shifts = visible;
  }

  const clientIds = [...new Set((shifts ?? []).map((s: any) => s.client_id).filter(Boolean))];
  const userMap = new Map<string, any>();
  if (clientIds.length) {
    const { data: users, error: uErr } = await adminDb
      .from('users')
      .select('id, username, company_name, photo_url')
      .in('id', clientIds);
    if (uErr) return res.status(500).json({ error: uErr.message });
    for (const u of users ?? []) userMap.set(u.id, u);
  }

  const rows = (shifts ?? []).map((s: any) => {
    const u = userMap.get(s.client_id);
    return {
      ...s,
      client_username: u?.username ?? null,
      client_company: u?.company_name ?? null,
      client_photo_url: u?.photo_url ?? null,
    };
  });
  return res.json(rows);
});

/** GET /api/shifts/my — shifts posted by the current user (client) */
router.get('/my', requireAuth, async (req, res) => {
  await sweepEnded(req.userId!);

  const { data, error } = await adminDb
    .from('shifts')
    .select('*')
    .eq('client_id', req.userId)
    .order('start_time', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  // Applicants waiting on a decision, counted in one query for every shift
  // (the dashboard used to make one request per shift for this).
  const ids = (data ?? []).map((s) => s.id);
  const pending = new Map<string, number>();
  if (ids.length) {
    const { data: apps } = await adminDb
      .from('applications')
      .select('shift_id')
      .in('shift_id', ids)
      .eq('status', 'pending');
    for (const a of apps ?? []) pending.set(a.shift_id, (pending.get(a.shift_id) ?? 0) + 1);
  }
  // Swaps the worker side has agreed on and only the poster can finish.
  const swaps = new Map<string, number>();
  if (ids.length) {
    const { data: sw } = await adminDb
      .from('shift_swaps')
      .select('shift_id')
      .in('shift_id', ids)
      .eq('status', 'accepted');
    for (const s of sw ?? []) swaps.set(s.shift_id, (swaps.get(s.shift_id) ?? 0) + 1);
  }
  return res.json((data ?? []).map((s) => ({
    ...s, pending_count: pending.get(s.id) ?? 0, swap_count: swaps.get(s.id) ?? 0,
  })));
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/shifts/:id — single shift. Signed-in only. Contact and day-of
 * details are stripped unless the viewer owns the shift, is booked or
 * waitlisted on it, or is an admin.
 */
router.get('/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  if (!UUID_RE.test(id)) {
    return res.status(404).json({ error: 'Not found' });
  }
  const { data: full, error } = await adminDb
    .from('shifts')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!full) return res.status(404).json({ error: 'Not found' });
  if (!(await canViewShift(full, req.userId))) return res.status(404).json({ error: 'Not found' });

  const shift: Record<string, any> = { ...full };
  if (!(await canSeePrivateDetails(full, req.userId!))) {
    for (const f of PRIVATE_SHIFT_FIELDS) shift[f] = null;
  }

  // Reflect reality even if the sweep hasn't run for this poster yet.
  if ((shift.status === 'open' || shift.status === 'filled') && Date.parse(shift.end_time) < Date.now()) {
    shift.status = 'completed';
    void adminDb.from('shifts').update({ status: 'completed' }).eq('id', id).in('status', ['open', 'filled']);
  }

  let u: any = null;
  if (shift.client_id) {
    const { data: user, error: uErr } = await adminDb
      .from('users')
      .select('id, username, company_name, bio, photo_url, rating')
      .eq('id', shift.client_id)
      .maybeSingle();
    if (uErr) return res.status(500).json({ error: uErr.message });
    u = user;
  }

  // Where this shift sits in its recurring series ("3 of 5"); a series has at
  // most 12 shifts, so this is one small query.
  let series_index: number | null = null;
  let series_count: number | null = null;
  if (shift.series_id) {
    const siblings = await seriesSiblings(shift.series_id);
    const idx = siblings.findIndex((s) => s.id === id);
    if (idx >= 0) { series_index = idx + 1; series_count = siblings.length; }
  }

  return res.json({
    ...shift,
    series_index,
    series_count,
    company_name: shift.company_name || u?.company_name || u?.bio || (u?.username ? `@${u.username}` : null),
    client_username: u?.username ?? null,
    client_company: u?.company_name ?? null,
    client_photo_url: u?.photo_url ?? null,
    client_rating: u?.rating ?? null,
  });
});

/** The poster's display name for a shift: their company, else their name, else their @username. */
async function posterCompanyName(userId: string): Promise<string | null> {
  const { data } = await adminDb
    .from('users').select('company_name, bio, username').eq('id', userId).maybeSingle();
  return data?.company_name || data?.bio || (data?.username ? `@${data.username}` : null);
}

type ShiftFields = z.infer<typeof shiftFields>;

/**
 * The row a validated create body becomes. Shared by the single-shift create
 * and the recurring series, so every occurrence is built exactly like a
 * one-off shift (only the instants and the series link differ).
 */
async function createShiftRow(
  b: ShiftFields,
  clientId: string,
  overrides: Partial<{ start_time: string; end_time: string; series_id: string; repeat_type: string; company_name: string | null }> = {},
) {
  const jobTypes = b.job_types?.length ? b.job_types : [b.job_type];
  return {
    client_id: clientId,
    title: b.title,
    description: b.description ?? null,
    location: b.location ?? null,
    event_type: b.event_type ?? null,
    job_type: b.job_type,
    job_types: jobTypes,
    pay_rate: b.pay_rate,
    pay_period: b.pay_period ?? 'hr',
    start_time: b.start_time,
    end_time: b.end_time,
    timezone: b.timezone ?? 'America/New_York',
    spots_available: b.spots_available,
    spots_filled: 0,
    status: 'open',
    lat: b.lat ?? null,
    lng: b.lng ?? null,
    cover_image: b.cover_image ?? null,
    // Never show "Private Client" for a real poster — default to their name.
    company_name: b.company_name || await posterCompanyName(clientId),
    requirements: b.requirements ?? [],
    dress_code: b.dress_code ?? null,
    dress_code_items: b.dress_code_items ?? [],
    point_of_contact: b.point_of_contact ?? null,
    contact_phone: b.contact_phone ?? null,
    unit_info: b.unit_info ?? null,
    parking_notes: b.parking_notes ?? null,
    special_instructions: b.special_instructions ?? null,
    repeat_type: b.repeat_type ?? 'once',
    instant_claim: b.instant_claim ?? false,
    visibility: b.visibility ?? 'public',
    ...overrides,
  };
}

/** POST /api/shifts — create shift */
router.post('/', requireAuth, requireRole('client', 'staffer'), async (req, res) => {
  const parsed = shiftFields.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed.error) });
  const b = parsed.data;
  const problem = timeProblems(b.start_time, b.end_time, true);
  if (problem) return res.status(400).json({ error: problem });

  const payload = await createShiftRow(b, req.userId!);
  const { data, error } = await adminDb
    .from('shifts')
    .insert(payload)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json(data);
});

/**
 * POST /api/shifts/series — create a recurring series: one shift per local
 * date in `occurrences`, all with the same details. `start_time`/`end_time`
 * are the first occurrence's instants exactly as the single-shift create
 * sends them; their wall-clock times in the shift's zone are re-applied to
 * every date (an end before the start rolls to the next day, as today).
 */
const localDate = z.string().refine(isCalendarDate, 'Dates must be YYYY-MM-DD');
const seriesRule = z.object({
  type:     z.enum(['daily', 'weekly', 'custom']),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  ends:     z.enum(['on', 'after']).optional(),
  end_date: z.string().max(10).optional(),
  count:    z.number().int().min(1).max(MAX_SERIES_OCCURRENCES).optional(),
}).optional();
const seriesSchema = shiftFields.extend({
  occurrences: z.array(localDate).min(1, 'Pick at least one date').max(MAX_SERIES_OCCURRENCES, `A series can have at most ${MAX_SERIES_OCCURRENCES} shifts`),
  rule: seriesRule,
});

router.post('/series', requireAuth, requireRole('client', 'staffer'), async (req, res) => {
  const parsed = seriesSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed.error) });
  const b = parsed.data;
  const tz = b.timezone ?? 'America/New_York';

  // The template pair must itself be a valid shift (length rules).
  const shape = timeProblems(b.start_time, b.end_time, false);
  if (shape) return res.status(400).json({ error: shape });

  const startLocal = utcToZonedParts(b.start_time, tz);
  const endLocal   = utcToZonedParts(b.end_time, tz);
  if (!startLocal.time || !endLocal.time) return res.status(400).json({ error: 'Invalid date/time' });
  const overnight = endLocal.time <= startLocal.time;

  const dates = [...new Set(b.occurrences)].sort();
  if (dates.length > MAX_SERIES_OCCURRENCES) {
    return res.status(400).json({ error: `A series can have at most ${MAX_SERIES_OCCURRENCES} shifts` });
  }
  const windows = dates.map((date) => ({
    date,
    start_time: zonedTimeToUtc(date, startLocal.time, tz),
    end_time:   zonedTimeToUtc(overnight ? nextCalendarDay(date) : date, endLocal.time, tz),
  }));
  const bad = windows.filter((w) => timeProblems(w.start_time, w.end_time, true)).map((w) => formatCalendarDate(w.date));
  if (bad.length) {
    return res.status(400).json({
      error: bad.length === 1
        ? `${bad[0]} has already passed. Remove it or pick a later time.`
        : `These dates have already passed: ${bad.join(', ')}. Remove them or pick a later time.`,
    });
  }

  const { data: series, error: sErr } = await adminDb
    .from('shift_series')
    .insert({
      client_id: req.userId,
      title: b.title,
      rule: { ...(b.rule ?? { type: 'custom' }), occurrences: dates },
      timezone: tz,
    })
    .select('id')
    .single();
  if (sErr || !series) return res.status(500).json({ error: sErr?.message ?? 'Could not create the series' });

  const companyName = b.company_name || await posterCompanyName(req.userId!);
  const rows = [];
  for (const w of windows) {
    rows.push(await createShiftRow(b, req.userId!, {
      start_time: w.start_time, end_time: w.end_time, series_id: series.id,
      repeat_type: b.rule?.type ?? 'custom', company_name: companyName,
    }));
  }
  const { data, error } = await adminDb.from('shifts').insert(rows).select().order('start_time', { ascending: true });
  if (error) {
    // Leave no empty series behind.
    await adminDb.from('shift_series').delete().eq('id', series.id);
    return res.status(500).json({ error: error.message });
  }
  return res.status(201).json({ series_id: series.id, shifts: data ?? [] });
});

/** The ordered siblings of a series (ids + starts), oldest first. */
async function seriesSiblings(seriesId: string) {
  const { data } = await adminDb
    .from('shifts')
    .select('id, title, start_time, end_time, timezone, status, spots_available, spots_filled')
    .eq('series_id', seriesId)
    .order('start_time', { ascending: true });
  return data ?? [];
}

/** GET /api/shifts/series/:id — every shift in a series (owner or admin). */
router.get('/series/:id', requireAuth, requireRole('client', 'staffer'), async (req, res) => {
  const id = String(req.params.id);
  if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Not found' });
  const { data: series, error } = await adminDb
    .from('shift_series').select('id, client_id, title, rule, timezone, created_at').eq('id', id).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!series) return res.status(404).json({ error: 'Not found' });
  if (series.client_id !== req.userId && !(await getRoleInfo(req.userId!)).isAdmin) {
    return res.status(404).json({ error: 'Not found' });
  }
  const shifts = await seriesSiblings(id);
  return res.json({ ...series, shifts: shifts.map((s, i) => ({ ...s, series_index: i + 1, series_count: shifts.length })) });
});

/**
 * POST /api/shifts/:id/cancel-series-future — cancel this shift and every
 * later shift in its series that has not started. Each one is cancelled the
 * way a single cancel is (workers told, offers closed, chat line posted).
 */
router.post('/:id/cancel-series-future', requireAuth, requireRole('client', 'staffer'), async (req, res) => {
  const id = String(req.params.id);
  if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Not found' });
  try {
    await assertShiftOwner(id, req.userId!);
  } catch (e) {
    return sendError(res, e);
  }
  const { data: current, error: curErr } = await adminDb
    .from('shifts').select('id, series_id, start_time').eq('id', id).maybeSingle();
  if (curErr) return res.status(500).json({ error: curErr.message });
  if (!current) return res.status(404).json({ error: 'Not found' });
  if (!current.series_id) return res.status(400).json({ error: 'This shift is not part of a series' });

  const nowIso = new Date().toISOString();
  const { data: targets, error: tErr } = await adminDb
    .from('shifts')
    .select('id, client_id, title, timezone, start_time, end_time, spots_available, pay_rate, pay_period, location, status')
    .eq('series_id', current.series_id)
    .gte('start_time', current.start_time)
    .gt('start_time', nowIso)
    .in('status', ['open', 'filled'])
    .order('start_time', { ascending: true });
  if (tErr) return res.status(500).json({ error: tErr.message });

  const cancelled: string[] = [];
  for (const shift of targets ?? []) {
    const { data: updated } = await adminDb
      .from('shifts').update({ status: 'cancelled' })
      .eq('id', shift.id).in('status', ['open', 'filled'])
      .select('id').maybeSingle();
    if (!updated) continue;
    cancelled.push(shift.id);
    try {
      await announceCancellation(shift, req.userId!);
    } catch (e) {
      console.error('[shifts] series cancel notifications failed:', e);
    }
  }
  return res.json({ cancelled: cancelled.length, ids: cancelled });
});

/**
 * POST /api/shifts/event — create a multi-position event. Shared event details
 * apply to every position; each position becomes its own shift (own role, pay
 * rate, headcount) grouped by a shared event_id.
 * Body: { ...sharedShiftFields, positions: [{ job_type, pay_rate, spots }] }
 */
const positionSchema = z.object({
  job_type: z.string().trim().min(1).max(60),
  pay_rate: z.coerce.number().positive().max(10_000),
  spots:    z.coerce.number().int().min(1).max(200).optional(),
});
const eventSchema = shiftFields
  .omit({ job_type: true, job_types: true, pay_rate: true, spots_available: true })
  .extend({ positions: z.array(positionSchema).min(1, 'At least one position is required').max(20) });

router.post('/event', requireAuth, requireRole('client', 'staffer'), async (req, res) => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed.error) });
  const b = parsed.data;
  const problem = timeProblems(b.start_time, b.end_time, true);
  if (problem) return res.status(400).json({ error: problem });

  const event_id = randomUUID();
  const shared = {
    client_id: req.userId,
    title: b.title,
    description: b.description ?? null,
    location: b.location ?? null,
    event_type: b.event_type ?? null,
    pay_period: b.pay_period ?? 'hr',
    start_time: b.start_time,
    end_time: b.end_time,
    timezone: b.timezone ?? 'America/New_York',
    status: 'open',
    spots_filled: 0,
    lat: b.lat ?? null,
    lng: b.lng ?? null,
    cover_image: b.cover_image ?? null,
    company_name: b.company_name || await posterCompanyName(req.userId!),
    dress_code: b.dress_code ?? null,
    special_instructions: b.special_instructions ?? null,
    instant_claim: b.instant_claim ?? false,
    visibility: b.visibility ?? 'public',
    event_id,
  };
  const rows = b.positions.map((p) => ({
    ...shared,
    job_type: p.job_type,
    job_types: [p.job_type],
    pay_rate: p.pay_rate,
    spots_available: p.spots ?? 1,
  }));

  const { data, error } = await adminDb.from('shifts').insert(rows).select();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ event_id, positions: data });
});

/** PATCH /api/shifts/:id — update shift (owner or admin) */
router.patch('/:id', requireAuth, requireRole('client', 'staffer'), async (req, res) => {
  const id = String(req.params.id);
  if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Not found' });

  const parsed = shiftFields.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed.error) });
  const b = parsed.data;

  // Only fields actually sent are updated (zod drops unknown keys for us).
  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(b)) if (v !== undefined) updates[k] = v;
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No valid fields' });

  // Owner or admin — the same rule every other shift action uses.
  try {
    await assertShiftOwner(id, req.userId!);
  } catch (e) {
    return sendError(res, e);
  }
  const { data: current, error: curErr } = await adminDb
    .from('shifts')
    .select('id, client_id, status, title, start_time, end_time, timezone, spots_available, pay_rate, pay_period, location')
    .eq('id', id)
    .maybeSingle();
  if (curErr) return res.status(500).json({ error: curErr.message });
  if (!current) return res.status(404).json({ error: 'Not found' });

  // Status transitions: a cancelled or completed shift stays that way.
  if (b.status && b.status !== current.status) {
    if (current.status === 'cancelled') return res.status(409).json({ error: 'This shift was cancelled' });
    if (current.status === 'completed') return res.status(409).json({ error: 'This shift has already ended' });
  }

  // Times: validate the resulting pair, and only require the future when the
  // poster is actually moving the shift.
  if (b.start_time || b.end_time) {
    const newStart = (b.start_time ?? current.start_time) as string;
    const newEnd = (b.end_time ?? current.end_time) as string;
    const problem = timeProblems(newStart, newEnd, true);
    if (problem) return res.status(400).json({ error: problem });

    // Moving the shift must not double-book anyone already confirmed on it.
    const movedStart = Date.parse(newStart) !== Date.parse(current.start_time as string);
    const movedEnd = Date.parse(newEnd) !== Date.parse(current.end_time as string);
    if (movedStart || movedEnd) {
      const booked = await liveWorkers(id, ['accepted']);
      const clashing: string[] = [];
      for (const workerId of booked.keys()) {
        if (await findTimeConflictInWindow(workerId, id, newStart, newEnd)) clashing.push(workerId);
      }
      if (clashing.length) {
        const { data: names } = await adminDb.from('users').select('id, username').in('id', clashing);
        const handles = (names ?? []).map((u) => (u.username ? `@${u.username}` : 'a worker'));
        return res.status(409).json({
          error: `That time overlaps another shift for ${handles.join(', ')}. Remove them from this shift first or pick another time.`,
        });
      }
    }
  }

  // Headcount can't drop below the workers already booked.
  if (b.spots_available !== undefined) {
    const { count } = await adminDb
      .from('applications')
      .select('id', { count: 'exact', head: true })
      .eq('shift_id', id)
      .eq('status', 'accepted');
    const booked = count ?? 0;
    if (b.spots_available < booked) {
      return res.status(409).json({ error: `${booked} worker${booked === 1 ? ' is' : 's are'} already booked — remove them first to lower the headcount` });
    }
    if (!b.status && current.status === 'filled' && b.spots_available > booked) updates.status = 'open';
    if (!b.status && current.status === 'open' && b.spots_available === booked && booked > 0) updates.status = 'filled';
  }
  if (b.job_type && !b.job_types) updates.job_types = [b.job_type];

  const { data, error } = await adminDb
    .from('shifts')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Not found' });

  // Tell the people on the shift what changed. Best-effort: a notification
  // failure must never turn a saved edit into an error for the poster.
  try {
    if (updates.status === 'cancelled' && current.status !== 'cancelled') {
      await announceCancellation(current, req.userId!);
    } else if (current.status !== 'cancelled') {
      await announceChanges(current, data, req.userId!);
    }
  } catch (e) {
    console.error('[shifts] post-update notifications failed:', e);
  }
  return res.json(data);
});

type NotifyShift = {
  id: string; client_id: string | null; title: string | null; timezone: string | null;
  start_time: string | null; end_time: string | null; spots_available: number | null;
  pay_rate: number | null; pay_period: string | null; location: string | null;
};

/** Worker ids with a live (accepted / pending / standby) application on a shift. */
async function liveWorkers(shiftId: string, statuses: string[]): Promise<Map<string, string>> {
  const { data } = await adminDb
    .from('applications').select('worker_id, status').eq('shift_id', shiftId).in('status', statuses);
  const out = new Map<string, string>();
  for (const a of data ?? []) if (a.worker_id) out.set(a.worker_id, a.status);
  return out;
}

/** Post a system line in the shift's group chat (no-op when there is no chat). */
async function postSystemLine(shiftId: string, text: string, actorId: string): Promise<void> {
  const conv = await ensureShiftGroupChat(shiftId);
  if (conv) await insertSystemMessage(conv, text, actorId);
}

/**
 * The shift was cancelled: every worker still in play (booked, applied or on
 * the waitlist) is told, and the shift chat gets a system line so the record
 * is visible there too.
 */
async function announceCancellation(shift: NotifyShift, actorId: string): Promise<void> {
  // Offers still waiting on an answer die with the shift, so they leave the
  // workers' Requests tab and can no longer be accepted.
  await adminDb.from('shift_requests').update({ status: 'cancelled' })
    .eq('shift_id', shift.id).eq('status', 'pending');
  const workers = await liveWorkers(shift.id, ['accepted', 'pending', 'standby']);
  const when = formatShiftInstant(shift.start_time, shift.timezone);
  const label = shift.title ? `"${shift.title}"` : 'a shift';
  await Promise.all([...workers.entries()].map(([workerId, status]) =>
    createNotification({
      userId: workerId,
      fromUserId: actorId,
      type: 'shift_cancelled',
      title: 'Shift cancelled',
      body: status === 'accepted'
        ? `${label}${when ? ` on ${when}` : ''} was cancelled by the organizer. You are no longer booked for it.`
        : status === 'standby'
        ? `${label}${when ? ` on ${when}` : ''} was cancelled, so the waitlist is closed.`
        : `${label}${when ? ` on ${when}` : ''} was cancelled before your application was reviewed.`,
      shiftId: shift.id,
      url: `/shift/${shift.id}`,
    }),
  ));
  if (workers.size) await postSystemLine(shift.id, 'This shift was cancelled by the organizer.', actorId);
}

/**
 * Something workers care about changed (time, pay, address or headcount):
 * booked and pending workers get one notification that says exactly what
 * changed, in the shift's own time zone, and the chat gets a system line.
 */
async function announceChanges(before: NotifyShift, after: NotifyShift, actorId: string): Promise<void> {
  const tz = after.timezone || before.timezone;
  const changes: string[] = [];
  const sameInstant = (a: string | null, b: string | null) =>
    (a ? Date.parse(a) : NaN) === (b ? Date.parse(b) : NaN);
  if (!sameInstant(before.start_time, after.start_time) || !sameInstant(before.end_time, after.end_time)) {
    changes.push(`Time changed to ${formatShiftWindow(after.start_time, after.end_time, tz)}`);
  }
  if (Number(before.pay_rate) !== Number(after.pay_rate)) {
    const per = (after.pay_period ?? before.pay_period ?? 'hr') === 'hr' ? '/hr' : ` per ${after.pay_period ?? before.pay_period}`;
    changes.push(`Pay changed to ${formatUsd(Number(after.pay_rate))}${per}`);
  }
  if ((before.location ?? '').trim() !== (after.location ?? '').trim() && after.location) {
    changes.push(`Location changed to ${after.location}`);
  }
  if (Number(before.spots_available) !== Number(after.spots_available)) {
    const n = Number(after.spots_available);
    changes.push(`Headcount changed to ${n} spot${n === 1 ? '' : 's'}`);
  }
  if (!changes.length) return;

  const workers = await liveWorkers(after.id, ['accepted', 'pending']);
  if (!workers.size) return;
  const label = after.title ? `"${after.title}"` : 'A shift you are on';
  const body = `${label}: ${changes.join('. ')}.`;
  await Promise.all([...workers.keys()].map((workerId) =>
    createNotification({
      userId: workerId,
      fromUserId: actorId,
      type: 'shift_update',
      title: 'Shift details changed',
      body,
      shiftId: after.id,
      url: `/shift/${after.id}`,
    }),
  ));
  if ([...workers.values()].includes('accepted')) {
    await postSystemLine(after.id, `Shift details updated: ${changes.join('. ')}.`, actorId);
  }
}

export default router;
