import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type ShiftRequestCard = {
  id: string;
  shiftId: string;
  clientId: string;
  clientUsername: string | null;
  clientPhotoUrl: string | null;
  shiftTitle: string;
  payRate: number | null;
  payPeriod: string;
  startTime: string;
  message: string | null;
  createdAt: string;
};

/**
 * Direct invites a worker has received from clients/staffers for one of
 * their own posted shifts (Nowsta-style "Request for Shift"). Accepting
 * writes a confirmed `applications` row via a DB trigger — see
 * `handle_shift_request_decision` in supabase/schema.sql — which unlocks
 * Clock In immediately, skipping the normal pending-review flow.
 */
export function useShiftRequests(workerId: string | undefined) {
  const [requests, setRequests] = useState<ShiftRequestCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workerId) { setRequests([]); setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('shift_requests')
      .select(`
        id, shift_id, client_id, message, created_at,
        shift:shifts ( title, pay_rate, pay_period, start_time ),
        client:users!shift_requests_client_id_fkey ( username, photo_url )
      `)
      .eq('worker_id', workerId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('[useShiftRequests] fetch failed:', fetchError.message);
      setError(fetchError.message);
      setRequests([]);
      setIsLoading(false);
      return;
    }

    type Row = {
      id: string; shift_id: string; client_id: string; message: string | null; created_at: string;
      shift: { title: string; pay_rate: number | null; pay_period: string; start_time: string } | null;
      client: { username: string | null; photo_url: string | null } | null;
    };

    setRequests(
      ((data ?? []) as unknown as Row[]).map((r) => ({
        id:             r.id,
        shiftId:        r.shift_id,
        clientId:       r.client_id,
        clientUsername: r.client?.username ?? null,
        clientPhotoUrl: r.client?.photo_url ?? null,
        shiftTitle:     r.shift?.title ?? 'Untitled shift',
        payRate:        r.shift?.pay_rate ?? null,
        payPeriod:      r.shift?.pay_period ?? 'hr',
        startTime:      r.shift?.start_time ?? r.created_at,
        message:        r.message,
        createdAt:      r.created_at,
      })),
    );
    setIsLoading(false);
  }, [workerId]);

  useEffect(() => { void load(); }, [load]);

  async function decide(requestId: string, decision: 'accepted' | 'declined') {
    const snapshot = requests;
    setRequests((prev) => prev.filter((r) => r.id !== requestId));
    setError(null);
    const { error: updateError } = await supabase
      .from('shift_requests')
      .update({ status: decision })
      .eq('id', requestId);
    if (updateError) {
      console.error('[useShiftRequests] decision failed:', updateError.message);
      setRequests(snapshot);
      setError(`Could not ${decision === 'accepted' ? 'accept' : 'decline'} that request. Please try again.`);
      return false;
    }
    return true;
  }

  return {
    requests,
    isLoading,
    error,
    accept: (id: string) => decide(id, 'accepted'),
    decline: (id: string) => decide(id, 'declined'),
    refetch: load,
  };
}

/**
 * Client/staffer personally invites `workerId` to their own open shift.
 * RLS enforces the caller must be the shift's client, so this simply
 * surfaces the friendliest error message for the UI to show.
 */
export async function createShiftRequest(
  clientId: string, workerId: string, shiftId: string, message?: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from('shift_requests')
    .insert({
      client_id: clientId,
      worker_id: workerId,
      shift_id: shiftId,
      message: message?.trim() ? message.trim() : null,
    });

  if (error) {
    if (error.code === '23505') return { ok: false, message: 'You already requested this worker for this shift.' };
    console.error('[createShiftRequest] insert failed:', error.message);
    return { ok: false, message: 'Could not send the request. Please try again.' };
  }
  return { ok: true };
}
