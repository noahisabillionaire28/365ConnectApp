/**
 * Shift ↔ worker matching.
 *
 * Two layers:
 *  1. Rules. Hard facts pulled from the database — role fit, availability that
 *     day, rating, distance from the venue, history with this poster, no-shows,
 *     on-time rate. These produce a 0–100 score and a plain-English reason on
 *     their own, so the app works with no AI key at all.
 *  2. Claude. When ANTHROPIC_API_KEY is set, the same facts for a shift's
 *     candidates go to Claude in one request; it returns a ranked score and a
 *     one-sentence reason per candidate that reads like a good manager wrote
 *     it. Results are cached per (shift, worker) keyed on a hash of the facts,
 *     so a shift page never triggers a second call until something changes.
 */
import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { adminDb } from './supabaseAdmin.js';
import { logger } from './logger.js';

export type Shift = {
  id: string; client_id: string; title: string | null; description: string | null;
  job_type: string | null; job_types: string[] | null; event_type: string | null;
  start_time: string; end_time: string; timezone: string | null;
  lat: number | null; lng: number | null; pay_rate: number | null; requirements: string[] | null;
};

export type Signals = {
  worker_id: string;
  username: string | null;
  roles: string[];
  roleMatch: boolean;
  /** null when the worker never set a weekly availability */
  availableThatDay: boolean | null;
  rating: number;
  reviewCount: number;
  distanceMiles: number | null;
  shiftsWorked: number;
  shiftsWithThisPoster: number;
  posterRating: number | null;
  noShows: number;
  onTimeRate: number | null;
  certifications: string[];
  bio: string | null;
};

export type Insight = { worker_id: string; score: number; reason: string; source: 'rules' | 'claude'; signals: Signals };

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const CACHE_TTL_MS = 24 * 3600_000;

function miles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function weekdayIn(iso: string, tz: string | null): string {
  try {
    const short = new Date(iso).toLocaleDateString('en-US', { weekday: 'short', timeZone: tz || 'America/New_York' }).toLowerCase();
    return DAY_KEYS.find((k) => short.startsWith(k)) ?? DAY_KEYS[new Date(iso).getDay()];
  } catch { return DAY_KEYS[new Date(iso).getDay()]; }
}

// ─── Signals ──────────────────────────────────────────────────────────────────

export async function gatherSignals(shift: Shift, workerIds: string[]): Promise<Signals[]> {
  if (!workerIds.length) return [];
  const [{ data: users }, { data: apps }, { data: reviews }, { data: entries }] = await Promise.all([
    adminDb.from('users')
      .select('id, username, rating, primary_job_type, job_types, secondary_job_types, availability, lat, lng, certifications, bio')
      .in('id', workerIds),
    // Every past booking for these workers, with the shift it was on.
    adminDb.from('applications')
      .select('worker_id, status, shifts!inner(id, client_id, start_time, end_time, status)')
      .in('worker_id', workerIds)
      .in('status', ['accepted', 'no_show']),
    adminDb.from('reviews').select('reviewee_id, reviewer_id, rating').in('reviewee_id', workerIds),
    adminDb.from('time_entries').select('worker_id, shift_id, clock_in').in('worker_id', workerIds).not('clock_in', 'is', null),
  ]);

  const wanted = new Set((shift.job_types?.length ? shift.job_types : [shift.job_type]).filter(Boolean).map((t) => (t as string).toLowerCase()));
  const day = weekdayIn(shift.start_time, shift.timezone);
  const now = Date.now();

  // Shift start times, for the on-time check.
  const startById = new Map<string, number>();
  for (const a of apps ?? []) {
    const s = (a as unknown as { shifts: { id: string; start_time: string } }).shifts;
    if (s) startById.set(s.id, Date.parse(s.start_time));
  }

  return workerIds.map((id) => {
    const u = (users ?? []).find((x) => x.id === id);
    const roles = [u?.primary_job_type, ...(u?.job_types ?? []), ...(u?.secondary_job_types ?? [])]
      .filter((r): r is string => typeof r === 'string' && !!r.trim());
    const roleMatch = wanted.size === 0 || roles.some((r) => wanted.has(r.toLowerCase()));
    const avail = (u?.availability ?? null) as Record<string, boolean> | null;
    const availableThatDay = avail && Object.keys(avail).length ? !!avail[day] : null;

    const mine = (apps ?? []).filter((a) => a.worker_id === id) as unknown as Array<{ status: string; shifts: { id: string; client_id: string; end_time: string } }>;
    const finished = mine.filter((a) => a.status === 'accepted' && Date.parse(a.shifts.end_time) < now);
    const withPoster = finished.filter((a) => a.shifts.client_id === shift.client_id).length;
    const noShows = mine.filter((a) => a.status === 'no_show').length;

    const clockIns = (entries ?? []).filter((e) => e.worker_id === id);
    let onTime = 0, judged = 0;
    for (const e of clockIns) {
      const start = startById.get(e.shift_id);
      if (!start || !e.clock_in) continue;
      judged++;
      if (Date.parse(e.clock_in) <= start + 10 * 60_000) onTime++;
    }

    const myReviews = (reviews ?? []).filter((r) => r.reviewee_id === id);
    const fromPoster = myReviews.filter((r) => r.reviewer_id === shift.client_id);
    const avg = (rs: { rating: number }[]) => rs.length ? rs.reduce((s, r) => s + Number(r.rating), 0) / rs.length : null;

    const distanceMiles = u?.lat != null && u?.lng != null && shift.lat != null && shift.lng != null
      ? Math.round(miles(Number(u.lat), Number(u.lng), Number(shift.lat), Number(shift.lng)) * 10) / 10
      : null;

    return {
      worker_id: id,
      username: u?.username ?? null,
      roles,
      roleMatch,
      availableThatDay,
      rating: Number(u?.rating ?? 0) || 0,
      reviewCount: myReviews.length,
      distanceMiles,
      shiftsWorked: finished.length,
      shiftsWithThisPoster: withPoster,
      posterRating: avg(fromPoster),
      noShows,
      onTimeRate: judged ? Math.round((onTime / judged) * 100) : null,
      certifications: (u?.certifications ?? []) as string[],
      bio: u?.bio ?? null,
    };
  });
}

