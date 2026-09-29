import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth, type SimpleUser } from '@/contexts/AuthContext';
import { useRole } from '@/contexts/RoleContext';
import { apiClient } from '@/lib/api';
import { profileQueryKey, profileQueryOptions, type UserProfileRow } from './profileQuery';

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
  role:              NonNullable<UserProfileRow['role']> | null;
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
  companyName:       string | null;
};

export function useProfile(): ProfileResult {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin: ctxIsAdmin, previewRole } = useRole();

  // Same entry RoleContext and useMyLocation read: one request per session.
  const { data: row, isLoading: rowLoading, isError } = useQuery(profileQueryOptions(user?.id));

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
    rating:            Number(row?.rating ?? 0) || 0,
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
    companyName:       row?.company_name      ?? null,
  };
}

/** The columns PATCH /users/me accepts from the profile editors. */
export type ProfilePatch = Partial<Pick<UserProfileRow,
  'username' | 'photo_url' | 'bio' | 'job_types' | 'certifications' |
  'primary_job_type' | 'secondary_job_types' | 'availability' |
  'lat' | 'lng' | 'company_name' | 'is_available' | 'hourly_rate'
>>;

/**
 * One PATCH /users/me for everything that edits the signed-in user's row.
 * The cached profile is updated optimistically (so a tapped availability
 * chip flips at once), rolled back if the server refuses, and replaced by
 * the server's row on success. Screens that show the user's name or photo
 * elsewhere (people feed, posts, conversations, worker lists) are refreshed.
 */
export function useUpdateProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = profileQueryKey(user?.id);

  return useMutation<UserProfileRow, Error, ProfilePatch, { previous: UserProfileRow | null | undefined }>({
    mutationFn: (patch) => apiClient(user?.id).patch<UserProfileRow>('/users/me', patch),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<UserProfileRow | null>(key);
      if (previous) qc.setQueryData<UserProfileRow>(key, { ...previous, ...patch });
      return { previous };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(key, ctx.previous);
    },
    onSuccess: (row) => {
      qc.setQueryData<UserProfileRow>(key, (prev) => ({ ...(prev ?? {}), ...row } as UserProfileRow));
      for (const k of ['people-feed', 'posts', 'feed', 'conversations', 'workers', 'roster']) {
        void qc.invalidateQueries({ queryKey: [k] });
      }
    },
  });
}
