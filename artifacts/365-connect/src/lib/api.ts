/**
 * Unified API client for all data operations.
 * Calls /api/* on the api-server (proxied same-origin in production).
 *
 * Auth: the caller's Supabase session access token is attached as a Bearer
 * header (and X-Supabase-Token as a proxy-safe fallback). The API server
 * verifies the token and derives identity from it.
 */
import { supabase, getCachedAccessToken } from '@/lib/supabase';

const BASE = '/api';

/**
 * Resolve the current Supabase access token, or null if signed out.
 *
 * Fast path: read the module-level cache (kept fresh by onAuthStateChange),
 * so the common case is synchronous and never touches the auth lock. Only when
 * the cache is empty (e.g. a request that races the very first auth event) do
 * we fall back to getSession() — and even then we time out fast rather than let
 * the request hang on supabase-js's navigator-lock.
 */
async function getAccessToken(): Promise<string | null> {
  const cached = getCachedAccessToken();
  if (cached) return cached;
  try {
    return await Promise.race<string | null>([
      supabase.auth.getSession().then(({ data }) => data.session?.access_token ?? null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
    ]);
  } catch {
    return null;
  }
}

async function makeHeaders(
  userId: string | null | undefined,
): Promise<Record<string, string>> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (userId) h['x-user-id'] = userId;
  const token = await getAccessToken();
  if (token) {
    h['Authorization'] = `Bearer ${token}`;
    // Some proxies strip Authorization; a custom header is forwarded reliably.
    h['X-Supabase-Token'] = token;
  }
  return h;
}

async function request<T>(
  method: string,
  path: string,
  userId: string | null | undefined,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: await makeHeaders(userId),
    credentials: 'include',
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(err.error ?? `API ${method} ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function apiClient(userId: string | null | undefined) {
  return {
    get:    <T>(path: string)                  => request<T>('GET',    path, userId),
    post:   <T>(path: string, body: unknown)   => request<T>('POST',   path, userId, body),
    patch:  <T>(path: string, body: unknown)   => request<T>('PATCH',  path, userId, body),
    delete: <T>(path: string)                  => request<T>('DELETE', path, userId),
  };
}