// ─── Rules layer ──────────────────────────────────────────────────────────────

export function ruleScore(s: Signals): number {
  let pts = 0;
  pts += s.roleMatch ? 35 : 0;
  pts += s.availableThatDay === true ? 15 : s.availableThatDay === null ? 8 : 0;
  pts += Math.round((Math.min(5, s.rating) / 5) * 15);
  if (s.distanceMiles == null) pts += 5;
  else pts += Math.max(0, Math.min(10, Math.round(10 * (1 - Math.max(0, s.distanceMiles - 5) / 20))));
  pts += Math.min(10, s.shiftsWithThisPoster * 5);
  pts += Math.min(5, s.shiftsWorked);
  pts += s.onTimeRate == null ? 3 : Math.round((s.onTimeRate / 100) * 5);
  pts -= Math.min(30, s.noShows * 15);
  return Math.max(0, Math.min(100, pts));
}

export function ruleReason(s: Signals): string {
  const bits: string[] = [];
  if (s.shiftsWithThisPoster > 0) bits.push(`worked ${s.shiftsWithThisPoster} shift${s.shiftsWithThisPoster === 1 ? '' : 's'} for you before`);
  else if (s.shiftsWorked > 0) bits.push(`${s.shiftsWorked} shift${s.shiftsWorked === 1 ? '' : 's'} completed`);
  if (s.roleMatch && s.roles.length) bits.push('right role');
  else if (!s.roleMatch) bits.push('different role');
  if (s.posterRating != null) bits.push(`you rated them ${s.posterRating.toFixed(1)}`);
  else if (s.rating >= 4.5 && s.reviewCount) bits.push(`${s.rating.toFixed(1)} stars`);
  if (s.noShows > 0) bits.push(`${s.noShows} no-show${s.noShows === 1 ? '' : 's'}`);
  else if (s.onTimeRate != null && s.onTimeRate >= 90) bits.push('always on time');
  if (s.distanceMiles != null) bits.push(s.distanceMiles <= 5 ? 'nearby' : `${s.distanceMiles} mi away`);
  if (s.availableThatDay === false) bits.push('marked unavailable that day');
  if (!bits.length) return 'New to the platform — no history yet.';
  const text = bits.join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1) + '.';
}

// ─── Claude layer ─────────────────────────────────────────────────────────────

const apiKey = process.env['ANTHROPIC_API_KEY'] ?? '';
export function aiConfigured(): boolean { return !!apiKey; }
const client = apiKey ? new Anthropic({ apiKey }) : null;

const SYSTEM = `You rank candidate workers for an event-staffing shift. You are given the shift and, for each candidate, verified facts from the platform's records. Score each candidate 0-100 for how well they fit THIS shift, and write ONE short sentence (max 18 words) a busy event manager would find useful — lead with the strongest fact, mention a concern if there is one, never invent facts.

Weigh, in order: reliability (no-shows, on-time rate), history with this poster (past shifts, the poster's own rating), role fit, overall rating, availability that day, distance. A no-show is serious. New workers with no history are fine but should sit below proven ones.

Respond with JSON only, no prose: {"candidates":[{"worker_id":"...","score":0-100,"reason":"..."}]}`;

