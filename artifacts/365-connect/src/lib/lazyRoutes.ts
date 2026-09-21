/**
 * Route-level code splitting with background warming.
 *
 * Each screen is its own chunk. `lazyNamed` wraps React.lazy for named
 * exports and remembers the loader, so `warmRoutes()` can fetch every screen
 * quietly after the app has painted. Once a chunk is loaded React.lazy renders
 * it synchronously, so switching tabs never shows the Suspense fallback.
 */
import { lazy, type ComponentType } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = ComponentType<any>;
type Loader = () => Promise<unknown>;

const loaders = new Map<string, Loader>();
const loaded = new Set<string>();

export function lazyNamed<M extends Record<string, unknown>>(loader: () => Promise<M>, name: keyof M & string) {
  const load = () => loader().then((m) => { loaded.add(name); return m; });
  loaders.set(name, load);
  return lazy<AnyComponent>(async () => ({ default: (await load())[name] as AnyComponent }));
}

/** Fetch one screen's chunk ahead of time (no-op if already loaded). */
export function preloadScreen(name: string): void {
  if (loaded.has(name)) return;
  void loaders.get(name)?.().catch(() => { /* network hiccup — the route will retry on open */ });
}

/** Screens reachable from the tab bar and the most common next taps: warm these first. */
const PRIORITY = [
  'JobsScreen', 'ExploreScreen', 'MessagesScreen', 'ProfileScreen', 'NotificationsScreen',
  'PostShiftNameScreen', 'ShiftDetailScreen', 'ChatScreen', 'RosterScreen', 'WorkerProfileScreen',
];

let warming = false;

/**
 * Load every registered screen in the background, priority screens first,
 * one at a time so it never competes with the screen the user is looking at.
 */
export function warmRoutes(): void {
  if (warming) return;
  warming = true;

  const queue = [...PRIORITY.filter((n) => loaders.has(n)), ...[...loaders.keys()].filter((n) => !PRIORITY.includes(n))];

  const idle = (cb: () => void) => {
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(cb, { timeout: 1500 });
    else window.setTimeout(cb, 200);
  };

  const next = () => {
    const name = queue.shift();
    if (!name) return;
    if (loaded.has(name)) { next(); return; }
    loaders.get(name)!()
      .catch(() => { /* ignore — the route itself will retry */ })
      .finally(() => idle(next));
  };

  // Let the first screen finish painting and fetching before we start.
  window.setTimeout(() => idle(next), 600);
}
