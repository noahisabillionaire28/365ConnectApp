import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, type ApplicationRow } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Provides the set of shift IDs the current worker has already applied to,
 * plus a submitApplication function that writes to Supabase with an
 * optimistic local update so the badge / button flip instantly.
 *
 * Hook inventory (7 hooks — stable count across all renders):
 *   1. useContext  (via useAuth)
 *   2. useState    (appliedShiftIds)
 *   3. useRef      (inFlight — in-flight insert guard)
 *   4. useEffect   (clear on logout / user switch)
 *   5. useEffect   (initial fetch)
 *   6. useEffect   (realtime INSERT subscription)
 *   7. useCallback (submitApplication)
 *
 * Hardening:
 *   - 23505 unique-constraint error → row already exists, keep optimistic state.
 *   - inFlight ref prevents concurrent double-submits for the same shift.
 *   - State cleared on user change so stale badges never bleed between users.
 */
export function useApplications() {
  const { user } = useAuth();                                           // hook 1
  const [appliedShiftIds, setAppliedShiftIds] = useState<Set<string>>( // hook 2
    new Set(),
  );
  // In-flight guard: prevents a second submit while the first is awaiting DB.
  // Using a ref (not state) so it never triggers an extra render.
  const inFlight = useRef<Set<string>>(new Set());                      // hook 3

  // ── Clear state on logout / user switch ───────────────────────────────────
  useEffect(() => {                                                      // hook 4
    if (!user?.id) {
      setAppliedShiftIds(new Set());
      inFlight.current.clear();
    }
  }, [user?.id]);

  // ── Initial fetch ─────────────────────────────────────────────────────────
  useEffect(() => {                                                      // hook 5
    if (!user?.id) return;
    void supabase
      .from('applications')
      .select('shift_id')
      .eq('worker_id', user.id)
      .then(({ data, error }) => {
        if (error) {
          console.error('[Applications] Initial fetch failed:', error.message);
          return;
        }
        setAppliedShiftIds(
          new Set((data ?? []).map((r) => (r as { shift_id: string }).shift_id)),
        );
      });
  }, [user?.id]);

  // ── Realtime subscription — INSERT on applications for this worker ─────────
  useEffect(() => {                                                      // hook 6
    if (!user?.id) return;
    const channel = supabase
      .channel(`applications-worker-${user.id}`)
      .on<ApplicationRow>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'applications',
          filter: `worker_id=eq.${user.id}` },
        (payload) => {
          setAppliedShiftIds((prev) => new Set([...prev, payload.new.shift_id]));
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Applications] Realtime subscription active for worker', user.id);
        }
      });
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id]);

  // ── submitApplication ─────────────────────────────────────────────────────
  // appliedShiftIds is in the dep array so the closure always sees the latest
  // set — this is correct and intentional. inFlight is a ref so it's excluded.
  const submitApplication = useCallback(                                // hook 7
    async (shiftId: string, matchScore?: number, onSuccess?: () => void): Promise<void> => {
      if (!user?.id) return;
      // Idempotency: skip if already applied or if this shift's insert is live
      if (appliedShiftIds.has(shiftId) || inFlight.current.has(shiftId)) return;

      inFlight.current.add(shiftId);
      // Optimistic: flip badge + button before the network round-trip
      setAppliedShiftIds((prev) => new Set([...prev, shiftId]));

      const { error } = await supabase.from('applications').insert({
        shift_id:    shiftId,
        worker_id:   user.id,
        status:      'pending',
        match_score: typeof matchScore === 'number' ? Math.round(matchScore) : null,
      });

      inFlight.current.delete(shiftId);

      if (error) {
        if (error.code === '23505') {
          // Unique-constraint: row already exists — optimistic state is correct
          console.info('[Applications] Duplicate insert ignored:', shiftId);
          return;
        }
        console.error('[Applications] Insert failed:', error.message, error.code);
        // True failure — roll back optimistic update
        setAppliedShiftIds((prev) => {
          const next = new Set(prev);
          next.delete(shiftId);
          return next;
        });
        return; // do not fire onSuccess on failure
      }

      // Real new insert succeeded
      onSuccess?.();
    },
    [user?.id, appliedShiftIds],
  );

  return { appliedShiftIds, submitApplication };
}
