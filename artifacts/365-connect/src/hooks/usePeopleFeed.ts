import { useQuery } from '@tanstack/react-query';
import { supabase, haversineMiles, MIAMI_BEACH } from '@/lib/supabase';
import { useMyLocation } from './useMyLocation';

export type WorkerPerson = {
  id: string;
  username: string;
  photoUrl: string | null;
  primaryJobType: string | null;
  secondaryJobTypes: string[];
  rating: number;
  isPro: boolean;
  distanceMiles: number;
  availableToday: boolean;
};

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

type WorkerRow = {
  id: string;
  username: string | null;
  photo_url: string | null;
  primary_job_type: string | null;
  secondary_job_types: string[] | null;
  rating: number | null;
  is_pro: boolean | null;
  lat: number | null;
  lng: number | null;
  availability: Record<string, boolean> | null;
};

/**
 * Fetches all worker profiles for the Client/Staffer Home Feed (spec B) and
 * the Explore grid (spec C). Distance is computed against the viewer's own
 * location, resolved via `useMyLocation`.
 */
export function usePeopleFeed() {
  const { coords, loading: locLoading } = useMyLocation();

  const query = useQuery<WorkerPerson[], Error>({
    queryKey: ['people-feed'],
    queryFn: async () => {
      const todayKey = DAY_KEYS[new Date().getDay()];
      const { data, error } = await supabase
        .from('users')
        .select(
          'id, username, photo_url, primary_job_type, secondary_job_types, rating, is_pro, lat, lng, availability',
        )
        .eq('role', 'worker')
        .not('username', 'is', null)
        .order('created_at', { ascending: false });

      if (error) {
        // Phase 4 columns missing → degrade gracefully to base columns.
        if (error.code === '42703') {
          const fallback = await supabase
            .from('users')
            .select('id, username, photo_url, rating')
            .eq('role', 'worker')
            .not('username', 'is', null);
          if (fallback.error) throw fallback.error;
          return (fallback.data ?? []).map((row): WorkerPerson => ({
            id: row.id,
            username: row.username as string,
            photoUrl: null,
            primaryJobType: null,
            secondaryJobTypes: [],
            rating: row.rating ?? 0,
            isPro: false,
            distanceMiles: 0,
            availableToday: false,
          }));
        }
        throw error;
      }

      return (data as WorkerRow[]).map((row): WorkerPerson => ({
        id: row.id,
        username: row.username as string,
        photoUrl: row.photo_url,
        primaryJobType: row.primary_job_type,
        secondaryJobTypes: row.secondary_job_types ?? [],
        rating: row.rating ?? 0,
        isPro: row.is_pro ?? false,
        distanceMiles:
          Math.round(
            haversineMiles(
              coords.lat, coords.lng,
              row.lat ?? MIAMI_BEACH.lat, row.lng ?? MIAMI_BEACH.lng,
            ) * 10,
          ) / 10,
        availableToday: !!row.availability?.[todayKey],
      }));
    },
    staleTime: 30_000,
    enabled: !locLoading,
  });

  return { people: query.data ?? [], isLoading: query.isLoading || locLoading, error: query.error };
}
