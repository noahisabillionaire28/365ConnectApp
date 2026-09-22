import { useCallback } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export const PAYMENTS_QUERY_KEY = ['payments'] as const;

export type PaymentRow = {
  id: string;
  shift_id: string | null;
  worker_id: string;
  amount: number;
  fee: number;
  net_amount: number;
  /** completed | pending | failed | simulated — plus timesheet states below */
  status: string;
  /** shift_payment | pro_subscription | timesheet */
  payment_type: string;
  created_at: string;
  shift_title?: string | null;
  company_name?: string | null;
  /** 'in' = earned by the worker; 'out' = paid by the client */
  direction?: 'in' | 'out';
  client_id?: string | null;
  /** timesheet rows only */
  hours?: number | null;
};

/** A worker's own time entry, as returned by GET /time-entries/mine. */
type MyTimeEntry = {
  id: string;
  shift_id: string;
  clock_in: string | null;
  clock_out: string | null;
  total_hours: number | null;
  total_pay: number | null;
  approved: boolean | null;
  approved_at: string | null;
  approved_pay: number | null;
  shift_title?: string | null;
  company_name?: string | null;
  paid?: boolean;
};

/**
 * Money in and out. Real payment rows come from /payments; on top of them a
 * worker sees each finished shift as it moves through the pipeline
 * (awaiting approval → approved, payment on its way) so "Pending" is never
 * empty after a day's work.
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
        apiClient(user!.id).get<MyTimeEntry[]>('/time-entries/mine').catch(() => [] as MyTimeEntry[]),
      ]);
      const paidShifts = new Set(
        payments.filter((p) => p.direction !== 'out' && p.status === 'completed' && p.shift_id).map((p) => p.shift_id as string),
      );
      const timesheets: PaymentRow[] = entries
        .filter((e) => e.clock_out && !e.paid && !paidShifts.has(e.shift_id))
        .map((e) => {
          const amount = Number(e.approved ? (e.approved_pay ?? e.total_pay ?? 0) : (e.total_pay ?? 0)) || 0;
          return {
            id: `timesheet-${e.id}`,
            shift_id: e.shift_id,
            worker_id: user!.id,
            amount,
            fee: 0,
            net_amount: amount,
            status: e.approved ? 'approved' : 'awaiting_approval',
            payment_type: 'timesheet',
            created_at: e.approved_at ?? e.clock_out ?? e.clock_in ?? new Date().toISOString(),
            shift_title: e.shift_title ?? null,
            company_name: e.company_name ?? null,
            direction: 'in',
            hours: e.total_hours ?? null,
          };
        });
      return [...timesheets, ...payments].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
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
