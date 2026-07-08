import { supabase, type TimeEntryRow } from '@/lib/supabase';

export type StartResult = {
  id: string;
  clockInISO: string;
  /** True when an existing (in-progress or completed) entry was resumed instead of created. */
  resumed: boolean;
  /** Set when the resumed entry was already ended — the caller should skip straight to summary. */
  alreadyCompleted: boolean;
  clockOutISO: string | null;
  breakMinutes: number;
  totalHours: number | null;
  totalPay: number | null;
  fee: number | null;
};

/**
 * Writes real rows to `time_entries` for the Clock In / Clock Out flow.
 * Handles the "already clocked in" race (unique shift_id+worker_id) by
 * resuming the existing row instead of erroring, so a refreshed tab or a
 * second visit to /clock/:id never loses or duplicates a timesheet.
 */
export function useTimeEntry() {
  async function startOrResume(shiftId: string, workerId: string): Promise<StartResult> {
    const { data, error } = await supabase
      .from('time_entries')
      .insert({ shift_id: shiftId, worker_id: workerId })
      .select('id, clock_in, clock_out, break_minutes, total_hours, total_pay, fee')
      .single();

    if (!error && data) {
      const row = data as TimeEntryRow;
      return {
        id: row.id,
        clockInISO: row.clock_in,
        resumed: false,
        alreadyCompleted: false,
        clockOutISO: null,
        breakMinutes: 0,
        totalHours: null,
        totalPay: null,
        fee: null,
      };
    }

    if (error?.code === '23505') {
      const { data: existing, error: fetchError } = await supabase
        .from('time_entries')
        .select('id, clock_in, clock_out, break_minutes, total_hours, total_pay, fee')
        .eq('shift_id', shiftId)
        .eq('worker_id', workerId)
        .single();
      if (fetchError || !existing) throw error;
      const row = existing as TimeEntryRow;
      return {
        id: row.id,
        clockInISO: row.clock_in,
        resumed: true,
        alreadyCompleted: !!row.clock_out,
        clockOutISO: row.clock_out,
        breakMinutes: row.break_minutes,
        totalHours: row.total_hours,
        totalPay: row.total_pay,
        fee: row.fee,
      };
    }

    throw error;
  }

  async function completeEntry(
    entryId: string,
    patch: { clockOutISO: string; breakMinutes: number; totalHours: number; totalPay: number; fee: number },
  ): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('time_entries')
      .update({
        clock_out:     patch.clockOutISO,
        break_minutes: Math.round(patch.breakMinutes),
        total_hours:   Math.round(patch.totalHours * 100) / 100,
        total_pay:     Math.round(patch.totalPay * 100) / 100,
        fee:           Math.round(patch.fee * 100) / 100,
      })
      .eq('id', entryId);
    return { error: error?.message ?? null };
  }

  return { startOrResume, completeEntry };
}

/** Has this worker already fully clocked out of this shift? Drives the Shift Detail CTA. */
export async function hasCompletedTimeEntry(shiftId: string, workerId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('time_entries')
    .select('clock_out')
    .eq('shift_id', shiftId)
    .eq('worker_id', workerId)
    .maybeSingle();
  if (error) {
    console.error('[useTimeEntry] completion check failed:', error.message);
    return false;
  }
  return !!data?.clock_out;
}
