/**
 * Capacity-safe booking.
 *
 * The live database has no capacity trigger, so every path that confirms a
 * worker onto a shift (owner accepts an application, direct assign, instant
 * claim, worker accepts an invite) goes through `bookWorker`, which:
 *
 *   1. rejects when the shift is not open/filled or has already ended
 *      (409 'This shift is no longer accepting workers');
 *   2. counts accepted applications and rejects when the shift is full
 *      (409 'Shift is fully booked');
 *   3. upserts the worker's application to 'accepted' (a prior pending /
 *      standby / withdrawn / declined row for the same worker becomes accepted);
 *   4. derives shifts.spots_filled from the accepted count and flips the shift
 *      status to 'filled' when full / back to 'open' when not.
 *
 * Preferred path: the `book_worker(p_shift, p_worker)` Postgres function from
 * migration 0022, which does the count + insert atomically under a row lock.
 * Until that migration is applied the TS fallback does the same work with a
 * re-check after the insert and a rollback on overflow.
 */
import { adminDb } from './supabaseAdmin.js';
import { HttpError } from './httpError.js';
import { loadShift, type ShiftRow } from './shiftAccess.js';

export type BookingSource = 'accept' | 'assign' | 'claim' | 'offer';

export type ApplicationRow = {
  id: string;
  shift_id: string;
  worker_id: string;
  status: string;
  message: string | null;
  match_score: number | null;
  created_at: string;
};

export type BookingResult = {
  application: ApplicationRow;
  shift: ShiftRow;
  spots_filled: number;
  spots_available: number;
};

export const MSG_CLOSED = 'This shift is no longer accepting workers';
export const MSG_FULL = 'Shift is fully booked';

const ACCEPTING_STATUSES = new Set(['open', 'filled']);

/** True when the shift can still take bookings (status + not ended). */
export function isAcceptingWorkers(shift: Pick<ShiftRow, 'status' | 'end_time'>): boolean {
  if (!ACCEPTING_STATUSES.has(shift.status ?? '')) return false;
  const endMs = shift.end_time ? Date.parse(shift.end_time) : NaN;
  if (Number.isFinite(endMs) && endMs < Date.now()) return false;
  return true;
}

async function countAccepted(shiftId: string, excludeWorkerId?: string): Promise<number> {
  let q = adminDb
    .from('applications')
    .select('*', { count: 'exact', head: true })
    .eq('shift_id', shiftId)
    .eq('status', 'accepted');
  if (excludeWorkerId) q = q.neq('worker_id', excludeWorkerId);
  const { count, error } = await q;
  if (error) throw new HttpError(500, error.message);
  return count ?? 0;
}

/**
 * Recompute shifts.spots_filled from the accepted-application count and keep
 * status consistent: 'filled' when at capacity, 'open' when below it. Never
 * touches a cancelled/completed shift's status. Returns the new counts.
 */
export async function syncShiftCapacity(shiftId: string): Promise<{ spots_filled: number; spots_available: number; status: string | null } | null> {
  const shift = await loadShift(shiftId);
  if (!shift) return null;
  const accepted = await countAccepted(shiftId);
  const capacity = Math.max(1, shift.spots_available ?? 1);
  let status = shift.status;
  if (status === 'open' || status === 'filled') status = accepted >= capacity ? 'filled' : 'open';
  const { error } = await adminDb
    .from('shifts')
    .update({ spots_filled: accepted, status })
    .eq('id', shiftId);
  if (error) throw new HttpError(500, error.message);
  return { spots_filled: accepted, spots_available: capacity, status };
}

/** Is this PostgREST/Postgres error "the RPC function does not exist"? */
function isMissingFunction(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const code = err.code ?? '';
  const msg = err.message ?? '';
  return code === 'PGRST202' || code === '42883' || /could not find the function|does not exist/i.test(msg);
}

