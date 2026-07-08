import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRoster, type RosterWorker } from './useRoster';

export type AssignApplicationStatus = 'none' | 'pending' | 'accepted' | 'rejected' | 'declined' | 'withdrawn';

export type AssignableWorker = RosterWorker & { applicationStatus: AssignApplicationStatus };

/**
 * A staffer's roster, cross-referenced with existing `applications` rows for
 * one shift, plus the ability to directly assign (insert an already-accepted
 * application row for) a roster worker.
 */
export function useAssignWorkers(shiftId: string | undefined) {
  const { workers: roster, isLoading: rosterLoading, error: rosterError } = useRoster();
  const [statusByWorker, setStatusByWorker] = useState<Record<string, AssignApplicationStatus>>({});
  const [loadingStatuses, setLoadingStatuses] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadStatuses = useCallback(async () => {
    if (!shiftId || roster.length === 0) {
      setStatusByWorker({});
      setLoadingStatuses(false);
      return;
    }
    setLoadingStatuses(true);
    const { data, error } = await supabase
      .from('applications')
      .select('worker_id, status')
      .eq('shift_id', shiftId)
      .in('worker_id', roster.map((w) => w.id));

    if (error) {
      console.error('[useAssignWorkers] status fetch failed:', error.message);
      setErrorMessage(error.message);
      setLoadingStatuses(false);
      return;
    }

    const map: Record<string, AssignApplicationStatus> = {};
    (data ?? []).forEach((r) => { map[r.worker_id as string] = r.status as AssignApplicationStatus; });
    setStatusByWorker(map);
    setLoadingStatuses(false);
  }, [shiftId, roster]);

  useEffect(() => { void loadStatuses(); }, [loadStatuses]);

  async function assign(workerId: string) {
    if (!shiftId || assigningId) return;
    setAssigningId(workerId);
    setErrorMessage(null);

    const { error } = await supabase
      .from('applications')
      .upsert(
        { shift_id: shiftId, worker_id: workerId, status: 'accepted' },
        { onConflict: 'shift_id,worker_id' },
      );

    setAssigningId(null);
    if (error) {
      console.error('[useAssignWorkers] assign failed:', error.message);
      setErrorMessage(error.message);
      return;
    }
    setStatusByWorker((prev) => ({ ...prev, [workerId]: 'accepted' }));
  }

  const workers: AssignableWorker[] = roster.map((w) => ({
    ...w,
    applicationStatus: statusByWorker[w.id] ?? 'none',
  }));

  return {
    workers,
    isLoading: rosterLoading || loadingStatuses,
    error: rosterError ?? errorMessage,
    assign,
    assigningId,
  };
}
