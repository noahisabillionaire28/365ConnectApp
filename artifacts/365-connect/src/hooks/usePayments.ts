import { useState, useEffect, useCallback } from 'react';
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
  status: string;
  payment_type: string;
  created_at: string;
  shift_title?: string | null;
  company_name?: string | null;
  /** 'in' = earned by the worker; 'out' = paid by the client */
  direction?: 'in' | 'out';
  client_id?: string | null;
};

export function usePayments() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [isError, setIsError]   = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) { setPayments([]); setLoading(false); return; }
    setLoading(true);
    setIsError(false);
    try {
      const rows = await apiClient(user.id).get<PaymentRow[]>('/payments');
      setPayments(rows);
    } catch (e) {
      console.error('[usePayments] load failed:', e);
      setIsError(true);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

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
      setPayments((prev) => [row, ...prev]);
      return row;
    } catch (e) {
      console.error('[usePayments] createPayment failed:', e);
      return null;
    }
  }, [user?.id]);

  return {
    data:      payments,
    isError,
    payments,
    isLoading,
    createPayment,
    refetch: load,
  };
}
