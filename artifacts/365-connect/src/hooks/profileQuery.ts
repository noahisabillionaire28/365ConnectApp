/**
 * The signed-in user's own row (`GET /users/me`) as ONE react-query entry
 * shared by RoleContext, useProfile and useMyLocation, so the first paint
 * makes a single request for it instead of one per consumer.
 */
import { apiClient, isApiStatus } from '@/lib/api';

export type UserProfileRow = {
  username:            string | null;
  photo_url:           string | null;
  bio:                 string | null;
  job_types:           string[];
  certifications:      string[];
  rating:              number;
  created_at:          string;
  role:                'worker' | 'client' | 'admin' | 'staffer' | null;
  status?:             string | null;
  is_admin?:           boolean | null;
  primary_job_type:    string | null;
  secondary_job_types: string[];
  availability:        Record<string, boolean> | null;
  lat:                 number | null;
  lng:                 number | null;
  is_pro:              boolean;
  is_available:        boolean;
  hourly_rate:         number | null;
  company_name?:       string | null;
};

export const profileQueryKey = (userId: string | null | undefined) => ['profile', userId ?? 'anon'] as const;

/**
 * Query options for the own-profile row. A 404 ("no profile yet", i.e. the
 * account has not picked a role) resolves to null; any other failure throws
 * so callers can tell "no role" from "could not load".
 */
export function profileQueryOptions(userId: string | null | undefined) {
  return {
    queryKey:  profileQueryKey(userId),
    enabled:   !!userId,
    staleTime: 30_000,
    queryFn:   async (): Promise<UserProfileRow | null> => {
      try {
        return await apiClient(userId).get<UserProfileRow>('/users/me');
      } catch (e) {
        if (isApiStatus(e, 404)) return null;
        throw e;
      }
    },
  };
}
