import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth, type SimpleUser } from '@/contexts/AuthContext';
import { useRole } from '@/contexts/RoleContext';

type UserProfileRow = {
  username:            string | null;
  photo_url:           string | null;
  bio:                 string | null;
  job_types:           string[];
  certifications:      string[];
  rating:              number;
  created_at:          string;
  role:                'worker' | 'client' | 'admin' | 'staffer';
  is_admin?:           boolean | null;
  primary_job_type:    string | null;
  secondary_job_types: string[];
  availability:        Record<string, boolean> | null;
  lat:                 number | null;
  lng:                 number | null;
  is_pro:              boolean;
  is_available:        boolean;
  hourly_rate:         number | null;
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
  /** Effective role — for admins this follows the in-app "view as" switcher. */
  role:              UserProfileRow['role'] | null;
  /** True for admin-capable accounts, regardless of the preview role. */
  isAdmin:           boolean;
  primaryJobType:    string | null;
  secondaryJobTypes: string[];
  availability:      Record<string, boolean> | null;
  lat:               number | null;
  lng:               number | null;
  isPro:             boolean;
  isAvailable:       boolean;
  hourlyRate:        number | null;
};

export function useProfile(): ProfileResult {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin: ctxIsAdmin, previewRole } = useRole();

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

  // Admin is both a DB fact and a context signal (context reflects the flag too).
  const isAdmin = ctxIsAdmin || row?.role === 'admin' || row?.is_admin === true;
  // Admins render the app as their chosen preview role so screens behave like a
  // normal worker/client/staffer; everyone else uses their real role.
  const effectiveRole = isAdmin ? previewRole : (row?.role ?? null);

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
    role:              effectiveRole,
    isAdmin,
    primaryJobType:    row?.primary_job_type  ?? null,
    secondaryJobTypes: row?.secondary_job_types ?? [],
    availability:      row?.availability      ?? null,
    lat:               row?.lat               ?? null,
    lng:               row?.lng               ?? null,
    isPro:             row?.is_pro            ?? false,
    isAvailable:       row?.is_available      ?? true,
    hourlyRate:        row?.hourly_rate       ?? null,
  };
}