/** Atomic path: the book_worker() SQL function (migration 0022). */
async function bookViaRpc(shiftId: string, workerId: string): Promise<BookingResult | 'unavailable'> {
  const { data, error } = await adminDb.rpc('book_worker', { p_shift: shiftId, p_worker: workerId });
  if (error) {
    if (isMissingFunction(error)) return 'unavailable';
    throw new HttpError(500, error.message);
  }
  const r = (data ?? {}) as {
    ok?: boolean; code?: string; application?: ApplicationRow;
    spots_filled?: number; spots_available?: number;
  };
  if (r.ok !== true) {
    if (r.code === 'not_found') throw new HttpError(404, 'Shift not found');
    if (r.code === 'full') throw new HttpError(409, MSG_FULL);
    throw new HttpError(409, MSG_CLOSED);
  }
  if (!r.application) throw new HttpError(500, 'Booking returned no application');
  const shift = await loadShift(shiftId);
  if (!shift) throw new HttpError(404, 'Shift not found');
  return {
    application: r.application,
    shift,
    spots_filled: r.spots_filled ?? shift.spots_filled ?? 0,
    spots_available: r.spots_available ?? shift.spots_available ?? 1,
  };
}

/** Fallback path in TS: check, upsert, re-check, roll back on overflow. */
async function bookViaTs(shiftId: string, workerId: string): Promise<BookingResult> {
  const shift = await loadShift(shiftId);
  if (!shift) throw new HttpError(404, 'Shift not found');
  if (!isAcceptingWorkers(shift)) throw new HttpError(409, MSG_CLOSED);
  const capacity = Math.max(1, shift.spots_available ?? 1);

  const others = await countAccepted(shiftId, workerId);
  if (others >= capacity) throw new HttpError(409, MSG_FULL);

  // Remember the worker's prior row so an overflow can be rolled back exactly.
  const { data: prior } = await adminDb
    .from('applications')
    .select('id, status')
    .eq('shift_id', shiftId)
    .eq('worker_id', workerId)
    .maybeSingle();

  const { data: app, error: upErr } = await adminDb
    .from('applications')
    .upsert({ shift_id: shiftId, worker_id: workerId, status: 'accepted' }, { onConflict: 'shift_id,worker_id' })
    .select()
    .single();
  if (upErr) throw new HttpError(500, upErr.message);

  // Re-check: a concurrent booking may have slipped in between count and insert.
  const total = await countAccepted(shiftId);
  if (total > capacity) {
    if (prior) {
      await adminDb.from('applications').update({ status: prior.status }).eq('id', prior.id);
    } else {
      await adminDb.from('applications').delete().eq('id', (app as ApplicationRow).id);
    }
    await syncShiftCapacity(shiftId);
    throw new HttpError(409, MSG_FULL);
  }

  const synced = await syncShiftCapacity(shiftId);
  return {
    application: app as ApplicationRow,
    shift,
    spots_filled: synced?.spots_filled ?? total,
    spots_available: capacity,
  };
}

/**
 * A worker who was booked by any path (assign, approve, claim, call-out
 * auto-fill) may still have a live offer for the same shift. Flip it to
 * accepted so a later decline can never un-book them and the poster's roster
 * does not keep showing "awaiting reply". Best-effort.
 */
export async function markRequestAccepted(shiftId: string, workerId: string): Promise<void> {
  const { error } = await adminDb
    .from('shift_requests')
    .update({ status: 'accepted' })
    .eq('shift_id', shiftId)
    .eq('worker_id', workerId)
    .in('status', ['pending', 'standby']);
  if (error) console.error('[booking] markRequestAccepted failed:', error.message);
}

/**
 * Confirm `workerId` onto `shiftId`. Throws HttpError(404/409) — never a raw
 * 500 for a business-rule failure. `source` is recorded for logging only.
 */
export async function bookWorker(shiftId: string, workerId: string, source: BookingSource): Promise<BookingResult> {
  if (!shiftId || !workerId) throw new HttpError(400, 'shift_id and worker_id are required');
  const viaRpc = await bookViaRpc(shiftId, workerId);
  if (viaRpc !== 'unavailable') return viaRpc;
  if (!warnedNoRpc) {
    warnedNoRpc = true;
    console.warn(`[booking] book_worker() RPC is not installed (source=${source}) — using the TS fallback. Apply migration 0022.`);
  }
  return bookViaTs(shiftId, workerId);
}
let warnedNoRpc = false;
