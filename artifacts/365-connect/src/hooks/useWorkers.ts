import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/** Shape used by the Home screen story bubbles */
export type WorkerStory = {
  id:        string;
  username:  string;
  photoUrl:  string | null;
  isPremium: boolean;   // subscription system is a future phase — always false for now
};

export const WORKERS_QUERY_KEY = ['workers'] as const;

export function useWorkers() {
  const { data, isLoading, error } = useQuery({
    queryKey: WORKERS_QUERY_KEY,
    queryFn: async (): Promise<WorkerStory[]> => {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, photo_url')
        .eq('role', 'worker')
        .not('username', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id:        row.id,
        username:  row.username as string,
        photoUrl:  row.photo_url ?? null,
        isPremium: false,
      }));
    },
    staleTime: 60_000,
    gcTime:    120_000,
  });

  return { workers: data ?? [], isLoading, error };
}
