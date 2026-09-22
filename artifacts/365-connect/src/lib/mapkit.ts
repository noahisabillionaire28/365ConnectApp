/**
 * Apple MapKit JS loader + map-provider detection.
 *
 * The real Apple Maps needs a signed token from our API (which needs an Apple
 * Maps key on the server). The first map on a page asks `/api/maps/token`
 * once; if the key is configured we load MapKit JS from Apple's CDN and every
 * map in the app renders with Apple tiles. If not, maps use the built-in
 * Apple-styled fallback. The decision is remembered for the browser tab.
 */
import { apiClient } from '@/lib/api';

export type MapProvider = 'apple' | 'fallback';

const MAPKIT_SRC = 'https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js';
const STORAGE_KEY = 'mapProvider';

type TokenResponse = { configured: boolean; token?: string; expiresAt?: number };

let firstToken: string | null = null;
let providerPromise: Promise<MapProvider> | null = null;
let readyPromise: Promise<boolean> | null = null;

/** A remembered decision goes stale after an hour, so adding the key later is picked up. */
const REMEMBER_MS = 60 * 60_000;

/** Synchronous answer when this tab already decided; null while unknown. */
export function knownMapProvider(): MapProvider | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { p, at } = JSON.parse(raw) as { p?: string; at?: number };
    if ((p === 'apple' || p === 'fallback') && typeof at === 'number' && Date.now() - at < REMEMBER_MS) return p;
  } catch { /* storage unavailable or old format */ }
  return null;
}

function remember(p: MapProvider) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ p, at: Date.now() })); } catch { /* ignore */ }
}

async function fetchToken(): Promise<string | null> {
  try {
    const r = await apiClient(null).get<TokenResponse>('/maps/token');
    return r.configured && r.token ? r.token : null;
  } catch {
    return null;
  }
}

/** Which map engine to use. Cached per tab; only the first call hits the API. */
export function detectMapProvider(): Promise<MapProvider> {
  if (providerPromise) return providerPromise;
  const known = knownMapProvider();
  if (known === 'fallback') return (providerPromise = Promise.resolve('fallback'));
  providerPromise = fetchToken().then((token) => {
    if (!token) { remember('fallback'); return 'fallback'; }
    firstToken = token;
    remember('apple');
    return 'apple';
  });
  return providerPromise;
}

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.mapkit) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${MAPKIT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('MapKit failed to load')));
      return;
    }
    const s = document.createElement('script');
    s.src = MAPKIT_SRC;
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('MapKit failed to load'));
    document.head.appendChild(s);
  });
}

/**
 * Load MapKit JS and initialise it with our token endpoint.
 * Resolves true when `window.mapkit` is ready to create maps.
 */
export function ensureMapKit(): Promise<boolean> {
  if (readyPromise) return readyPromise;
  readyPromise = (async () => {
    try {
      const provider = await detectMapProvider();
      if (provider !== 'apple') return false;
      await loadScript();
      const mk = window.mapkit;
      if (!mk) return false;
      mk.init({
        authorizationCallback: (done: (token: string) => void) => {
          const t = firstToken;
          firstToken = null; // use the token we already have once, then refresh
          if (t) return done(t);
          void fetchToken().then((tok) => { if (tok) done(tok); });
        },
        language: 'en',
      });
      return true;
    } catch {
      return false;
    }
  })();
  return readyPromise;
}

/** Minimal MapKit JS surface we use (the library has no bundled types). */
declare global {
  // eslint-disable-next-line no-var
  var mapkit: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  interface Window { mapkit: any } // eslint-disable-line @typescript-eslint/no-explicit-any
}
