import { useCallback, useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export const PAYMENTS_QUERY_KEY = ['payments'] as const;

/** Where a timesheet is on its way to money: clocked in → clocked out → approved → paid. */
export type PayStage = 'in_progress' | 'worked' | 'approved' | 'paid';

/** The pay timeline as the API sends it (snake_case). */
export type RawPayTimeline = {
  worked_at: string | null;
  approved_at: string | null;
  hours_changed: boolean;
  worker_ack: 'accepted' | 'disputed' | null;
  acknowledged_at: string | null;
  paid_at: string | null;
  paid_amount: number | null;
  /** 'stripe' = paid through the app; 'manual' = the poster marked it paid outside the app. */
  paid_method: 'stripe' | 'manual' | null;
  stage: PayStage;
};

/** Worked → Approved → Paid, with when each step happened (null until it has). */
export type PayTimeline = {
  workedAt: string | null;
  approvedAt: string | null;
  /** The poster's approval changed the hours; until the worker answers, the Approved step needs a look. */
  hoursChanged: boolean;
  workerAck: 'accepted' | 'disputed' | null;
  acknowledgedAt: string | null;
  paidAt: string | null;
  paidAmount: number | null;
  paidMethod: 'stripe' | 'manual' | null;
  stage: PayStage;
};

export function toTimeline(t: RawPayTimeline | null | undefined): PayTimeline | null {
  if (!t) return null;
  return {
    workedAt: t.worked_at ?? null,
    approvedAt: t.approved_at ?? null,
    hoursChanged: !!t.hours_changed,
    workerAck: t.worker_ack ?? null,
    acknowledgedAt: t.acknowledged_at ?? null,
    paidAt: t.paid_at ?? null,
    paidAmount: t.paid_amount != null ? Number(t.paid_amount) : null,
    paidMethod: t.paid_method ?? null,
    stage: t.stage ?? 'in_progress',
  };
}

export type PaymentRow = {
  id: string;
  shift_id: string | null;
  worker_id: string;
  amount: number;
  fee: number;
  net_amount: number;
  /** completed | pending | failed | simulated — plus timesheet states below */
  status: string;
  /** shift_payment | manual | pro_subscription | timesheet */
  payment_type: string;
  created_at: string;
  shift_title?: string | null;
  company_name?: string | null;
  /** 'in' = earned by the worker; 'out' = paid by the client */
  direction?: 'in' | 'out';
  client_id?: string | null;
  /** timesheet rows only */
  hours?: number | null;
  /** timesheet rows only: the per-shift pay timeline and where it is now */
  timeline?: PayTimeline | null;
  stage?: PayStage;
};

/** A worker's own time entry, as returned by GET /time-entries/mine (plus camelCase derived fields). */
export type MyTimeEntry = {
  id: string;
  shift_id: string;
  clock_in: string | null;
  clock_out: string | null;
  total_hours: number | null;
  total_pay: number | null;
  approved: boolean | null;
  approved_at: string | null;
  approved_pay: number | null;
  /** The poster changed the hours at approval; the worker may accept or dispute. */
  hours_changed?: boolean;
  worker_ack?: 'accepted' | 'disputed' | null;
  worker_ack_at?: string | null;
  shift_title?: string | null;
  company_name?: string | null;
  /** When the shift itself started (an instant), for week grouping. */
  shift_start_time?: string | null;
  paid?: boolean;
  timeline?: RawPayTimeline | null;
  /** approved_pay once approved, else the clock-out estimate (server-computed). */
  expected_pay?: number | null;
  /** Derived: the timeline in camelCase (built from the row when the server sent none). */
  payTimeline: PayTimeline;
  expectedPay: number;
};

type RawMyTimeEntry = Omit<MyTimeEntry, 'payTimeline' | 'expectedPay'>;

/** The timeline for a row the server sent without one (older API): derived from its own fields. */
function fallbackTimeline(e: RawMyTimeEntry): PayTimeline {
  const approved = !!e.approved;
  return {
    workedAt: e.clock_out ?? null,
    approvedAt: approved ? e.approved_at ?? null : null,
    hoursChanged: !!e.hours_changed,
    workerAck: e.worker_ack ?? null,
    acknowledgedAt: e.worker_ack_at ?? null,
    paidAt: null,
    paidAmount: null,
    paidMethod: null,
    stage: e.paid ? 'paid' : approved ? 'approved' : e.clock_out ? 'worked' : 'in_progress',
  };
}

function toMyEntry(e: RawMyTimeEntry): MyTimeEntry {
  const rawPay = Number(e.approved ? (e.approved_pay ?? e.total_pay ?? 0) : (e.total_pay ?? 0)) || 0;
  return {
    ...e,
    payTimeline: toTimeline(e.timeline) ?? fallbackTimeline(e),
    expectedPay: e.expected_pay != null && Number.isFinite(Number(e.expected_pay)) ? Number(e.expected_pay) : rawPay,
  };
}

/** What a finished entry is worth right now: the approved figure once the poster signed off, else the clock-out estimate. */
export function entryPay(e: MyTimeEntry): number {
  if (e.payTimeline?.stage === 'paid' && e.payTimeline.paidAmount != null) return e.payTimeline.paidAmount;
  return e.expectedPay ?? (Number(e.approved ? (e.approved_pay ?? e.total_pay ?? 0) : (e.total_pay ?? 0)) || 0);
}

async function fetchMyEntries(userId: string): Promise<MyTimeEntry[]> {
  const rows = await apiClient(userId).get<RawMyTimeEntry[]>('/time-entries/mine');
  return rows.map(toMyEntry);
}

/**
 * The worker's own timesheets (GET /time-entries/mine). Keyed under the
 * payments prefix so every clock-out / approval invalidation refreshes it too.
 */
export function useMyTimeEntries() {
  const { user } = useAuth();
  const q = useQuery<MyTimeEntry[], Error>({
    queryKey: [...PAYMENTS_QUERY_KEY, 'time-entries', user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    queryFn: () => fetchMyEntries(user!.id),
  });
  return { entries: q.data ?? [], isLoading: !!user?.id && q.isLoading, isError: q.isError };
}

/** Pipeline state for a finished timesheet as an Earnings row status. */
function timesheetStatus(e: MyTimeEntry): string {
  if (e.payTimeline.stage === 'paid') return 'completed';
  if (!e.approved) return 'awaiting_approval';
  if (e.worker_ack === 'disputed') return 'disputed';
  if (e.hours_changed && !e.worker_ack) return 'hours_updated';
  return 'approved';
}

/**
 * Money in and out. Real payment rows come from /payments; on top of them a
 * worker sees each finished shift as it moves through the pipeline
 * (awaiting approval → approved → paid) with its timeline, so "Pending" is
 * never empty after a day's work. A shift payment that a timesheet already
 * covers is folded into that timesheet row rather than listed twice.
 */
export function usePayments() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = [...PAYMENTS_QUERY_KEY, user?.id];

  const q = useQuery<PaymentRow[], Error>({
    queryKey: key,
    enabled: !!user?.id,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const [payments, entries] = await Promise.all([
        apiClient(user!.id).get<PaymentRow[]>('/payments'),
        fetchMyEntries(user!.id).catch(() => [] as MyTimeEntry[]),
      ]);
      const timesheets: PaymentRow[] = entries
        .filter((e) => e.clock_out)
        .map((e) => {
          const t = e.payTimeline;
          const amount = entryPay(e);
          return {
            id: `timesheet-${e.id}`,
            shift_id: e.shift_id,
            worker_id: user!.id,
            amount,
            fee: 0,
            net_amount: amount,
            status: timesheetStatus(e),
            payment_type: 'timesheet',
            created_at: t.paidAt ?? e.approved_at ?? e.clock_out ?? e.clock_in ?? new Date().toISOString(),
            shift_title: e.shift_title ?? null,
            company_name: e.company_name ?? null,
            direction: 'in',
            hours: e.total_hours ?? null,
            timeline: t,
            stage: t.stage,
          };
        });
      const covered = new Set(timesheets.map((r) => r.shift_id));
      const rest = payments.filter((p) =>
        !(p.direction !== 'out' && p.payment_type !== 'pro_subscription' && p.shift_id && covered.has(p.shift_id)));
      return [...timesheets, ...rest].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    },
  });

  const createPayment = useCallback(async (payment: {
    shift_id?: string | null;
    amount: number;
    fee: number;
    net_amount: number;
    status?: string;
    payment_type?: string;
  }): Promise<PaymentRow | null> => {
    if (!user?.id) return null;
    try {
      const row = await apiClient(user.id).post<PaymentRow>('/payments', payment);
      void qc.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
      return row;
    } catch (e) {
      console.error('[usePayments] createPayment failed:', e);
      return null;
    }
  }, [user?.id, qc]);

  const refetch = useCallback(async () => { await q.refetch(); }, [q.refetch]);

  return {
    data:      q.data ?? [],
    isError:   q.isError,
    payments:  q.data ?? [],
    isLoading: !!user?.id && q.isLoading,
    createPayment,
    refetch,
  };
}

