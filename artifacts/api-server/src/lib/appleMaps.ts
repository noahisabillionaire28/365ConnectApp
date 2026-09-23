/**
 * Apple MapKit JS — server-side token minting.
 *
 * MapKit JS (the real Apple Maps in a browser) needs a short-lived JWT signed
 * with a "Maps ID" key from the Apple Developer portal. The browser never sees
 * the private key: it asks this API for a token and MapKit refreshes it itself.
 *
 * Environment variables on the API server:
 *   APPLE_MAPS_KEY_ID  — the 10-character key id of the MapKit JS key
 *   APPLE_MAPS_KEY     — the .p8 file contents (PEM), newlines may be "\n"-escaped
 *   APPLE_TEAM_ID      — your Apple team id (falls back to APNS_TEAM_ID)
 *   APPLE_MAPS_ORIGIN  — optional comma-separated allow-list of web origins
 *                        (e.g. https://365-connect-app.vercel.app). When set, a
 *                        token is only minted for those origins.
 *
 * When the key is missing the app falls back to the built-in map style.
 */
import { SignJWT, importPKCS8 } from 'jose';

const KEY_ID  = process.env['APPLE_MAPS_KEY_ID'] ?? '';
const KEY_PEM = (process.env['APPLE_MAPS_KEY'] ?? '').replace(/\\n/g, '\n');
const TEAM_ID = process.env['APPLE_TEAM_ID'] || process.env['APNS_TEAM_ID'] || '';
const ORIGINS = (process.env['APPLE_MAPS_ORIGIN'] ?? '')
  .split(',').map((s) => s.trim()).filter(Boolean);

/** Tokens live 30 minutes; MapKit asks for a new one before expiry. */
export const MAPS_TOKEN_TTL_SECONDS = 30 * 60;

export function mapsConfigured(): boolean {
  return !!(KEY_ID && KEY_PEM && TEAM_ID);
}

/** Whether a browser origin may receive a token (open when no allow-list is set). */
export function originAllowed(origin: string | undefined): boolean {
  if (ORIGINS.length === 0) return true;
  return !!origin && ORIGINS.includes(origin);
}

let keyPromise: Promise<CryptoKey> | null = null;

/** Mint a MapKit JS token, optionally pinned to the requesting origin. */
export async function mapsToken(origin?: string): Promise<{ token: string; expiresAt: number }> {
  if (!mapsConfigured()) throw new Error('Apple Maps is not configured');
  keyPromise ??= importPKCS8(KEY_PEM, 'ES256');
  const key = await keyPromise;
  const now = Math.floor(Date.now() / 1000);
  const exp = now + MAPS_TOKEN_TTL_SECONDS;
  const claims: Record<string, string> = {};
  if (origin) claims['origin'] = origin;
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })
    .setIssuer(TEAM_ID)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(key);
  return { token, expiresAt: exp * 1000 };
}
