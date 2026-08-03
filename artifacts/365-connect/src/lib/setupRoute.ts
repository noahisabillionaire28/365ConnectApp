/**
 * Resolves the correct next route for a logged-in user based on their
 * profile data.
 */
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
    if (!profile.username)     return '/worker-setup';
    if (!profile.availability) return '/worker-setup';
    // First post is optional — username + availability is enough to complete setup
    return '/home';
  }

  if (profile.role === 'client')  return profile.username ? '/home' : '/client-setup';
  if (profile.role === 'staffer') return profile.username ? '/home' : '/staffer-setup';
  return '/home';
}
