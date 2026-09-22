/**
 * Background clock — POST/GET /api/cron/tick
 *
 * Called on a schedule (Vercel cron daily, plus a Supabase pg_cron job every
 * 15 minutes via pg_net). Every task is idempotent: reminders dedupe against
 * the notifications table, and sweeps are conditional updates. So it is safe
 * to call as often as you like.
 *
 * Auth: when CRON_SECRET is set, callers must send `Authorization: Bearer
 * <secret>` (Vercel cron does this automatically). Without it the route is
 * open — the work is harmless and would happen anyway on the next tick.
 */
import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { createNotification } from './notifications.js';
import { logger } from '../lib/logger.js';

const router = Router();

function authorized(authHeader: unknown): boolean {
  const secret = process.env['CRON_SECRET'];
  if (!secret) return true;
  return typeof authHeader === 'string' && authHeader === `Bearer ${secret}`;
}

function whenLabel(iso: string, tz: string | null | undefined): string {
  try {
    const zone = tz || 'America/New_York';
    const d = new Date(iso);
    const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: zone });
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: zone });
    return `${day} at ${time}`;
  } catch {
    return '';
  }
}

type ShiftLite = {
  id: string; title: string | null; client_id: string; start_time: string; end_time: string;
  timezone: string | null; spots_available: number; status: string;
};

/** Which (user, shift) pairs already got a notification of this type. */
async function alreadyNotified(type: string, shiftIds: string[]): Promise<Set<string>> {
  if (!shiftIds.length) return new Set();
  const { data } = await adminDb
    .from('notifications')
    .select('user_id, shift_id')
    .eq('type', type)
    .in('shift_id', shiftIds);
  return new Set((data ?? []).map((n) => `${n.user_id}:${n.shift_id}`));
}

/** Accepted workers per shift. */
async function acceptedByShift(shiftIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!shiftIds.length) return map;
  const { data } = await adminDb
    .from('applications')
    .select('shift_id, worker_id')
    .in('shift_id', shiftIds)
    .eq('status', 'accepted');
  for (const a of data ?? []) map.set(a.shift_id, [...(map.get(a.shift_id) ?? []), a.worker_id]);
  return map;
}

async function remindWorkers(windowStartMs: number, windowEndMs: number, type: string, body: (s: ShiftLite) => string) {
  const { data: shifts } = await adminDb
    .from('shifts')
    .select('id, title, client_id, start_time, end_time, timezone, spots_available, status')
    .in('status', ['open', 'filled'])
    .gte('start_time', new Date(windowStartMs).toISOString())
    .lte('start_time', new Date(windowEndMs).toISOString());
  const list = (shifts ?? []) as ShiftLite[];
  const ids = list.map((s) => s.id);
  const [done, accepted] = await Promise.all([alreadyNotified(type, ids), acceptedByShift(ids)]);

  let sent = 0;
  for (const s of list) {
    for (const workerId of accepted.get(s.id) ?? []) {
      if (done.has(`${workerId}:${s.id}`)) continue;
      await createNotification({
        userId: workerId, type,
        title: type === 'shift_starting_soon' ? 'Shift starting soon' : 'Shift tomorrow',
        body: body(s), shiftId: s.id,
      });
      sent++;
    }
  }
  return sent;
}

/** Posters whose shift starts within 48h and still has open spots. */
async function nudgeUnfilled() {
  const now = Date.now();
  const { data: shifts } = await adminDb
    .from('shifts')
    .select('id, title, client_id, start_time, end_time, timezone, spots_available, status')
    .eq('status', 'open')
    .gte('start_time', new Date(now).toISOString())
    .lte('start_time', new Date(now + 48 * 3600_000).toISOString());
  const list = (shifts ?? []) as ShiftLite[];
  const ids = list.map((s) => s.id);
  const [done, accepted] = await Promise.all([alreadyNotified('shift_unfilled', ids), acceptedByShift(ids)]);

  let sent = 0;
  for (const s of list) {
    const filled = (accepted.get(s.id) ?? []).length;
    if (filled >= s.spots_available) continue;
    if (done.has(`${s.client_id}:${s.id}`)) continue;
    await createNotification({
      userId: s.client_id, type: 'shift_unfilled',
      title: 'Shift still needs workers',
      body: `${s.title ?? 'Your shift'} starts ${whenLabel(s.start_time, s.timezone)} with ${filled} of ${s.spots_available} spots filled.`,
      shiftId: s.id,
    });
    sent++;
  }
  return sent;
}

async function sweepEnded(): Promise<number> {
  const { data } = await adminDb
    .from('shifts')
    .update({ status: 'completed' })
    .in('status', ['open', 'filled'])
    .lt('end_time', new Date().toISOString())
    .select('id');
  return data?.length ?? 0;
}

async function tick() {
  const now = Date.now();
  const H = 3600_000;
  const [startingSoon, tomorrow, unfilled, completed] = await Promise.all([
    // "Starts in about 2 hours" — 15-minute pg_cron cadence keeps this tight.
    remindWorkers(now + 1.75 * H, now + 2.25 * H, 'shift_starting_soon',
      (s) => `${s.title ?? 'Your shift'} starts at ${whenLabel(s.start_time, s.timezone).split(' at ')[1] ?? ''}. Clock in from the app when you arrive.`),
    // Day-before reminder — anything starting in the next 20–28 hours.
    remindWorkers(now + 20 * H, now + 28 * H, 'shift_reminder_day',
      (s) => `Reminder: ${s.title ?? 'your shift'} is ${whenLabel(s.start_time, s.timezone)}.`),
    nudgeUnfilled(),
    sweepEnded(),
  ]);
  return { startingSoon, tomorrow, unfilled, completed };
}

async function handle(req: import('express').Request, res: import('express').Response) {
  if (!authorized(req.headers['authorization'])) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = await tick();
    logger.info(result, 'cron tick');
    return res.json({ ok: true, ...result, at: new Date().toISOString() });
  } catch (err) {
    logger.error({ err }, 'cron tick failed');
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

router.get('/tick', handle);
router.post('/tick', handle);

export default router;
