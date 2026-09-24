/**
 * Short-lived in-memory cache of users.role / users.is_admin / users.status,
 * so role-gated routes don't hit the database on every request. Entries live
 * 60 seconds and are dropped immediately when this process changes a user's
 * role or moderation status.
 */
import { adminDb } from './supabaseAdmin.js';

export type RoleInfo = {
  role: string | null;
  isAdmin: boolean;
  /** Moderation status: 'active' | 'suspended' | 'banned' | 'flagged' | null. */
  status: string | null;
  /** True when the account is suspended or banned and must not use the API. */
  isSuspended: boolean;
};

/** Statuses that lock an account out of every authenticated route. */
const LOCKED_STATUSES = new Set(['suspended', 'banned']);

const TTL_MS = 60_000;
const MAX_ENTRIES = 5_000;
const cache = new Map<string, { value: RoleInfo; expires: number }>();

export async function getRoleInfo(userId: string): Promise<RoleInfo> {
  const hit = cache.get(userId);
  if (hit && hit.expires > Date.now()) return hit.value;

  const { data } = await adminDb
    .from('users')
    .select('role, is_admin, status, is_banned')
    .eq('id', userId)
    .maybeSingle();
  const role = (data?.role as string | undefined) ?? null;
  const status = (data?.status as string | undefined) ?? null;
  const isAdmin = role === 'admin' || data?.is_admin === true;
  const value: RoleInfo = {
    role,
    isAdmin,
    status,
    // Admins are never locked out of their own panel.
    isSuspended: !isAdmin && (LOCKED_STATUSES.has(status ?? '') || data?.is_banned === true),
  };

  // Only cache real rows; a user mid-onboarding gets a row moments later and
  // must not be stuck as "no role" for a minute.
  if (data) {
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
    cache.set(userId, { value, expires: Date.now() + TTL_MS });
  }
  return value;
}

export function invalidateRole(userId: string): void {
  cache.delete(userId);
}