async function askClaude(shift: Shift, signals: Signals[]): Promise<Map<string, { score: number; reason: string }> | null> {
  if (!client) return null;
  const payload = {
    shift: {
      title: shift.title, event_type: shift.event_type, roles: shift.job_types?.length ? shift.job_types : [shift.job_type],
      start: shift.start_time, end: shift.end_time, requirements: shift.requirements ?? [],
      description: (shift.description ?? '').slice(0, 600),
    },
    candidates: signals.map((s) => ({
      worker_id: s.worker_id, roles: s.roles, role_match: s.roleMatch, available_that_day: s.availableThatDay,
      rating: s.rating, review_count: s.reviewCount, distance_miles: s.distanceMiles,
      shifts_worked: s.shiftsWorked, shifts_with_this_poster: s.shiftsWithThisPoster, poster_rating: s.posterRating,
      no_shows: s.noShows, on_time_rate: s.onTimeRate, certifications: s.certifications.slice(0, 8),
      bio: (s.bio ?? '').slice(0, 200),
    })),
  };
  try {
    const res = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 4000,
      output_config: { effort: 'low' },
      system: SYSTEM,
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
    });
    if (res.stop_reason === 'refusal') return null;
    const text = res.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('');
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const parsed = JSON.parse(json) as { candidates?: Array<{ worker_id: string; score: number; reason: string }> };
    const out = new Map<string, { score: number; reason: string }>();
    for (const c of parsed.candidates ?? []) {
      if (typeof c.worker_id === 'string' && Number.isFinite(c.score) && typeof c.reason === 'string' && c.reason.trim()) {
        out.set(c.worker_id, { score: Math.max(0, Math.min(100, Math.round(c.score))), reason: c.reason.trim().slice(0, 200) });
      }
    }
    return out.size ? out : null;
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'match: Claude ranking failed, using rules');
    return null;
  }
}

// ─── Public entry point ───────────────────────────────────────────────────────

function hashOf(s: Signals): string {
  const { username: _u, bio: _b, ...rest } = s;
  return createHash('sha1').update(JSON.stringify(rest)).digest('hex').slice(0, 20);
}

/**
 * Insights for a set of candidates on one shift. Cached rows whose facts have
 * not changed (and are under a day old) are reused; the rest are recomputed
 * in one Claude call (or by rules when no key is configured).
 */
export async function insightsFor(shift: Shift, workerIds: string[], opts: { force?: boolean } = {}): Promise<Insight[]> {
  const ids = [...new Set(workerIds)];
  if (!ids.length) return [];
  const signals = await gatherSignals(shift, ids);
  const byId = new Map(signals.map((s) => [s.worker_id, s]));

  const { data: cached } = await adminDb
    .from('match_insights').select('worker_id, score, reason, signals_hash, source, created_at')
    .eq('shift_id', shift.id).in('worker_id', ids);
  const fresh = new Map<string, { score: number; reason: string; source: 'rules' | 'claude' }>();
  for (const c of cached ?? []) {
    const s = byId.get(c.worker_id);
    const young = Date.now() - Date.parse(c.created_at) < CACHE_TTL_MS;
    const upgradeWanted = c.source === 'rules' && aiConfigured();
    if (!opts.force && s && young && c.signals_hash === hashOf(s) && !upgradeWanted) {
      fresh.set(c.worker_id, { score: c.score, reason: c.reason, source: c.source as 'rules' | 'claude' });
    }
  }

  const missing = signals.filter((s) => !fresh.has(s.worker_id));
  if (missing.length) {
    const ai = await askClaude(shift, missing);
    const rows = missing.map((s) => {
      const a = ai?.get(s.worker_id);
      const score = a ? Math.round(a.score * 0.7 + ruleScore(s) * 0.3) : ruleScore(s);
      const reason = a?.reason ?? ruleReason(s);
      const source: 'rules' | 'claude' = a ? 'claude' : 'rules';
      fresh.set(s.worker_id, { score, reason, source });
      return { shift_id: shift.id, worker_id: s.worker_id, score, reason, signals_hash: hashOf(s), source, created_at: new Date().toISOString() };
    });
    await adminDb.from('match_insights').upsert(rows, { onConflict: 'shift_id,worker_id' });
  }

  return signals
    .map((s) => ({ worker_id: s.worker_id, ...fresh.get(s.worker_id)!, signals: s }))
    .sort((a, b) => b.score - a.score);
}
