/**
 * Shift ownership guard shared by every route that acts on a shift on the
 * owner's behalf (assign / accept / decline / no-show / invite / broadcast /
 * post update / approve timesheet).
 *
 * The caller must be the shift's owning client (shifts.client_id) or an admin
 * (users.role = 'admin' or users.is_admin). There is deliberately NO staffer
 * exemption: a staffer only acts on shifts they own themselves.
 */
import { adminDb } from './supabaseAdmin.js';
import { getRoleInfo } from './roleCache.js';
import { HttpError } from './httpError.js';
import { isBlockedEitherWay } from './chat.js';

export type ShiftRow = {
  id: string;
  client_id: string | null;
  title: string | null;
  status: string | null;
  start_time: string | null;
  end_time: string | null;
  spots_available: number | null;
  spots_filled: number | null;
  pay_rate: number | null;
  pay_period: string | null;
  job_type: string | null;
  job_types: string[] | null;
  instant_claim: boolean | null;
  visibility?: 'public' | 'roster' | null;
  timezone?: string | null;
};

export const SHIFT_COLUMNS =
  'id, client_id, title, status, start_time, end_time, spots_available, spots_filled, pay_rate, pay_period, job_type, job_types, instant_claim, visibility, timezone';

/** Load a shift by id, or null. */
export async function loadShift(shiftId: string): Promise<ShiftRow | null> {
  const { data, error } = await adminDb
    .from('shifts')
    .select(SHIFT_COLUMNS)
    .eq('id', shiftId)
    .maybeSingle();
  if (error) throw new HttpError(500, error.message);
  return (data as ShiftRow | null) ?? null;
}

/**
 * Returns the shift row when `userId` owns it (or is an admin).
 * Throws HttpError 404 when the shift does not exist, 403 otherwise.
 */
export async function assertShiftOwner(shiftId: string, userId: string): Promise<ShiftRow> {
  if (!shiftId || typeof shiftId !== 'string') throw new HttpError(400, 'shift_id is required');
  const shift = await loadShift(shiftId);
  if (!shift) throw new HttpError(404, 'Shift not found');
  if (shift.client_id === userId) return shift;
  const { isAdmin } = await getRoleInfo(userId);
  if (isAdmin) return shift;
  throw new HttpError(403, 'Forbidden');
}

/**
 * The person a poster is booking, inviting or saving must be a worker who is
 * not the poster themselves, and neither side may have blocked the other.
 * Throws HttpError 404 / 409 / 403 with a message the poster can be shown.
 */
export async function assertWorkerTarget(
  workerId: string,
  actorId: string,
  shift?: { client_id: string | null } | null,
): Promise<void> {
  if (!workerId || typeof workerId !== 'string') throw new HttpError(400, 'worker_id is required');
  if (workerId === actorId || (shift?.client_id && workerId === shift.client_id)) {
    throw new HttpError(409, "You can't book the shift's poster.");
  }
  const { data: target, error } = await adminDb
    .from('users').select('id, role').eq('id', workerId).maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!target) throw new HttpError(404, 'Worker not found');
  if (target.role !== 'worker') throw new HttpError(409, 'Only worker accounts can be booked for shifts.');
  if (await isBlockedEitherWay(actorId, workerId)) {
    throw new HttpError(403, "You can't book this worker.");
  }
}

/**
 * Roster-only shifts: only workers on the poster's roster (the poster follows
 * them) may see, apply to, or claim the shift. Public shifts always pass.
 */
export async function rosterAllows(
  shift: { client_id: string | null; visibility?: string | null },
  workerId: string,
): Promise<boolean> {
  if ((shift.visibility ?? 'public') !== 'roster') return true;
  if (!shift.client_id) return false;
  if (shift.client_id === workerId) return true;
  const { data } = await adminDb
    .from('follows')
    .select('follower_id')
    .eq('follower_id', shift.client_id)
    .eq('following_id', workerId)
    .maybeSingle();
  return !!data;
}
