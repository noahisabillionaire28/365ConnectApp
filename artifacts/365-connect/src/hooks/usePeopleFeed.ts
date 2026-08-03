import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

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
  distanceMiles: number;
  /** Derived from availability if present */
  availableToday: boolean;
};

/** @deprecated use WorkerPerson */
export type PeopleFeedUser = WorkerPerson;

export function usePeopleFeed(role?: string) {
  const { user } = useAuth();

  const query = useQuery<WorkerPerson[], Error>({
    queryKey: ['people-feed', role],
    queryFn: async () => {
      const params = role ? `?role=${encodeURIComponent(role)}` : '';
      const rows = await apiClient(user?.id ?? null).get<(WorkerPerson & {
        is_pro: boolean;
        primary_job_type: string | null;
        photo_url: string | null;
        availability?: Record<string, boolean> | null;
      })[]>(`/workers${params}`);
      const dayKey = ['sun','mon','tue','wed','thu','fri','sat'][new Date().getDay()];
      return rows.map((r) => ({
        ...r,
        photoUrl:       r.photo_url,
        isPro:          r.is_pro,
        primaryJobType: r.primary_job_type,
        distanceMiles:  0,
        availableToday: !!(r.availability?.[dayKey]),
      }));
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
