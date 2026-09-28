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
  createContext, useContext, useCallback, useState, type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { profileQueryOptions } from '@/hooks/profileQuery';

export type UserRole = 'worker' | 'client' | 'staffer' | 'admin' | null;
export type UserStatus = 'active' | 'suspended' | 'banned' | 'flagged' | null;

/** True when the account is locked out (the server refuses every other request with 403). */
export function isLockedStatus(status: UserStatus): boolean {
  return status === 'suspended' || status === 'banned';
}
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
  /** Admin moderation status — 'suspended' / 'banned' lock the account out. */
  status:      UserStatus;
  /** True when the account can access the admin panel (flag or legacy role). */
  isAdmin:     boolean;
  /** Which role an admin is currently viewing the app as. */
  previewRole: PreviewRole;
  /** Switch the admin preview role (persists on this device). */
  setPreviewRole: (r: PreviewRole) => void;
  roleLoading: boolean;
  /** True when the last profile read failed (network) — a null role then means "unknown", not "none". */
  roleError:   boolean;
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
  roleError:   false,
  refetchRole: async () => {},
});

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [previewRole, setPreviewRoleState] = useState<PreviewRole>(readPreview);

  const setPreviewRole = useCallback((r: PreviewRole) => {
    setPreviewRoleState(r);
    try { localStorage.setItem(PREVIEW_KEY, r); } catch { /* ignore */ }
  }, []);

  // The same cached entry useProfile / useMyLocation read — one GET /users/me
  // for the whole app. The key carries the user id, so a different account is
  // "unknown" (pending) until its own read finishes, never the previous
  // user's values. A 404 resolves to null (no role yet); a network / 5xx
  // failure is an error, i.e. "unknown", not "none".
  // Always re-read on app start (the on-device snapshot may be from an
  // earlier session), and stay "loading" until this session's read for THIS
  // user has finished — snapshot data is not treated as an answer. This
  // observer alone treats the entry as stale (staleTime 0) so the read also
  // runs when the key changes from "anon" to the signed-in user; the other
  // consumers keep their 30 s staleTime and share the one response.
  const query = useQuery({ ...profileQueryOptions(user?.id), staleTime: 0, refetchOnMount: 'always' });
  const data = user ? query.data : null;

  const realRole: UserRole   = (data?.role as UserRole) ?? null;
  const status:   UserStatus = data ? ((data.status as UserStatus) ?? 'active') : null;
  const isAdmin              = data?.is_admin === true || data?.role === 'admin';
  const roleError            = !!user && query.isError;
  const roleLoading          = !!user && (query.isPending || !query.isFetchedAfterMount);

  const fetchRole = useCallback(async () => {
    if (!user) return;
    await query.refetch();
  }, [user?.id, query.refetch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Admins render the app as their chosen preview role; everyone else as-is.
  const role: UserRole = isAdmin ? previewRole : realRole;

  return (
    <RoleContext.Provider value={{
      role, realRole, status, isAdmin, previewRole, setPreviewRole, roleLoading, roleError, refetchRole: fetchRole,
    }}>
      {children}
    </RoleContext.Provider>
  );
}

export const useRole = () => useContext(RoleContext);
