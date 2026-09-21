/**
 * Local verification of Supabase access tokens.
 *
 * Every API request used to round-trip to Supabase Auth (`auth.getUser`) just
 * to learn who the caller is. That adds a network hop to every call. Supabase
 * access tokens are ordinary JWTs, so we can verify them in-process:
 *
 *   - Projects on asymmetric signing keys (ES256/RS256, the current default)
 *     publish their public keys at /auth/v1/.well-known/jwks.json. We fetch
 *     that once and cache it; nothing to configure.
 *   - Projects still on the legacy shared secret (HS256) need
 *     SUPABASE_JWT_SECRET in the environment.
 *   - If neither applies we fall back to the remote check so nothing breaks.
 *
 * The token's `sub` is the user id. Revocation: a signed-out token stays valid
 * until it expires (Supabase access tokens live one hour by default), which is
 * the same trade-off Supabase's own PostgREST/RLS layer makes.
 */
import { createRemoteJWKSet, jwtVerify, decodeProtectedHeader, type JWTPayload } from 'jose';
import { logger } from './logger.js';

const supabaseUrl = (process.env['VITE_SUPABASE_URL'] ?? '').replace(/\/+$/, '');
const jwtSecret   = process.env['SUPABASE_JWT_SECRET'] ?? '';

export type VerifyMode = 'jwks' | 'secret' | 'remote';
export type VerifyResult =
  | { ok: true; userId: string; mode: VerifyMode }
  | { ok: false; reason: string; mode: VerifyMode }
  | { ok: null; mode: 'remote' }; // cannot verify locally — caller must use the remote check

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!jwks && supabaseUrl) {
    jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`), {
      cooldownDuration: 30_000,          // don't hammer the endpoint on unknown kids
      cacheMaxAge:      10 * 60 * 1000,  // refresh keys every 10 minutes
    });
  }
  return jwks;
}

const secretKey = jwtSecret ? new TextEncoder().encode(jwtSecret) : null;
const issuer = supabaseUrl ? `${supabaseUrl}/auth/v1` : undefined;

let warnedNoLocal = false;

/** Verify a Supabase access token without a network round trip when possible. */
export async function verifySupabaseToken(token: string): Promise<VerifyResult> {
  let alg: string | undefined;
  try {
    alg = decodeProtectedHeader(token).alg;
  } catch {
    return { ok: false, reason: 'malformed token', mode: 'remote' };
  }

  const isHmac = typeof alg === 'string' && alg.startsWith('HS');
  const key = isHmac ? secretKey : getJwks();
  const mode: VerifyMode = isHmac ? 'secret' : 'jwks';

  if (!key) {
    if (!warnedNoLocal) {
      warnedNoLocal = true;
      logger.warn(
        { alg },
        isHmac
          ? 'Token is HS256 but SUPABASE_JWT_SECRET is not set — falling back to remote verification'
          : 'VITE_SUPABASE_URL is not set — falling back to remote verification',
      );
    }
    return { ok: null, mode: 'remote' };
  }

  try {
    const { payload } = await jwtVerify(token, key as Parameters<typeof jwtVerify>[1], {
      issuer,
      clockTolerance: 30,
    });
    const sub = (payload as JWTPayload).sub;
    if (!sub) return { ok: false, reason: 'token has no subject', mode };
    // Only session tokens identify a user; anon/service keys have no sub anyway,
    // but be explicit.
    if (payload['role'] !== undefined && payload['role'] !== 'authenticated') {
      return { ok: false, reason: `unexpected role claim ${String(payload['role'])}`, mode };
    }
    return { ok: true, userId: sub, mode };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string })?.code ?? '';
    // A JWKS miss (rotated key we haven't seen yet) or a transient fetch
    // failure must not lock every user out: let the caller fall back to the
    // remote check, which is authoritative.
    if (!isHmac && (code.startsWith('ERR_JWKS_') || /fetch|network|ECONN|ETIMEDOUT/i.test(msg))) {
      logger.warn({ err: msg }, 'JWKS verification unavailable — falling back to remote verification');
      return { ok: null, mode: 'remote' };
    }
    return { ok: false, reason: msg, mode };
  }
}

/** Which verifier is active — surfaced on /healthz for diagnostics. */
export function verifierStatus(): { jwks: boolean; secret: boolean } {
  return { jwks: !!supabaseUrl, secret: !!secretKey };
}
