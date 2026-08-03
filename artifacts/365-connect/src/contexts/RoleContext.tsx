/**
 * RoleContext — fetches the logged-in user's role from the API
 * and makes it available app-wide via useRole().
 *
 * Must be rendered inside <AuthProvider>.
 * Exposes refetchRole() so RoleSelectScreen can force a re-read after
 * writing the new role to DB.
 */
import {
  createContext, useContext, useCallback, useEffect, useState, type ReactNode,
} from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';

export type UserRole = 'worker' | 'client' | 'staffer' | 'admin' | null;

type RoleContextType = {
  role:        UserRole;
  roleLoading: boolean;
  /** Re-queries the users table. Returns a Promise so callers can await it. */
  refetchRole: () => Promise<void>;
};

const RoleContext = createContext<RoleContextType>({
  role:        null,
  roleLoading: true,
  refetchRole: async () => {},
});

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user }                      = useAuth();
  const [role, setRole]               = useState<UserRole>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  const fetchRole = useCallback(async () => {
    if (!user) {
      setRole(null);
      setRoleLoading(false);
      return;
    }
    setRoleLoading(true);
    try {
      const data = await apiClient(user.id).get<{ role: string | null }>('/users/me');
      setRole((data?.role as UserRole) ?? null);
    } catch {
      setRole(null);
    }
    setRoleLoading(false);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch on mount + whenever auth user changes
  useEffect(() => { fetchRole(); }, [fetchRole]);

  return (
    <RoleContext.Provider value={{ role, roleLoading, refetchRole: fetchRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export const useRole = () => useContext(RoleContext);
