/**
 * Offline-resilient query cache.
 *
 * The app's data (shifts, worker profiles, applications, payments, …) is fetched
 * from Supabase via React Query. By default that cache lives only in memory, so
 * a page reload — or a moment when Supabase/the network is unreachable — leaves
 * screens blank while they refetch. To make a backend blip "barely show", we
 * snapshot every successful query to the device (localStorage) and restore it on
 * launch: the user immediately sees the last-known data, and React Query quietly
 * refreshes it in the background when the backend is reachable again.
 *
 * Everything here is best-effort and wrapped in try/catch — a corrupt or full
 * store never breaks the app, it just means no cache that session.
 */
import { dehydrate, hydrate, type QueryClient } from '@tanstack/react-query';

const CACHE_KEY = '365connect:query-cache:v1';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // don't show data older than 24h

/** Restore the persisted cache into the client. Call once, before first render. */
export function restoreQueryCache(qc: QueryClient): void {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { savedAt?: number; state?: unknown };
    if (!parsed.savedAt || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(CACHE_KEY);
      return;
    }
    if (parsed.state) hydrate(qc, parsed.state);
  } catch {
    /* corrupt snapshot — ignore, start fresh */
  }
}

/** Subscribe to cache changes and persist successful queries (throttled). */
export function startQueryCachePersistence(qc: QueryClient): void {
  let timer: number | undefined;
  const save = () => {
    try {
      const state = dehydrate(qc, {
        shouldDehydrateQuery: (q) => q.state.status === 'success',
      });
      localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), state }));
    } catch {
      /* quota exceeded or unserialisable — skip this write */
    }
  };
  qc.getQueryCache().subscribe(() => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(save, 1000);
  });
}

/** Wipe the persisted cache — call on sign-out so the next user starts clean. */
export function clearQueryCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}
