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
 * Two safety rules keep a snapshot from ever poisoning the app:
 *   1. The snapshot is tagged with the build it was written by. A new deploy can
 *      change the shape of cached objects (new fields the UI now relies on), so
 *      a snapshot from another build is discarded rather than hydrated.
 *   2. Each query is aged individually by its own `dataUpdatedAt`. The old
 *      snapshot-level timestamp was refreshed on every write, so a months-old
 *      entry could live forever as long as the app kept being used.
 *
 * Everything here is best-effort and wrapped in try/catch — a corrupt or full
 * store never breaks the app, it just means no cache that session.
 */
import { dehydrate, hydrate, type QueryClient } from '@tanstack/react-query';

const CACHE_KEY = '365connect:query-cache:v2';
const LEGACY_KEYS = ['365connect:query-cache:v1'];
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // don't show data older than 24h

/** Identifies the deployed build; injected by Vite (see vite.config.ts). */
const BUILD_ID: string = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';

type PersistedQuery = { state?: { dataUpdatedAt?: number; status?: string } };
type Snapshot = {
  savedAt?: number;
  buildId?: string;
  state?: { queries?: PersistedQuery[]; mutations?: unknown[] };
};

/** Restore the persisted cache into the client. Call once, before first render. */
export function restoreQueryCache(qc: QueryClient): void {
  try {
    // Snapshots written by older builds used a different key — drop them.
    for (const k of LEGACY_KEYS) localStorage.removeItem(k);

    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Snapshot;

    if (parsed.buildId !== BUILD_ID || !parsed.state?.queries) {
      localStorage.removeItem(CACHE_KEY);
      return;
    }

    const cutoff = Date.now() - MAX_AGE_MS;
    const fresh = parsed.state.queries.filter((q) => {
      const at = q.state?.dataUpdatedAt ?? 0;
      return q.state?.status === 'success' && at > cutoff;
    });
    if (fresh.length === 0) {
      localStorage.removeItem(CACHE_KEY);
      return;
    }
    hydrate(qc, { queries: fresh, mutations: [] } as Parameters<typeof hydrate>[1]);
  } catch {
    /* corrupt snapshot — ignore, start fresh */
    try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
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
      const snapshot: Snapshot = { savedAt: Date.now(), buildId: BUILD_ID, state };
      localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
    } catch {
      /* quota exceeded or unserialisable — skip this write */
    }
  };
  qc.getQueryCache().subscribe(() => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(save, 1000);
  });
}

/**
 * Wipe the persisted cache — on sign-out so the next user starts clean, and
 * from the error boundary so a bad snapshot can't crash the app twice.
 */
export function clearQueryCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
    for (const k of LEGACY_KEYS) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}
