import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { PAYMENTS_QUERY_KEY } from './usePayments';

export type WorkerAck = 'accepted' | 'disputed' | null;

export type TimeEntryRow = {
  id: string;
  shift_id: string;
  worker_id: string;
  clock_in: string;
  clock_out: string | null;
  break_minutes: number;
  /** When the current (open) break started; null when not on break. Server-tracked. */
  break_started_at?: string | null;
  total_hours: number | null;
  total_pay: number | null;
  fee: number | null;
  created_at: string;
  /** Poster approval (migration 0017). */
  approved?: boolean | null;
  approved_at?: string | null;
  approved_pay?: number | null;
  regular_hours?: number | null;
  overtime_hours?: number | null;
  /** Hours as clocked, before any poster change (migration 0027). */
  clocked_hours?: number | null;
  /** Server-derived: the poster's approval changed the hours beyond 5 minutes. */
  hours_changed?: boolean;
  worker_ack?: WorkerAck;
  worker_ack_at?: string | null;
  dispute_note?: string | null;
  /** camelCase aliases */
  clockInISO: string;
  breakMinutes: number;
  totalPay: number | null;
  approvedPay: number | null;
  hoursChanged: boolean;
  workerAck: WorkerAck;
  /** enriched flags added by startOrResume */
  alreadyCompleted?: boolean;
  resumed?: boolean;
};

type RawEntry = Omit<TimeEntryRow,
  'clockInISO' | 'breakMinutes' | 'totalPay' | 'approvedPay' | 'hoursChanged' | 'workerAck' | 'alreadyCompleted' | 'resumed'>;

function toEntry(r: RawEntry, flags?: { alreadyCompleted?: boolean; resumed?: boolean }): TimeEntryRow {
  return {
    ...r,
    clockInISO:      r.clock_in,
    breakMinutes:    r.break_minutes ?? 0,
    totalPay:        r.total_pay,
    approvedPay:     r.approved_pay ?? null,
    hoursChanged:    !!r.hours_changed,
    workerAck:       r.worker_ack ?? null,
    alreadyCompleted: flags?.alreadyCompleted ?? false,
    resumed:          flags?.resumed          ?? false,
  };
}

