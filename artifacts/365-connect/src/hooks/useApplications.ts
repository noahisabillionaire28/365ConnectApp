import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, type ApplicationRow } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Provides the set of shift IDs the current worker has already applied to,
 * plus a submitApplication function that writes to Supabase with an
 * optimistic local update so the badge / button flip instantly.
 *
 * Hardening:
 *  - Duplicate insert (23505 unique violation) is treated as "already applied"
 *    — the optimistic state is kept, NOT rolled back.
 *  - An in-flight ref prevents concurrent double-submits for the same shift.
 *  - appliedShiftIds is cleared on logout / user switch to avoid leaking
 *    another user's data into the UI.
 */
export function useApplications() {
  const { user } = useAuth();
  const [appliedShiftIds, setAppliedShiftIds] = useState<Set<string>>(new Set());

  // Ref mirror so submitApplication can read current state without stale closure
  const appliedRef = useRef<Set<string>>(new Set());
  useEffect(() => { appliedRef.current = appliedShiftIds; }, [appliedShiftIds]);

  // Tracks shift IDs whose insert is currently in-flight (prevents double-submit)
  const inFlight = useRef<Set<string>>(new Set());

  // ── Clear state on logout / user switch ───────────────────────────────────
  useEffect(() => {
    if (!user?.id) {
      setAppliedShiftIds(new Set());
      appliedRef.current = new Set();
      inFlight.current.clear();
    }
  }, [user?.id]);

  // ── Initial fetch ─────────────────────────────────────────────────────────
  useEffect(() => {
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
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`applications-worker-${user.id}`)
      .on<ApplicationRow>(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'applications',
          filter: `worker_id=eq.${user.id}`,
        },
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

  // ── submitApplication — optimistic + DB write ─────────────────────────────
  const submitApplication = useCallback(
    async (shiftId: string): Promise<void> => {
      if (!user?.id) return;

      // Idempotency: already applied (from state ref) or insert in-flight → skip
      if (appliedRef.current.has(shiftId) || inFlight.current.has(shiftId)) return;

      inFlight.current.add(shiftId);

      // Optimistic: flip badge + button before the network round-trip
      setAppliedShiftIds((prev) => new Set([...prev, shiftId]));

      const { error } = await supabase.from('applications').insert({
        shift_id:  shiftId,
        worker_id: user.id,
        status:    'pending',
      });

      inFlight.current.delete(shiftId);

      if (error) {
        if (error.code === '23505') {
          // Unique-constraint violation — row already exists in DB.
          // The optimistic state is correct; do NOT roll back.
          console.info('[Applications] Duplicate insert ignored (row already exists):', shiftId);
          return;
        }
        // True write failure — roll back the optimistic update
        console.error('[Applications] Insert failed:', error.message, error.code);
        setAppliedShiftIds((prev) => {
          const next = new Set(prev);
          next.delete(shiftId);
          return next;
        });
      }
    },
    [user?.id], // appliedRef + inFlight are refs, no closure staleness
  );

  return { appliedShiftIds, submitApplication };
}
