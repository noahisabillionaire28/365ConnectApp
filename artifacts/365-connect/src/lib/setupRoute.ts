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
    /** Display name (client) / agency name (staffer) — written by setup step 1. */
    bio?: string | null;
    company_name?: string | null;
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

  // Posters are set up once they have a name to show on their shifts. The
  // username is auto-generated at role select, so it cannot be the marker.
  const named = !!(profile.company_name || profile.bio);
  if (profile.role === 'client')  return named ? '/home' : '/client-setup';
  if (profile.role === 'staffer') return named ? '/home' : '/staffer-setup';
  return '/home';
}

/** Whether a poster (client/staffer) has completed the one-time setup. */
export function posterSetupDone(profile: { bio?: string | null; company_name?: string | null } | null | undefined): boolean {
  return !!(profile?.company_name || profile?.bio);
}
