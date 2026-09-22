import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useMyLocation } from './useMyLocation';

export type WorkerPerson = {
  id: string;
  username: string;
  photo_url: string | null;
  photoUrl: string | null;
  role: string;
  bio: string | null;
  rating: number;
  is_pro: boolean;
  isPro: boolean;
  job_types: string[];
  primary_job_type: string | null;
  primaryJobType: string | null;
  secondary_job_types: string[];
  certifications: string[];
  lat: number | null;
  lng: number | null;
  company_name: string | null;
  created_at: string;
  /** Miles from the viewer (server-computed); Infinity when either side has no location. */
  distanceMiles: number;
  /** The worker's weekly availability marks today, and they haven't paused offers. */
  availableToday: boolean;
  /** "Available for work" switch (offers paused when false). */
  isAvailable: boolean;
  /** Already on the viewer's roster. */
  isFollowed: boolean;
};

/** @deprecated use WorkerPerson */
export type PeopleFeedUser = WorkerPerson;

type ApiRow = Omit<WorkerPerson, 'photoUrl' | 'isPro' | 'primaryJobType' | 'distanceMiles' | 'availableToday' | 'isAvailable' | 'isFollowed'> & {
  availability?: Record<string, boolean> | null;
  is_available?: boolean;
  distance_miles?: number | null;
  is_followed?: boolean;
};

/**
 * The people directory. Defaults to workers only — clients and agencies are
 * never "browse-able" as staff. Distance is computed server-side from the
 * viewer's location.
 */
export function usePeopleFeed(role: string = 'worker') {
  const { user } = useAuth();
  const { coords } = useMyLocation();
  const lat = Math.round(coords.lat * 100) / 100;
  const lng = Math.round(coords.lng * 100) / 100;

  const query = useQuery<WorkerPerson[], Error>({
    queryKey: ['people-feed', role, user?.id ?? 'anon', lat, lng],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({ role, lat: String(lat), lng: String(lng) });
      const rows = await apiClient(user?.id ?? null).get<ApiRow[]>(`/workers?${params}`);
      const dayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()];
      return rows.map((r) => {
        const isAvailable = r.is_available !== false;
        return {
          ...r,
          photoUrl:       r.photo_url,
          isPro:          r.is_pro,
          primaryJobType: r.primary_job_type,
          distanceMiles:  typeof r.distance_miles === 'number' ? r.distance_miles : Infinity,
          availableToday: isAvailable && !!(r.availability?.[dayKey]),
          isAvailable,
          isFollowed:     !!r.is_followed,
        };
      });
    },
    staleTime: 60_000,
  });

  return {
    people:    query.data   ?? [],
    isLoading: query.isLoading,
    isError:   query.isError,
    error:     query.error,
    data:      query.data   ?? [],
  };
}
