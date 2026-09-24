/**
 * Shift-swap helpers shared by the swaps routes, the applications routes
 * (a worker who calls out or is removed loses their in-flight swap) and the
 * cron sweep (a swap dies when its shift starts).
 */
import { adminDb } from './supabaseAdmin.js';
import { createNotification } from '../routes/notifications.js';
import { shiftDayLabel } from './shiftLabel.js';

export const ACTIVE_SWAP_STATUSES = ['offered', 'accepted'] as const;

export type SwapStatus =
  | 'offered' | 'accepted' | 'approved'
  | 'declined_by_worker' | 'declined_by_poster' | 'cancelled' | 'expired';

export type SwapRow = {
  id: string;
  shift_id: string;
  application_id: string;
  from_worker_id: string;
  to_worker_id: string;
  status: SwapStatus;
  note: string | null;
  created_at: string;
  responded_at: string | null;
  decided_at: string | null;
  decided_by: string | null;
};

/** A worker's @handle for copy, or a neutral fallback. */
async function handle(id: string): Promise<string> {
  const { data } = await adminDb.from('users').select('username').eq('id', id).maybeSingle();
  return data?.username ? `@${data.username}` : 'the worker';
}

/**
 * The offering worker left the shift (called out, dropped, or was removed):
 * their in-flight swap is void. The other worker is told only if they had
 * already accepted — an untouched offer just disappears. Best-effort.
 */
export async function cancelActiveSwapsFor(shiftId: string, workerId: string): Promise<void> {
  try {
    const { data: active } = await adminDb
      .from('shift_swaps')
      .select('id, to_worker_id, status')
      .eq('shift_id', shiftId)
      .eq('from_worker_id', workerId)
      .in('status', [...ACTIVE_SWAP_STATUSES]);
    if (!active?.length) return;
    const now = new Date().toISOString();
    await adminDb
      .from('shift_swaps')
      .update({ status: 'cancelled', decided_at: now })
      .in('id', active.map((s) => s.id));

    const accepted = active.filter((s) => s.status === 'accepted');
    if (!accepted.length) return;
    const { data: shift } = await adminDb
      .from('shifts').select('title, start_time, timezone').eq('id', shiftId).maybeSingle();
    const from = await handle(workerId);
    for (const s of accepted) {
      await createNotification({
        userId: s.to_worker_id,
        fromUserId: workerId,
        type: 'swap_declined',
        title: 'Swap cancelled',
        body: `${from} is no longer on ${shiftDayLabel(shift ?? {})}, so the swap they offered you was cancelled.`,
        shiftId,
        url: `/shift/${shiftId}`,
      });
    }
  } catch (e) {
    console.error('[swaps] cancelActiveSwapsFor failed:', e);
  }
}

/**
 * Cron: any swap still in flight once its shift has started (or was
 * cancelled) becomes 'expired'. No notification — the shift page already
 * shows the shift as started. Returns how many were expired.
 */
export async function expireSwaps(): Promise<number> {
  const { data: active } = await adminDb
    .from('shift_swaps')
    .select('id, shift_id')
    .in('status', [...ACTIVE_SWAP_STATUSES]);
  if (!active?.length) return 0;
  const shiftIds = [...new Set(active.map((s) => s.shift_id))];
  const { data: shifts } = await adminDb
    .from('shifts').select('id, start_time, status').in('id', shiftIds);
  const now = Date.now();
  const dead = new Set(
    (shifts ?? [])
      .filter((s) => s.status === 'cancelled' || (Number.isFinite(Date.parse(s.start_time)) && Date.parse(s.start_time) <= now))
      .map((s) => s.id),
  );
  const ids = active.filter((s) => dead.has(s.shift_id)).map((s) => s.id);
  if (!ids.length) return 0;
  const { error } = await adminDb
    .from('shift_swaps')
    .update({ status: 'expired', decided_at: new Date().toISOString() })
    .in('id', ids);
  if (error) throw new Error(error.message);
  return ids.length;
}
