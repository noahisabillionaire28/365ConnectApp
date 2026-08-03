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
    breakMinutes:    r.break_minutes,
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

  const clockOut = useCallback(async (updates: {
    clock_out: string;
    break_minutes?: number;
    total_hours?: number;
    total_pay?: number;
    fee?: number;
  }): Promise<TimeEntryRow | null> => {
    if (!entry?.id || !user?.id) return null;
    try {
      const row = await apiClient(user.id).patch<RawEntry>(`/time-entries/${entry.id}`, updates);
      const e = toEntry(row);
      setEntry(e);
      return e;
    } catch (e) {
      console.error('[useTimeEntry] clockOut failed:', e);
      return null;
    }
  }, [entry?.id, user?.id]);

  /**
   * Alias used by ClockInScreen.
   * Accepts either `(entryId, camelCaseUpdates)` or `(camelCaseUpdates)`.
   * Returns `{ error: null }` on success or `{ error: string }` on failure.
   */
  const completeEntry = useCallback(async (
    entryIdOrUpdates: string | {
      clockOutISO?: string; clock_out?: string;
      breakMinutes?: number; break_minutes?: number;
      totalHours?: number; total_hours?: number;
      totalPay?: number; total_pay?: number;
      fee?: number;
    },
    updates?: {
      clockOutISO?: string; clock_out?: string;
      breakMinutes?: number; break_minutes?: number;
      totalHours?: number; total_hours?: number;
      totalPay?: number; total_pay?: number;
      fee?: number;
    },
  ): Promise<{ error: string | null }> => {
    const u = (typeof entryIdOrUpdates === 'string' ? updates : entryIdOrUpdates) ?? {};
    try {
      await clockOut({
        clock_out:     u.clockOutISO  ?? u.clock_out     ?? new Date().toISOString(),
        break_minutes: u.breakMinutes ?? u.break_minutes,
        total_hours:   u.totalHours   ?? u.total_hours,
        total_pay:     u.totalPay     ?? u.total_pay,
        fee:           u.fee,
      });
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, [clockOut]);

  return { entry, isLoading, clockIn, startOrResume, clockOut, completeEntry, refetch: load };
}
