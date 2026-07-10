import { useCallback, useEffect, useState } from 'react';
import { supabase, shiftRowToMockShift, type ShiftRow, type MockShift } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useMyLocation } from './useMyLocation';

export type ClientShift = MockShift & { applicantCount: number };

/**
 * All shifts posted by the logged-in client, each annotated with a live
 * applicant count derived from the applications table.  Realtime keeps both
 * application counts and shift status changes in sync.
 */
export function useClientShiftsDashboard() {
  const { user }    = useAuth();
  const { coords }  = useMyLocation();
  const [shifts,    setShifts]    = useState<ClientShift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) { setShifts([]); setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);

    // applications(count) is a PostgREST aggregate — returns [{ count: number }]
    const { data, error: fetchErr } = await supabase
      .from('shifts')
      .select('*, applications(count)')
      .eq('client_id', user.id)
      .order('created_at', { ascending: false });

    if (fetchErr) {
      console.error('[useClientShiftsDashboard] fetch failed:', fetchErr.message);
      setError(fetchErr.message);
      setIsLoading(false);
      return;
    }

    type RawRow = ShiftRow & { applications: [{ count: number }] | null };
    setShifts(
      ((data ?? []) as RawRow[]).map((row) => ({
        ...shiftRowToMockShift(row, coords),
        applicantCount: (row.applications?.[0] as { count: number } | undefined)?.count ?? 0,
      })),
    );
    setIsLoading(false);
  }, [user?.id, coords.lat, coords.lng]);

  useEffect(() => { void load(); }, [load]);

  // Realtime: refresh when applications or shifts change for this client
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`client-dashboard-${user.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'applications' },
        () => { void load(); },
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'shifts', filter: `client_id=eq.${user.id}` },
        () => { void load(); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id, load]);

  return { shifts, isLoading, error, refetch: load };
}
