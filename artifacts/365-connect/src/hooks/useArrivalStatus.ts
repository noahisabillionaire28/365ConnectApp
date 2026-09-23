import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { MY_APPLICATIONS_KEY, type MyApplication } from './useMyApplications';

/** The day-of statuses a booked worker can report. */
export type ArrivalStatus = 'on_my_way' | 'running_late' | 'arrived';

const HOUR = 3_600_000;

/**
 * Whether the day-of pills should show for a booked shift: it starts within
 * the next 12 hours or is in progress, and has not ended.
 */
export function isDayOfWindow(startISO: string | null | undefined, endISO: string | null | undefined, now = Date.now()): boolean {
  const startMs = startISO ? Date.parse(startISO) : NaN;
  const endMs = endISO ? Date.parse(endISO) : NaN;
  if (!Number.isFinite(startMs)) return false;
  if (Number.isFinite(endMs) && now > endMs) return false;
  return startMs - now <= 12 * HOUR;
}

/** Is the shift's start on the viewer's local calendar day today? */
export function isToday(startISO: string | null | undefined, now = new Date()): boolean {
  if (!startISO) return false;
  const d = new Date(startISO);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

/**
 * Worker-side mutations for day-of reliability: report an arrival status and
 * call out of a booked shift. Both update the worker's cached applications
 * optimistically and refresh every list that reflects booking state.
 */
export function useArrivalStatus() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: [MY_APPLICATIONS_KEY] });
    void qc.invalidateQueries({ queryKey: ['application-status'] });
    void qc.invalidateQueries({ queryKey: ['accepted-workers'] });
  }, [qc]);

  /** Optimistically stamp the status on the worker's cached application rows. */
  const patchLocal = useCallback((applicationId: string, status: ArrivalStatus | null, at: string | null) => {
    qc.setQueriesData<MyApplication[]>({ queryKey: [MY_APPLICATIONS_KEY] }, (prev) =>
      prev?.map((a) => (a.id === applicationId
        ? { ...a, arrival_status: status, arrival_status_at: at, arrivalStatus: status, arrivalStatusAt: at }
        : a)));
    qc.setQueriesData<{ status: string | null; id?: string | null; arrival_status?: ArrivalStatus | null; arrival_status_at?: string | null }>(
      { queryKey: ['application-status'] },
      (prev) => (prev && prev.id === applicationId ? { ...prev, arrival_status: status, arrival_status_at: at } : prev));
  }, [qc]);

  /**
   * Report a day-of status. Resolves to null on success or the server's
   * message on failure (the optimistic value is rolled back).
   */
  const setArrival = useCallback(async (
    applicationId: string,
    status: ArrivalStatus,
    previous: { status: ArrivalStatus | null; at: string | null } = { status: null, at: null },
  ): Promise<string | null> => {
    if (!user?.id || busy) return null;
    setBusy(true);
    patchLocal(applicationId, status, new Date().toISOString());
    try {
      await apiClient(user.id).post(`/applications/${applicationId}/arrival`, { status });
      invalidate();
      return null;
    } catch (e) {
      patchLocal(applicationId, previous.status, previous.at);
      return e instanceof Error ? e.message : 'Could not update your status.';
    } finally { setBusy(false); }
  }, [user?.id, busy, patchLocal, invalidate]);

  /** Call out of a booked shift (before it starts). Null on success, else the error. */
  const callOut = useCallback(async (applicationId: string, reason: string): Promise<string | null> => {
    if (!user?.id || busy) return null;
    setBusy(true);
    try {
      await apiClient(user.id).post(`/applications/${applicationId}/call-out`, { reason });
      invalidate();
      void qc.invalidateQueries({ queryKey: ['my-shift-ids'] });
      void qc.invalidateQueries({ queryKey: ['shifts'] });
      void qc.invalidateQueries({ queryKey: ['shift'] });
      void qc.invalidateQueries({ queryKey: ['worker-home-shifts'] });
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Could not call out of this shift.';
    } finally { setBusy(false); }
  }, [user?.id, busy, invalidate, qc]);

  return { setArrival, callOut, busy };
}
