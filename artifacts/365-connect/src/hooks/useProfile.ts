import { useQuery } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

/* ── DB row shape (subset we select) ─────────────────────────────────────── */
type UserProfileRow = {
  username:       string | null;
  photo_url:      string | null;
  bio:            string | null;
  job_types:      string[];
  certifications: string[];
  rating:         number;
  created_at:     string;
  role:           'worker' | 'client' | 'admin' | 'staffer';
};

/* ── Display-name derivation ─────────────────────────────────────────────── */
//
// Priority order:
//   1. user_metadata.full_name  (Google / Apple OAuth)
//   2. user_metadata.name       (GitHub and other providers)
//   3. username from users table
//   4. email prefix (before the @)
//   5. 'User'                   (absolute fallback)
//
function deriveDisplayName(authUser: User, row: UserProfileRow | null): string {
  return (
    (authUser.user_metadata?.full_name as string | undefined)?.trim() ||
    (authUser.user_metadata?.name      as string | undefined)?.trim() ||
    row?.username?.trim() ||
    authUser.email?.split('@')[0] ||
    'User'
  );
}

/* ── Public hook shape ───────────────────────────────────────────────────── */
export type ProfileResult = {
  isLoading:      boolean;
  /** True when the Supabase fetch failed (network or RLS error). */
  isError:        boolean;
  displayName:    string;
  username:       string | null;
  photoUrl:       string | null;
  bio:            string | null;
  jobTypes:       string[];
  certifications: string[];
  /** Raw 0–5 numeric rating from the users table (0 until reviews exist). */
  rating:         number;
  memberSince:    string;   // e.g. "Jan 2026"
  email:          string | null;
  role:           UserProfileRow['role'] | null;
};

/* ── Hook ────────────────────────────────────────────────────────────────── */
export function useProfile(): ProfileResult {
  const { user, loading: authLoading } = useAuth();

  const { data: row, isLoading: rowLoading, isError } = useQuery<UserProfileRow | null>({
    queryKey: ['profile', user?.id ?? 'anon'],
    enabled:  !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('username, photo_url, bio, job_types, certifications, rating, created_at, role')
        .eq('id', user!.id)
        .maybeSingle();

      if (error) {
        console.error('[useProfile] fetch error:', error.message);
        return null;
      }
      return data as UserProfileRow | null;
    },
  });

  const isLoading = authLoading || (!!user && rowLoading);

  // Avatar: DB column first, then OAuth provider photo, then null (renders initials)
  const photoUrl =
    row?.photo_url ||
    (user?.user_metadata?.avatar_url as string | undefined) ||
    null;

  const displayName = user ? deriveDisplayName(user, row ?? null) : '';

  const memberSince = row?.created_at
    ? new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '';

  return {
    isLoading,
    isError: !authLoading && !!user && isError,
    displayName,
    username:       row?.username       ?? null,
    photoUrl,
    bio:            row?.bio            ?? null,
    jobTypes:       row?.job_types      ?? [],
    certifications: row?.certifications ?? [],
    rating:         row?.rating         ?? 0,
    memberSince,
    email:          user?.email         ?? null,
    role:           row?.role           ?? null,
  };
}
