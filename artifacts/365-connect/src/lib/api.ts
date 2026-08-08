/**
 * Unified API client for all data operations.
 * Calls /api/* on the api-server (proxied by Replit).
 *
 * Auth: Clerk session cookies are sent automatically (credentials: 'include').
 * x-user-id header is kept as a fallback for seed scripts and admin tooling.
 */

const BASE = '/api';

/**
 * Resolve the current Clerk session token so it can be sent as a Bearer header.
 * The backend and frontend run on different origins (the backend is proxied
 * under /api), so cookie-based Clerk auth is unreliable — especially on Clerk
 * development instances. A Bearer token is verified networklessly by the API
 * server's Clerk middleware and works cross-origin. Returns null if Clerk isn't
 * ready or there's no active session.
 */
async function getClerkToken(): Promise<string | null> {
  try {
    const clerk = (globalThis as { Clerk?: { session?: { getToken?: () => Promise<string | null> } } }).Clerk;
    return (await clerk?.session?.getToken?.()) ?? null;
  } catch {
    return null;
  }
}

async function makeHeaders(userId: string | null | undefined): Promise<Record<string, string>> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (userId) h['x-user-id'] = userId;
  const token = await getClerkToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
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
    credentials: 'include',          // still send the Clerk session cookie when available
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
