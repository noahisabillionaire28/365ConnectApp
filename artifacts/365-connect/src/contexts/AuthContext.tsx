/**
 * AuthContext — Supabase Auth.
 *
 * Exposes the same { user, loading, signOut } shape that all existing screens
 * already depend on, so no page changes are needed. Identity now comes from
 * Supabase Auth instead of Clerk.
 */
import {
  createContext, useContext, useEffect, useState, type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
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

function toSimpleUser(session: Session | null): SimpleUser | null {
  const u = session?.user;
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const imageUrl =
    (meta.avatar_url as string | undefined) ??
    (meta.picture as string | undefined) ??
    undefined;
  return {
    id:       u.id,
    email:    u.email ?? undefined,
    imageUrl,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<SimpleUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // Initial session (from persisted storage).
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(toSimpleUser(data.session));
      setLoading(false);
    });

    // React to sign-in / sign-out / token-refresh.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(toSimpleUser(session));
      setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Keep the feed store hydrated whenever auth state settles.
  useEffect(() => {
    if (loading) return;
    if (user) {
      hydrateForUser(user.id);
    } else {
      clearUser();
    }
  }, [user?.id, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
