import { Router } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

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
});

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

/** GET /api/shifts — open shifts, optional filters (past shifts are never returned) */
router.get('/', async (req, res) => {
  const { job_type, status = 'open', limit = '50', offset = '0', event_id } = req.query as Record<string, string>;
  const lim = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
  const off = Math.max(parseInt(offset) || 0, 0);
  // event_id lists all positions of one event, regardless of status.
  let q = event_id
    ? adminDb.from('shifts').select('*').eq('event_id', event_id)
    : adminDb.from('shifts').select('*').eq('status', status);
  if (!event_id && status === 'open') {
    // The feed shows what a worker can still take: not ended, soonest first.
    q = q.gt('end_time', new Date().toISOString()).order('start_time', { ascending: true });
  } else {
    q = q.order('created_at', { ascending: false });
  }
  if (job_type) {
    q = q.or(`job_type.eq.${job_type},job_types.cs.{${job_type}}`);
  }
  const { data: shifts, error } = await q.range(off, off + lim - 1);
  if (error) return res.status(500).json({ error: error.message });

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
  return res.json((data ?? []).map((s) => ({ ...s, pending_count: pending.get(s.id) ?? 0 })));
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/shifts/:id — single shift */
router.get('/:id', async (req, res) => {
  const id = String(req.params.id);
  if (!UUID_RE.test(id)) {
    return res.status(404).json({ error: 'Not found' });
  }
  const { data: shift, error } = await adminDb
    .from('shifts')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!shift) return res.status(404).json({ error: 'Not found' });

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

  return res.json({
    ...shift,
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

/** POST /api/shifts — create shift */
router.post('/', requireAuth, requireRole('client', 'staffer'), async (req, res) => {
  const parsed = shiftFields.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed.error) });
  const b = parsed.data;
  const problem = timeProblems(b.start_time, b.end_time, true);
  if (problem) return res.status(400).json({ error: problem });

  const jobTypes = b.job_types?.length ? b.job_types : [b.job_type];
  const payload = {
    client_id: req.userId,
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
    company_name: b.company_name || await posterCompanyName(req.userId!),
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
  };
  const { data, error } = await adminDb
    .from('shifts')
    .insert(payload)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json(data);
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

/** PATCH /api/shifts/:id — update shift (owner only) */
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

  const { data: current, error: curErr } = await adminDb
    .from('shifts')
    .select('id, client_id, status, start_time, end_time, spots_available')
    .eq('id', id)
    .maybeSingle();
  if (curErr) return res.status(500).json({ error: curErr.message });
  if (!current || current.client_id !== req.userId) {
    return res.status(404).json({ error: 'Not found or not authorized' });
  }

  // Status transitions: a cancelled or completed shift stays that way.
  if (b.status && b.status !== current.status) {
    if (current.status === 'cancelled') return res.status(409).json({ error: 'This shift was cancelled' });
    if (current.status === 'completed') return res.status(409).json({ error: 'This shift has already ended' });
  }

  // Times: validate the resulting pair, and only require the future when the
  // poster is actually moving the shift.
  if (b.start_time || b.end_time) {
    const problem = timeProblems(
      (b.start_time ?? current.start_time) as string,
      (b.end_time ?? current.end_time) as string,
      true,
    );
    if (problem) return res.status(400).json({ error: problem });
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
    .eq('client_id', req.userId)
    .select()
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Not found or not authorized' });
  return res.json(data);
});

export default router;
