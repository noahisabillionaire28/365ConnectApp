import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth, type SimpleUser } from '@/contexts/AuthContext';

type UserProfileRow = {
  username:            string | null;
  photo_url:           string | null;
  bio:                 string | null;
  job_types:           string[];
  certifications:      string[];
  rating:              number;
  created_at:          string;
  role:                'worker' | 'client' | 'admin' | 'staffer';
  primary_job_type:    string | null;
  secondary_job_types: string[];
  availability:        Record<string, boolean> | null;
  lat:                 number | null;
  lng:                 number | null;
  is_pro:              boolean;
  is_available:        boolean;
};

function deriveDisplayName(authUser: SimpleUser, row: UserProfileRow | null): string {
  return (
    row?.username?.trim() ||
    authUser.email?.split('@')[0] ||
    'User'
  );
}

export type ProfileResult = {
  isLoading:         boolean;
  isError:           boolean;
  displayName:       string;
  username:          string | null;
  photoUrl:          string | null;
  bio:               string | null;
  jobTypes:          string[];
  certifications:    string[];
  rating:            number;
  memberSince:       string;
  email:             string | null;
  role:              UserProfileRow['role'] | null;
  primaryJobType:    string | null;
  secondaryJobTypes: string[];
  availability:      Record<string, boolean> | null;
  lat:               number | null;
  lng:               number | null;
  isPro:             boolean;
  isAvailable:       boolean;
};

export function useProfile(): ProfileResult {
  const { user, loading: authLoading } = useAuth();

  const { data: row, isLoading: rowLoading, isError } = useQuery<UserProfileRow | null>({
    queryKey: ['profile', user?.id ?? 'anon'],
    enabled:  !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      try {
        return await apiClient(user?.id).get<UserProfileRow>('/users/me');
      } catch {
        return null;
      }
    },
  });

  const isLoading = authLoading || (!!user && rowLoading);

  // Prefer the user's uploaded photo; fall back to their Clerk profile picture
  // (set during Google/social sign-up) so the avatar is never blank.
  const photoUrl =
    row?.photo_url ||
    user?.imageUrl ||
    null;

  const displayName = user ? deriveDisplayName(user, row ?? null) : '';

  const memberSince = row?.created_at
    ? new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '';

  return {
    isLoading,
    isError: !authLoading && !!user && isError,
    displayName,
    username:          row?.username          ?? null,
    photoUrl,
    bio:               row?.bio               ?? null,
    jobTypes:          row?.job_types         ?? [],
    certifications:    row?.certifications    ?? [],
    rating:            row?.rating            ?? 0,
    memberSince,
    email:             user?.email            ?? null,
    role:              row?.role              ?? null,
    primaryJobType:    row?.primary_job_type  ?? null,
    secondaryJobTypes: row?.secondary_job_types ?? [],
    availability:      row?.availability      ?? null,
    lat:               row?.lat               ?? null,
    lng:               row?.lng               ?? null,
    isPro:             row?.is_pro            ?? false,
    isAvailable:       row?.is_available      ?? true,
  };
}
