import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

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
  /** camelCase aliases */
  clockInISO: string;
  breakMinutes: number;
  totalPay: number | null;
  /** enriched flags added by startOrResume */
  alreadyCompleted?: boolean;
  resumed?: boolean;
};

type RawEntry = Omit<TimeEntryRow, 'clockInISO' | 'breakMinutes' | 'totalPay' | 'alreadyCompleted' | 'resumed'>;

function toEntry(r: RawEntry, flags?: { alreadyCompleted?: boolean; resumed?: boolean }): TimeEntryRow {
  return {
    ...r,
    clockInISO:      r.clock_in,
    breakMinutes:    r.break_minutes ?? 0,
    totalPay:        r.total_pay,
    alreadyCompleted: flags?.alreadyCompleted ?? false,
    resumed:          flags?.resumed          ?? false,
  };
}

/**
 * Static async helper — checks whether the worker has a completed (clocked-out)
 * time entry for the given shift.
 */
export async function hasCompletedTimeEntry(shiftId: string, workerId: string): Promise<boolean> {
  try {
    const row = await apiClient(workerId).get<RawEntry | null>(`/time-entries/${shiftId}`);
    return !!(row?.clock_out);
  } catch {
    return false;
  }
}

export function useTimeEntry(shiftId: string | undefined) {
  const { user } = useAuth();
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

  const clockIn = useCallback(async (): Promise<TimeEntryRow | null> => {
    if (!shiftId || !user?.id) return null;
    try {
      const row = await apiClient(user.id).post<RawEntry>('/time-entries', { shift_id: shiftId });
      const e = toEntry(row, { alreadyCompleted: false, resumed: false });
      setEntry(e);
      return e;
    } catch (e) {
      console.error('[useTimeEntry] clockIn failed:', e);
      return null;
    }
  }, [shiftId, user?.id]);

  /**
   * Alias used by ClockInScreen.
   * Accepts optional (shiftId, userId) args that are ignored (shiftId already
   * bound in hook; userId from auth context).
   * Returns an enriched TimeEntryRow with `alreadyCompleted`, `resumed` flags.
   */
  const startOrResume = useCallback(async (
    _shiftId?: string,
    _userId?: string,
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
    // No existing entry — create one
    const row = await apiClient(user.id).post<RawEntry>('/time-entries', { shift_id: shiftId });
    const e = toEntry(row, { alreadyCompleted: false, resumed: false });
    setEntry(e);
    return e;
  }, [shiftId, user?.id]);

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
      return e;
    } catch (e) {
      // Surface the failure — callers (completeEntry) must not report a
      // successful clock-out when the timesheet was never saved.
      console.error('[useTimeEntry] clockOut failed:', e);
      throw e;
    }
  }, [entry?.id, user?.id]);

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
