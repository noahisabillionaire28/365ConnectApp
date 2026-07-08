/**
 * usePayments — fetches all payment rows for the current authenticated user
 * (either as worker_id for shift earnings, or for Pro subscription charges).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { PaymentRow } from '@/lib/supabase';

export const PAYMENTS_QUERY_KEY = ['payments'] as const;

export function usePayments() {
  const { user, loading: authLoading } = useAuth();

  return useQuery<PaymentRow[]>({
    queryKey: [...PAYMENTS_QUERY_KEY, user?.id ?? 'anon'],
    enabled: !!user?.id && !authLoading,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('worker_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[usePayments] fetch error:', error.message);
        throw error;
      }
      return (data ?? []) as PaymentRow[];
    },
  });
}
