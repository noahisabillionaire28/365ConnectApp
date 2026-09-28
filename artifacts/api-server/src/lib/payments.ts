/**
 * Payment facts shared by the payments and time-entries routes: once a
 * worker has a completed payment for a shift, the timesheet is closed —
 * no second payment, no re-approval, no new dispute.
 */
import { adminDb } from './supabaseAdmin.js';

/** Has this worker already been paid (a completed shift payment) for the shift? */
export async function alreadyPaid(shiftId: string, workerId: string): Promise<boolean> {
  const { count } = await adminDb
    .from('payments')
    .select('*', { count: 'exact', head: true })
    .eq('shift_id', shiftId)
    .eq('worker_id', workerId)
    .eq('status', 'completed');
  return (count ?? 0) > 0;
}

export const MSG_ALREADY_PAID = 'This worker has already been paid for this shift.';
export const MSG_PAID_LOCKED = 'This timesheet has already been paid. Contact support to adjust it.';