/**
 * Which ways of paying a worker the server offers (GET /payments/config).
 * `stripe` stays true until the server says otherwise, so the roster's Pay
 * button never flickers away on a slow or older server.
 */
export function usePaymentsConfig() {
  const { user } = useAuth();
  const q = useQuery<{ stripe?: boolean; manual?: boolean }, Error>({
    queryKey: ['payments-config', user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: () => apiClient(user!.id).get<{ stripe?: boolean; manual?: boolean }>('/payments/config'),
  });
  const stripe = q.isSuccess && typeof q.data?.stripe === 'boolean' ? q.data.stripe : true;
  return { stripe, isLoading: q.isLoading };
}

/**
 * Poster: record that a worker was paid outside the app (POST
 * /payments/manual). Resolves to null on success, else the server's message.
 */
export function useMarkPaid() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const markPaid = useCallback(async (shiftId: string, workerId: string): Promise<string | null> => {
    if (!user?.id || busy) return null;
    setBusy(true);
    try {
      await apiClient(user.id).post('/payments/manual', { shift_id: shiftId, worker_id: workerId });
      void qc.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
      void qc.invalidateQueries({ queryKey: ['accepted-workers', shiftId] });
      void qc.invalidateQueries({ queryKey: ['time-entry'] });
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Could not mark this worker as paid.';
    } finally { setBusy(false); }
  }, [user?.id, busy, qc]);
  return { markPaid, busy };
}
