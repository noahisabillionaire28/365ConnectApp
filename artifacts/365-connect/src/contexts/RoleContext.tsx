/**
 * RoleContext — fetches the logged-in user's role from the API
 * and makes it available app-wide via useRole().
 *
 * Must be rendered inside <AuthProvider>.
 * Exposes refetchRole() so RoleSelectScreen can force a re-read after
 * writing the new role to DB.
 *
 * Admin accounts additionally get a "preview role": the app renders as
 * worker / client / staffer of their choosing so an admin can view and use the
 * app in each role. The preview is a client-side override (persisted per
 * device); the backend treats admins as superusers so previewed actions work.
 */
import {
  createContext, useContext, useCallback, useEffect, useState, type ReactNode,
} from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';

export type UserRole = 'worker' | 'client' | 'staffer' | 'admin' | null;
export type UserStatus = 'active' | 'suspended' | 'flagged' | null;
export type PreviewRole = 'worker' | 'client' | 'staffer';

const PREVIEW_KEY = 'admin_preview_role';
const DEFAULT_PREVIEW: PreviewRole = 'client';

function readPreview(): PreviewRole {
  try {
    const v = localStorage.getItem(PREVIEW_KEY);
    if (v === 'worker' || v === 'client' || v === 'staffer') return v;
  } catch { /* ignore */ }
  return DEFAULT_PREVIEW;
}

type RoleContextType = {
  /** Effective role the app renders as. For admins this is the preview role. */
  role:        UserRole;
  /** The account's true role from the database (unaffected by preview). */
  realRole:    UserRole;
  /** Admin moderation status — 'suspended' means the account is banned. */
  status:      UserStatus;
  /** True when the account can access the admin panel (flag or legacy role). */
  isAdmin:     boolean;
  /** Which role an admin is currently viewing the app as. */
  previewRole: PreviewRole;
  /** Switch the admin preview role (persists on this device). */
  setPreviewRole: (r: PreviewRole) => void;
  roleLoading: boolean;
  /** Re-queries the users table. Returns a Promise so callers can await it. */
  refetchRole: () => Promise<void>;
};

const RoleContext = createContext<RoleContextType>({
  role:        null,
  realRole:    null,
  status:      null,
  isAdmin:     false,
  previewRole: DEFAULT_PREVIEW,
  setPreviewRole: () => {},
  roleLoading: true,
  refetchRole: async () => {},
});

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user }                      = useAuth();
  const [realRole, setRealRole]       = useState<UserRole>(null);
  const [status, setStatus]           = useState<UserStatus>(null);
  const [isAdmin, setIsAdmin]         = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);
  const [previewRole, setPreviewRoleState] = useState<PreviewRole>(readPreview);

  const setPreviewRole = useCallback((r: PreviewRole) => {
    setPreviewRoleState(r);
    try { localStorage.setItem(PREVIEW_KEY, r); } catch { /* ignore */ }
  }, []);

  const fetchRole = useCallback(async () => {
    if (!user) {
      setRealRole(null);
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
      setRealRole((data?.role as UserRole) ?? null);
      setStatus((data?.status as UserStatus) ?? 'active');
      setIsAdmin(data?.is_admin === true || data?.role === 'admin');
    } catch {
      setRealRole(null);
      setStatus(null);
      setIsAdmin(false);
    }
    setRoleLoading(false);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch on mount + whenever auth user changes
  useEffect(() => { fetchRole(); }, [fetchRole]);

  // Admins render the app as their chosen preview role; everyone else as-is.
  const role: UserRole = isAdmin ? previewRole : realRole;

  return (
    <RoleContext.Provider value={{
      role, realRole, status, isAdmin, previewRole, setPreviewRole, roleLoading, refetchRole: fetchRole,
    }}>
      {children}
    </RoleContext.Provider>
  );
}

export const useRole = () => useContext(RoleContext);
