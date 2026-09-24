import { useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { MY_APPLICATIONS_KEY } from './useMyApplications';
import { APPLICATION_STATUS_KEY } from './useApplicationStatus';

export const MY_SHIFT_IDS_KEY = 'my-shift-ids';

/** What the server did with an application: queued for review, or waitlisted (shift full). */
export type ApplyOutcome = 'pending' | 'standby';

/**
 * The set of shift ids the worker has a live application on (pending,
 * accepted or standby) — powers the "applied" checkmarks on Jobs.
 */
export function useApplications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const inFlight = useRef<Set<string>>(new Set());
  const key = [MY_SHIFT_IDS_KEY, user?.id];

  const q = useQuery<string[], Error>({
    queryKey: key,
    enabled: !!user?.id,
    staleTime: 20_000,
    queryFn: async () => {
      const rows = await apiClient(user!.id).get<{ shift_id: string; status: string }[]>('/applications/my-shift-ids');
      // Only live applications count as "applied" — a declined/withdrawn
      // shift must not show the applied checkmark.
      return rows.filter((r) => ['pending', 'accepted', 'standby'].includes(r.status)).map((r) => r.shift_id);
    },
  });
  const appliedShiftIds = new Set(q.data ?? []);

  const setIds = useCallback((fn: (prev: Set<string>) => Set<string>) => {
    qc.setQueryData<string[]>(key, (prev) => [...fn(new Set(prev ?? []))]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  /**
   * Apply to (or, when the shift is full, join the waitlist for) a shift.
   * `onSuccess` receives the outcome so the screen can say which one happened.
   */
  const submitApplication = useCallback(
    async (
      shiftId: string,
      matchScore?: number,
      onSuccess?: (outcome: ApplyOutcome) => void,
      onError?: (msg: string) => void,
    ): Promise<void> => {
      if (!user?.id) return;
      if (appliedShiftIds.has(shiftId) || inFlight.current.has(shiftId)) return;

      inFlight.current.add(shiftId);
      setIds((prev) => new Set([...prev, shiftId]));

      try {
        const row = await apiClient(user.id).post<{ status?: string }>('/applications', {
          shift_id:    shiftId,
          match_score: typeof matchScore === 'number' ? Math.round(matchScore) : null,
        });
        inFlight.current.delete(shiftId);
        void qc.invalidateQueries({ queryKey: [MY_APPLICATIONS_KEY] });
        void qc.invalidateQueries({ queryKey: [APPLICATION_STATUS_KEY, shiftId] });
        void qc.invalidateQueries({ queryKey: ['shift', shiftId] });
        onSuccess?.(row?.status === 'standby' ? 'standby' : 'pending');
      } catch (e: unknown) {
        inFlight.current.delete(shiftId);
        const msg = e instanceof Error ? e.message : String(e);
        // Roll back the optimistic "applied" state on any failure.
        setIds((prev) => { const next = new Set(prev); next.delete(shiftId); return next; });
        if (msg.includes('Already applied')) {
          // The cached status was stale: pull the real one so the page shows
          // "applied" instead of an Apply button that never works.
          void qc.invalidateQueries({ queryKey: [APPLICATION_STATUS_KEY, shiftId] });
          void qc.invalidateQueries({ queryKey: key });
          onError?.('You already applied to this shift.');
          return;
        }
        console.error('[Applications] Insert failed:', msg);
        onError?.(msg);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id, q.data, setIds],
  );

  return { appliedShiftIds, submitApplication };
}
