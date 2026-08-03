/**
 * AuthContext — Task #21 Clerk shim.
 *
 * Wraps Clerk's useUser/useClerk and exposes the same { user, loading, signOut }
 * shape that all existing screens already depend on, so no page changes are needed.
 */
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useUser, useClerk } from '@clerk/react';
import { hydrateForUser, clearUser } from '@/store/feedStore';

export type SimpleUser = {
  id:       string;
  email:    string | undefined;
  imageUrl: string | undefined;
};

type AuthContextType = {
  user:    SimpleUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user:    null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: clerkUser, isLoaded } = useUser();
  const { signOut: clerkSignOut }     = useClerk();

  const user: SimpleUser | null = clerkUser
    ? {
        id:       clerkUser.id,
        email:    clerkUser.primaryEmailAddress?.emailAddress,
        imageUrl: clerkUser.imageUrl ?? undefined,
      }
    : null;

  // Keep the feed store hydrated whenever auth state changes
  useEffect(() => {
    if (!isLoaded) return;
    if (user) {
      hydrateForUser(user.id);
    } else {
      clearUser();
    }
  }, [user?.id, isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = async () => {
    await clerkSignOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading: !isLoaded, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
