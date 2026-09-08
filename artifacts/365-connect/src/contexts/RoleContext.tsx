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
export type UserStatus = 'active' | 'suspended' | 'flagged' | null;

type RoleContextType = {
  role:        UserRole;
  /** Admin moderation status — 'suspended' means the account is banned. */
  status:      UserStatus;
  /** True when the account can access the admin panel (flag or legacy role). */
  isAdmin:     boolean;
  roleLoading: boolean;
  /** Re-queries the users table. Returns a Promise so callers can await it. */
  refetchRole: () => Promise<void>;
};

const RoleContext = createContext<RoleContextType>({
  role:        null,
  status:      null,
  isAdmin:     false,
  roleLoading: true,
  refetchRole: async () => {},
});

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user }                      = useAuth();
  const [role, setRole]               = useState<UserRole>(null);
  const [status, setStatus]           = useState<UserStatus>(null);
  const [isAdmin, setIsAdmin]         = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);

  const fetchRole = useCallback(async () => {
    if (!user) {
      setRole(null);
      setStatus(null);
      setIsAdmin(false);
      setRoleLoading(false);
      return;
    }
    setRoleLoading(true);
    try {
      const data = await apiClient(user.id).get<{
        role: string | null; status: string | null; is_admin?: boolean | null;
      }>('/users/me');
      setRole((data?.role as UserRole) ?? null);
      setStatus((data?.status as UserStatus) ?? 'active');
      setIsAdmin(data?.is_admin === true || data?.role === 'admin');
    } catch {
      setRole(null);
      setStatus(null);
      setIsAdmin(false);
    }
    setRoleLoading(false);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch on mount + whenever auth user changes
  useEffect(() => { fetchRole(); }, [fetchRole]);

  return (
    <RoleContext.Provider value={{ role, status, isAdmin, roleLoading, refetchRole: fetchRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export const useRole = () => useContext(RoleContext);
