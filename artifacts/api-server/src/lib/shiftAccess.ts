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
};

export const SHIFT_COLUMNS =
  'id, client_id, title, status, start_time, end_time, spots_available, spots_filled, pay_rate, pay_period, job_type, job_types, instant_claim';

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