/** 5.2 → "5h 12m"; 8 → "8h"; 0.5 → "30m". Mirrors the server's copy. */
export function formatHoursMinutes(hours: number | null | undefined): string {
  const total = Math.max(0, Math.round((Number(hours) || 0) * 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export const TIME_ENTRY_KEY = 'time-entry';

/**
 * The worker's own time entry for a shift, cached in react-query (null when
 * they have not clocked in). Used by the shift page's "Your hours" card.
 */
export function useMyTimeEntry(shiftId: string | undefined) {
  const { user } = useAuth();
  const q = useQuery<TimeEntryRow | null, Error>({
    queryKey: [TIME_ENTRY_KEY, shiftId, user?.id],
    enabled: !!shiftId && !!user?.id,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const row = await apiClient(user!.id).get<RawEntry | null>(`/time-entries/${shiftId}`);
      return row ? toEntry(row) : null;
    },
  });
  return { entry: q.data ?? null, isLoading: q.isLoading, refetch: q.refetch };
}

/**
 * Worker's answer to approved hours: "Looks right" or "Dispute" (with an
 * optional note). Resolves to null on success, else the server's message.
 */
export function useAckHours() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const ack = useCallback(async (entryId: string, action: 'accept' | 'dispute', note?: string): Promise<string | null> => {
    if (!user?.id || busy) return null;
    setBusy(true);
    try {
      await apiClient(user.id).post(`/time-entries/${entryId}/ack`, { action, ...(note?.trim() ? { note: note.trim() } : {}) });
      void qc.invalidateQueries({ queryKey: [TIME_ENTRY_KEY] });
      void qc.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Could not send your answer.';
    } finally { setBusy(false); }
  }, [user?.id, busy, qc]);
  return { ack, busy };
}

export function useTimeEntry(shiftId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [entry, setEntry]       = useState<TimeEntryRow | null>(null);
  const [isLoading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!shiftId || !user?.id) { setEntry(null); setLoading(false); return; }
    setLoading(true);
    try {
      const row = await apiClient(user.id).get<RawEntry | null>(`/time-entries/${shiftId}`);
      setEntry(row ? toEntry(row) : null);
    } catch (e) {
      console.error('[useTimeEntry] load failed:', e);
      setEntry(null);
    } finally {
      setLoading(false);
    }
  }, [shiftId, user?.id]);

  useEffect(() => { void load(); }, [load]);

  /**
   * Clock in. `coords` is the worker's live GPS position; the server checks it
   * against the venue (within 1 mile) and rejects a cancelled or ended shift.
   */
  const clockIn = useCallback(async (coords?: { lat: number; lng: number } | null): Promise<TimeEntryRow | null> => {
    if (!shiftId || !user?.id) return null;
    try {
      const row = await apiClient(user.id).post<RawEntry>('/time-entries', { shift_id: shiftId, ...(coords ?? {}) });
      const e = toEntry(row, { alreadyCompleted: false, resumed: false });
      setEntry(e);
      return e;
    } catch (e) {
      console.error('[useTimeEntry] clockIn failed:', e);
      return null;
    }
  }, [shiftId, user?.id]);

  /**
   * Used by ClockInScreen: resume an open entry, or clock in with the worker's
   * live position (`coords`), which the server verifies against the venue.
   * Throws with the server's message when the clock-in is refused.
   * Returns an enriched TimeEntryRow with `alreadyCompleted`, `resumed` flags.
   */
  const startOrResume = useCallback(async (
    coords?: { lat: number; lng: number } | null,
  ): Promise<TimeEntryRow> => {
    if (!shiftId || !user?.id) throw new Error('Missing shift or user');
    // First, check for an existing entry
    let existing: RawEntry | null = null;
    try {
      existing = await apiClient(user.id).get<RawEntry | null>(`/time-entries/${shiftId}`);
    } catch { /* not found */ }

    if (existing) {
      const alreadyCompleted = !!(existing.clock_out);
      const resumed = !alreadyCompleted;
      const e = toEntry(existing, { alreadyCompleted, resumed });
      setEntry(e);
      return e;
    }
    // No existing entry — clock in now
    const row = await apiClient(user.id).post<RawEntry>('/time-entries', { shift_id: shiftId, ...(coords ?? {}) });
    const e = toEntry(row, { alreadyCompleted: false, resumed: false });
    setEntry(e);
    void qc.invalidateQueries({ queryKey: [TIME_ENTRY_KEY] });
    return e;
  }, [shiftId, user?.id, qc]);

  /** Start a server-tracked break on an entry (defaults to the loaded one). */
  const startBreak = useCallback(async (entryId?: string): Promise<TimeEntryRow | null> => {
    const id = entryId ?? entry?.id;
    if (!id || !user?.id) return null;
    const row = await apiClient(user.id).post<RawEntry>(`/time-entries/${id}/break/start`, {});
    const e = toEntry(row);
    setEntry(e);
    return e;
  }, [entry?.id, user?.id]);

  /** End the open break; the server adds the elapsed minutes to break_minutes. */
  const stopBreak = useCallback(async (entryId?: string): Promise<TimeEntryRow | null> => {
    const id = entryId ?? entry?.id;
    if (!id || !user?.id) return null;
    const row = await apiClient(user.id).post<RawEntry>(`/time-entries/${id}/break/stop`, {});
    const e = toEntry(row);
    setEntry(e);
    return e;
  }, [entry?.id, user?.id]);

  /**
   * Clock out. The server sets the clock-out time, closes any open break and
   * computes total_hours / total_pay itself — nothing pay-related is sent.
   */
  const clockOut = useCallback(async (entryId?: string): Promise<TimeEntryRow | null> => {
    const id = entryId ?? entry?.id;
    if (!id || !user?.id) return null;
    try {
      const row = await apiClient(user.id).patch<RawEntry>(`/time-entries/${id}`, {
        clock_out: new Date().toISOString(),
      });
      const e = toEntry(row, { alreadyCompleted: true, resumed: false });
      setEntry(e);
      // The shift page's "Your hours" card and Earnings read these caches.
      void qc.invalidateQueries({ queryKey: [TIME_ENTRY_KEY] });
      void qc.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
      return e;
    } catch (e) {
      // Surface the failure — callers (completeEntry) must not report a
      // successful clock-out when the timesheet was never saved.
      console.error('[useTimeEntry] clockOut failed:', e);
      throw e;
    }
  }, [entry?.id, user?.id, qc]);

  /**
   * Alias used by ClockInScreen.
   * Accepts either `(entryId, updates)` or `(updates)`; any hours/pay in
   * `updates` are ignored — the server computes them. Resolves to
   * `{ error: null, entry }` on success or `{ error: string, entry: null }`.
   */
  const completeEntry = useCallback(async (
    entryIdOrUpdates?: string | Record<string, unknown>,
    _updates?: Record<string, unknown>,
  ): Promise<{ error: string | null; entry: TimeEntryRow | null }> => {
    const id = typeof entryIdOrUpdates === 'string' ? entryIdOrUpdates : undefined;
    try {
      const e = await clockOut(id);
      if (!e) return { error: 'Missing shift or session data', entry: null };
      return { error: null, entry: e };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e), entry: null };
    }
  }, [clockOut]);

  return { entry, isLoading, clockIn, startOrResume, startBreak, stopBreak, clockOut, completeEntry, refetch: load };
}
