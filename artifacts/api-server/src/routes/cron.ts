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
import { shiftDayLabel } from '../lib/shiftLabel.js';

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

/** Everything a reminder body needs — the shift row plus the poster's company. */
type ShiftDetail = ShiftLite & {
  job_type: string | null; company_name: string | null; location: string | null;
  dress_code: string | null; dress_code_items: string[] | null;
  point_of_contact: string | null; contact_phone: string | null;
};

const PUSH_BODY_MAX = 200;

/** Ellipsise at a word boundary so a push body stays under the cap. */
function clip(text: string, max = PUSH_BODY_MAX): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;·]+$/, '')}…`;
}

/** "5:00 PM" in the shift's own zone. */
function timeIn(iso: string, tz: string | null | undefined): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz || 'America/New_York' });
  } catch { return ''; }
}

/**
 * Reminder copy that carries the details a worker needs on the way in:
 *   "Bartender at Corbin Events starts at 5:00 PM (in 2h). 11200 Corbin Ave,
 *    Porter Ranch. Dress: Black tie. Contact: Dana 555-0100."
 * `when` is "(in 2h)" or "(tomorrow)". The role/company lead never gets cut;
 * the trailing details do, so the whole thing fits a push notification.
 */
function reminderBody(s: ShiftDetail, when: string): string {
  const role = s.job_type || s.title || 'Your shift';
  const company = s.company_name ? ` at ${s.company_name}` : '';
  const time = timeIn(s.start_time, s.timezone);
  const sentence = (t: string) => (t.endsWith('.') ? t : `${t}.`);
  const parts = [`${role}${company} starts${time ? ` at ${time}` : ''} ${when}`];
  if (s.location?.trim()) parts.push(s.location.trim());
  const dress = s.dress_code?.trim() || (s.dress_code_items?.length ? s.dress_code_items.join(', ') : '');
  if (dress) parts.push(`Dress: ${dress}`);
  const contact = [s.point_of_contact?.trim(), s.contact_phone?.trim()].filter(Boolean).join(' ');
  if (contact) parts.push(`Contact: ${contact}`);
  return clip(parts.map(sentence).join(' '));
}

/** "Sat 5 PM" — compact day + time in the shift's zone for alert copy. */
function shortWhen(iso: string, tz: string | null | undefined): string {
  try {
    const zone = tz || 'America/New_York';
    const d = new Date(iso);
    const day = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: zone });
    const mins = Number(d.toLocaleTimeString('en-US', { minute: '2-digit', timeZone: zone }));
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', ...(mins ? { minute: '2-digit' } : {}), timeZone: zone });
    return `${day} ${time}`;
  } catch { return ''; }
}

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

async function remindWorkers(windowStartMs: number, windowEndMs: number, type: string, body: (s: ShiftDetail) => string) {
  const { data: shifts } = await adminDb
    .from('shifts')
    .select('id, title, client_id, start_time, end_time, timezone, spots_available, status, job_type, company_name, location, dress_code, dress_code_items, point_of_contact, contact_phone')
    .in('status', ['open', 'filled'])
    .gte('start_time', new Date(windowStartMs).toISOString())
    .lte('start_time', new Date(windowEndMs).toISOString());
  const list = (shifts ?? []) as ShiftDetail[];
  const ids = list.map((s) => s.id);
  const [done, accepted] = await Promise.all([alreadyNotified(type, ids), acceptedByShift(ids)]);

  let sent = 0;
  for (const s of list) {
    for (const workerId of accepted.get(s.id) ?? []) {
      if (done.has(`${workerId}:${s.id}`)) continue;
      await createNotification({
        userId: workerId, type,
        title: type === 'shift_starting_soon' ? 'Shift starting soon' : 'Shift tomorrow',
        body: body(s), shiftId: s.id, url: `/shift/${s.id}`,
      });
      sent++;
    }
  }
  return sent;
}

// ─── Saved search alerts ──────────────────────────────────────────────────────

type SavedSearch = {
  id: string; user_id: string; job_types: string[] | null;
  max_distance_miles: number | null; min_pay: number | null; event_type: string | null;
};

type NewShift = {
  id: string; client_id: string; title: string | null; job_type: string | null; job_types: string[] | null;
  event_type: string | null; company_name: string | null; pay_rate: number | null; pay_period: string | null;
  start_time: string; timezone: string | null; lat: number | null; lng: number | null;
};

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Does this saved search match the shift? Returns the distance (miles) when
 * both sides have coordinates, null when distance could not be judged, or
 * `false` when the search rules the shift out.
 */
function matchSavedSearch(
  search: SavedSearch, shift: NewShift, user: { lat: number | null; lng: number | null },
): number | null | false {
  const wanted = (search.job_types ?? []).map((t) => t.toLowerCase());
  if (wanted.length) {
    const offered = [shift.job_type, ...(shift.job_types ?? [])].filter((t): t is string => !!t).map((t) => t.toLowerCase());
    if (!offered.some((t) => wanted.includes(t))) return false;
  }
  if (search.min_pay != null && Number(shift.pay_rate ?? 0) < Number(search.min_pay)) return false;
  if (search.event_type && (shift.event_type ?? '').toLowerCase() !== search.event_type.toLowerCase()) return false;
  const canMeasure = user.lat != null && user.lng != null && shift.lat != null && shift.lng != null;
  const distance = canMeasure ? haversineMiles(Number(user.lat), Number(user.lng), Number(shift.lat), Number(shift.lng)) : null;
  if (search.max_distance_miles != null && distance != null && distance > Number(search.max_distance_miles)) return false;
  return distance;
}

/**
 * New open public shifts (posted in the last 20 minutes) matched against every
 * worker's saved searches. One notification per worker per tick, never to the
 * poster or to someone who already applied, deduped per (worker, shift) via
 * the notifications table so overlapping windows never double-send.
 */
async function alertSavedSearches(): Promise<number> {
  const since = new Date(Date.now() - 20 * 60_000).toISOString();
  const { data: shifts } = await adminDb
    .from('shifts')
    .select('id, client_id, title, job_type, job_types, event_type, company_name, pay_rate, pay_period, start_time, timezone, lat, lng')
    .eq('status', 'open').eq('visibility', 'public')
    .gte('created_at', since)
    .gt('start_time', new Date().toISOString());
  const list = (shifts ?? []) as NewShift[];
  if (!list.length) return 0;
  const shiftIds = list.map((s) => s.id);

  const [{ data: searches }, done, { data: apps }] = await Promise.all([
    adminDb.from('saved_searches').select('id, user_id, job_types, max_distance_miles, min_pay, event_type'),
    alreadyNotified('saved_search', shiftIds),
    adminDb.from('applications').select('shift_id, worker_id').in('shift_id', shiftIds),
  ]);
  const searchList = (searches ?? []) as SavedSearch[];
  if (!searchList.length) return 0;
  const applied = new Set((apps ?? []).map((a) => `${a.worker_id}:${a.shift_id}`));

  const userIds = [...new Set(searchList.map((s) => s.user_id))];
  const { data: users } = await adminDb.from('users').select('id, lat, lng, role').in('id', userIds);
  const userById = new Map((users ?? []).map((u) => [u.id, u]));

  // Group searches per worker so each worker gets at most one alert per tick.
  const byUser = new Map<string, SavedSearch[]>();
  for (const s of searchList) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);

  let sent = 0;
  for (const [userId, mySearches] of byUser) {
    const u = userById.get(userId);
    if (!u || (u.role && u.role !== 'worker')) continue;
    let hit: { shift: NewShift; distance: number | null; searchId: string } | null = null;
    for (const shift of list) {
      if (shift.client_id === userId) continue;
      if (applied.has(`${userId}:${shift.id}`) || done.has(`${userId}:${shift.id}`)) continue;
      for (const search of mySearches) {
        const r = matchSavedSearch(search, shift, { lat: u.lat, lng: u.lng });
        if (r === false) continue;
        hit = { shift, distance: r, searchId: search.id };
        break;
      }
      if (hit) break;
    }
    if (!hit) continue;
    const { shift, distance } = hit;
    const role = shift.job_type || shift.job_types?.[0] || shift.title || 'shift';
    const pay = Number(shift.pay_rate ?? 0) > 0 ? ` · $${Number(shift.pay_rate)}/${shift.pay_period || 'hr'}` : '';
    const miles = distance != null ? ` · ${Math.round(distance * 10) / 10} mi` : '';
    const when = shortWhen(shift.start_time, shift.timezone);
    const where = shift.company_name ? ` at ${shift.company_name}` : '';
    await createNotification({
      userId, fromUserId: shift.client_id, type: 'saved_search',
      title: 'New shift matches your search',
      body: clip(`New ${role} shift${pay}${miles} · ${when}${where}`),
      shiftId: shift.id, url: `/shift/${shift.id}`,
    });
    await adminDb.from('saved_searches').update({ last_notified_at: new Date().toISOString() }).eq('id', hit.searchId);
    sent++;
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

/**
 * Post-shift rating prompts. For shifts that ended `fromH`–`toH` hours ago:
 * each booked worker who clocked in is asked to rate the poster, and the
 * poster is asked once to rate the crew — unless that person has already
 * left a review for the shift. Deduped per (user, shift, type) so the
 * 15-minute cadence never double-sends; the 24h reminder uses its own types.
 */
async function promptRatings(fromH: number, toH: number, types: { worker: string; poster: string }): Promise<number> {
  const now = Date.now();
  const H = 3600_000;
  const { data: shifts } = await adminDb
    .from('shifts')
    .select('id, title, client_id, start_time, end_time, timezone, spots_available, status')
    .in('status', ['completed', 'ended'])
    .gte('end_time', new Date(now - toH * H).toISOString())
    .lte('end_time', new Date(now - fromH * H).toISOString());
  const list = (shifts ?? []) as ShiftLite[];
  if (!list.length) return 0;
  const ids = list.map((s) => s.id);

  const [doneWorker, donePoster, accepted, { data: entries }, { data: reviews }, { data: posters }] = await Promise.all([
    alreadyNotified(types.worker, ids),
    alreadyNotified(types.poster, ids),
    acceptedByShift(ids),
    adminDb.from('time_entries').select('shift_id, worker_id').in('shift_id', ids).not('clock_in', 'is', null),
    adminDb.from('reviews').select('shift_id, reviewer_id').in('shift_id', ids),
    adminDb.from('users').select('id, username, company_name').in('id', [...new Set(list.map((s) => s.client_id))]),
  ]);
  const clockedIn = new Set((entries ?? []).map((e) => `${e.worker_id}:${e.shift_id}`));
  const reviewed = new Set((reviews ?? []).map((r) => `${r.reviewer_id}:${r.shift_id}`));
  const posterName = new Map((posters ?? []).map((u) => [u.id, u.company_name || (u.username ? `@${u.username}` : 'the poster')]));

  let sent = 0;
  for (const s of list) {
    const day = shiftDayLabel(s, { withTitle: false });
    const crew = (accepted.get(s.id) ?? []).filter((w) => w !== s.client_id);
    for (const workerId of crew) {
      if (!clockedIn.has(`${workerId}:${s.id}`)) continue;
      if (reviewed.has(`${workerId}:${s.id}`) || doneWorker.has(`${workerId}:${s.id}`)) continue;
      await createNotification({
        userId: workerId, fromUserId: s.client_id, type: types.worker,
        title: 'How did it go?',
        body: `How was ${day} with ${posterName.get(s.client_id) ?? 'the poster'}? Rate them`,
        shiftId: s.id, url: `/review/${s.id}/${s.client_id}`,
      });
      sent++;
    }
    if (crew.length && !reviewed.has(`${s.client_id}:${s.id}`) && !donePoster.has(`${s.client_id}:${s.id}`)) {
      await createNotification({
        userId: s.client_id, type: types.poster,
        title: 'Rate your crew',
        body: `Rate your crew from ${day}${s.title ? ` ("${s.title}")` : ''}.`,
        shiftId: s.id, url: `/shift/${s.id}/applicants`,
      });
      sent++;
    }
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
  const [startingSoon, tomorrow, unfilled, completed, savedSearch] = await Promise.all([
    // "Starts in about 2 hours" — 15-minute pg_cron cadence keeps this tight.
    remindWorkers(now + 1.75 * H, now + 2.25 * H, 'shift_starting_soon', (s) => reminderBody(s, '(in 2h)')),
    // Day-before reminder — anything starting in the next 20–28 hours.
    remindWorkers(now + 20 * H, now + 28 * H, 'shift_reminder_day', (s) => reminderBody(s, '(tomorrow)')),
    nudgeUnfilled(),
    sweepEnded(),
    alertSavedSearches(),
  ]);
  // After the sweep so a just-ended shift is already 'completed'.
  const ratePrompts = await promptRatings(1, 3, { worker: 'rate_client', poster: 'rate_crew' });
  const rateReminders = await promptRatings(25, 27, { worker: 'rate_client_reminder', poster: 'rate_crew_reminder' });
  return { startingSoon, tomorrow, unfilled, completed, savedSearch, ratePrompts, rateReminders };
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
