/**
 * Live timesheets for the poster.
 *
 *   useShiftLivePings(shiftId, onPing) — listens on the public Realtime
 *     channel `shift-live:<shiftId>`. The server broadcasts a bare "refresh"
 *     there on every clock in/out, break, sign-off and approval; the board
 *     refetches through the API (which checks ownership). Polling covers a
 *     missed ping or a blocked socket.
 *
 *   usePendingApprovals() — the poster's shifts that are live now or still
 *     have timesheets to approve (GET /time-entries/pending-approvals).
 */
import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { RealtimeClient } from '@supabase/realtime-js';
import { isSupabaseConfigured, supabaseConfig, getCachedAccessToken } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/contexts/RoleContext';
import { apiClient } from '@/lib/api';

export function useShiftLivePings(shiftId: string | undefined, onPing: () => void) {
  const cb = useRef(onPing);
  cb.current = onPing;
  useEffect(() => {
    if (!shiftId || !isSupabaseConfigured) return;
    let cancelled = false;
    let client: RealtimeClient | null = null;
    let last = 0;
    const onVisibility = () => {
      if (!client) return;
      try {
        if (document.visibilityState === 'visible') { client.connect(); cb.current(); }
        else void client.disconnect();
      } catch { /* best-effort */ }
    };
    void (async () => {
      try {
        const { RealtimeClient: Client } = await import('@supabase/realtime-js');
        if (cancelled) return;
        client = new Client(supabaseConfig.realtimeUrl, {
          params: { apikey: supabaseConfig.anonKey },
          accessToken: async () => getCachedAccessToken(),
        });
        const channel = client.channel(`shift-live:${shiftId}`);
        channel.on('broadcast', { event: 'refresh' }, () => {
          // Several events can land together (clock-out closes a break): one refetch.
          const now = Date.now();
          if (now - last < 600) return;
          last = now;
          cb.current();
        });
        channel.subscribe(() => {});
        document.addEventListener('visibilitychange', onVisibility);
      } catch { /* Realtime unavailable: polling keeps the board current */ }
    })();
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (client) { try { void client.disconnect(); } catch { /* ignore */ } }
    };
  }, [shiftId]);
}

export type PendingShift = {
  shift_id: string;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  timezone: string | null;
  live: boolean;
  booked: number;
  clocked_in: number;
  on_break: number;
  clocked_out: number;
  to_approve: number;
  disputed: number;
  missing_clock_out: number;
  approved: number;
};

export const PENDING_APPROVALS_KEY = ['time-entries', 'pending-approvals'] as const;

export function usePendingApprovals() {
  const { user } = useAuth();
  const { role } = useRole();
  const poster = role === 'client' || role === 'staffer';
  const q = useQuery<PendingShift[]>({
    queryKey: [...PENDING_APPROVALS_KEY, user?.id],
    enabled: !!user?.id && poster,
    staleTime: 20_000,
    refetchInterval: () => (typeof document !== 'undefined' && document.visibilityState === 'visible' ? 30_000 : false),
    queryFn: () => apiClient(user!.id).get<PendingShift[]>('/time-entries/pending-approvals'),
  });
  return { shifts: q.data ?? [], isLoading: q.isLoading, refetch: q.refetch };
}
