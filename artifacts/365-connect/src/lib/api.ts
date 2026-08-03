/**
 * Unified API client for all data operations.
 * Calls /api/* on the api-server (proxied by Replit).
 *
 * Auth: Clerk session cookies are sent automatically (credentials: 'include').
 * x-user-id header is kept as a fallback for seed scripts and admin tooling.
 */

const BASE = '/api';

function makeHeaders(userId: string | null | undefined): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (userId) h['x-user-id'] = userId;
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
    headers: makeHeaders(userId),
    credentials: 'include',          // send Clerk session cookie on every request
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
