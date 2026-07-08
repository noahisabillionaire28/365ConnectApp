/**
 * Resolves the correct next route for a logged-in user based on their
 * profile data.  For workers, performs an extra posts-table check to ensure
 * step 8 (first post) has been completed.
 */
import { supabase } from './supabase';

/** True once the worker has inserted at least one post (setup step 8). */
export async function hasCompletedFirstPost(userId: string): Promise<boolean> {
  const { count } = await supabase
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  return !!count && count > 0;
}

export async function resolveSetupRoute(
  userId: string,
  profile: {
    role?: string | null;
    username?: string | null;
    availability?: unknown;
  } | null,
): Promise<string> {
  if (!profile?.role) return '/role-select';
  if (profile.role === 'admin') return '/admin/dashboard';

  if (profile.role === 'worker') {
    if (!profile.username)    return '/worker-setup';
    if (!profile.availability) return '/worker-setup';
    // Step 8 (first post) is also required — check posts table
    if (!(await hasCompletedFirstPost(userId))) return '/worker-setup';
    return '/home';
  }

  if (profile.role === 'client')  return profile.username ? '/home' : '/client-setup';
  if (profile.role === 'staffer') return profile.username ? '/home' : '/staffer-setup';
  return '/home';
}
