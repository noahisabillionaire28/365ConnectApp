/**
 * RoleContext — fetches the logged-in user's role from the `users` table
 * and makes it available app-wide via useRole().
 *
 * Must be rendered inside <AuthProvider>.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type UserRole = 'worker' | 'client' | 'staffer' | 'admin' | null;

type RoleContextType = {
  role: UserRole;
  roleLoading: boolean;
};

const RoleContext = createContext<RoleContextType>({ role: null, roleLoading: true });

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [role, setRole]               = useState<UserRole>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setRoleLoading(false);
      return;
    }
    setRoleLoading(true);
    supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setRole((data?.role as UserRole) ?? null);
        setRoleLoading(false);
      });
  }, [user?.id]);

  return (
    <RoleContext.Provider value={{ role, roleLoading }}>
      {children}
    </RoleContext.Provider>
  );
}

export const useRole = () => useContext(RoleContext);
