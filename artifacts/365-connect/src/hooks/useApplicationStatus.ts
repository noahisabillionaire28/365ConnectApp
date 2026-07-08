import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn' | null;

/** The current worker's application status for a single shift (Shift Detail CTA). */
export function useApplicationStatus(shiftId: string | undefined) {
  const { user } = useAuth();

  const query = useQuery<ApplicationStatus, Error>({
    queryKey: ['application-status', shiftId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('applications')
        .select('status')
        .eq('shift_id', shiftId!)
        .eq('worker_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.status as ApplicationStatus) ?? null;
    },
    enabled: !!shiftId && !!user?.id,
    staleTime: 15_000,
  });

  return { status: query.data ?? null, isLoading: query.isLoading };
}
