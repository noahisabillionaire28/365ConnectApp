import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export function useApplications() {
  const { user } = useAuth();
  const [appliedShiftIds, setAppliedShiftIds] = useState<Set<string>>(new Set());
  const inFlight = useRef<Set<string>>(new Set());

  // Clear on logout / user switch
  useEffect(() => {
    if (!user?.id) {
      setAppliedShiftIds(new Set());
      inFlight.current.clear();
    }
  }, [user?.id]);

  // Initial fetch
  useEffect(() => {
    if (!user?.id) return;
    apiClient(user.id).get<{ shift_id: string; status: string }[]>('/applications/my-shift-ids')
      .then((rows) => {
        setAppliedShiftIds(new Set(rows.map((r) => r.shift_id)));
      })
      .catch((e) => console.error('[Applications] Initial fetch failed:', e));
  }, [user?.id]);

  const submitApplication = useCallback(
    async (shiftId: string, matchScore?: number, onSuccess?: () => void): Promise<void> => {
      if (!user?.id) return;
      if (appliedShiftIds.has(shiftId) || inFlight.current.has(shiftId)) return;

      inFlight.current.add(shiftId);
      setAppliedShiftIds((prev) => new Set([...prev, shiftId]));

      try {
        await apiClient(user.id).post('/applications', {
          shift_id:    shiftId,
          match_score: typeof matchScore === 'number' ? Math.round(matchScore) : null,
        });
        inFlight.current.delete(shiftId);
        onSuccess?.();
      } catch (e: unknown) {
        inFlight.current.delete(shiftId);
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('Already applied')) {
          console.info('[Applications] Duplicate insert ignored:', shiftId);
          return;
        }
        console.error('[Applications] Insert failed:', msg);
        setAppliedShiftIds((prev) => {
          const next = new Set(prev); next.delete(shiftId); return next;
        });
      }
    },
    [user?.id, appliedShiftIds],
  );

  return { appliedShiftIds, submitApplication };
}
