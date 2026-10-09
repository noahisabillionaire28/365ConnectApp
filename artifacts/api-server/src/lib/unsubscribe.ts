/**
 * One-click email unsubscribe tokens.
 *
 * Every notification email carries a link to
 * GET /api/notifications/unsubscribe?token=… (and the same URL in the
 * List-Unsubscribe header, which mail clients POST to). The token is the user
 * id plus an HMAC over it, keyed with a secret derived from configuration the
 * server already has (the Supabase service-role key, else CRON_SECRET), so no
 * new environment variable is needed and the link works without a login.
 * A token cannot be forged without the secret and reveals nothing but the
 * user id it was issued for.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { appUrl } from './email.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function secret(): Buffer | null {
  const base = process.env['SUPABASE_SERVICE_ROLE_KEY'] || process.env['CRON_SECRET'] || '';
  if (!base) return null;
  // Hash so the raw key never acts as an HMAC key directly.
  return createHash('sha256').update(`365connect:email-unsubscribe:${base}`).digest();
}

function sign(userId: string, key: Buffer): string {
  return createHmac('sha256', key).update(userId.toLowerCase()).digest('base64url');
}

/** True when the server can mint and verify tokens (a signing secret exists). */
export function unsubscribeConfigured(): boolean {
  return secret() !== null;
}

/** The token for a user, or null when no signing secret is configured. */
export function unsubscribeToken(userId: string): string | null {
  const key = secret();
  if (!key || !UUID_RE.test(userId)) return null;
  return `${Buffer.from(userId.toLowerCase()).toString('base64url')}.${sign(userId, key)}`;
}

/** Absolute URL for the one-click link, or null when tokens are unavailable. */
export function unsubscribeUrl(userId: string): string | null {
  const token = unsubscribeToken(userId);
  return token ? `${appUrl()}/api/notifications/unsubscribe?token=${encodeURIComponent(token)}` : null;
}

/** The user id a token was issued for, or null when it is malformed or forged. */
export function verifyUnsubscribeToken(token: unknown): string | null {
  if (typeof token !== 'string' || token.length > 200) return null;
  const key = secret();
  if (!key) return null;
  const [idPart, sigPart] = token.split('.');
  if (!idPart || !sigPart) return null;
  let userId: string;
  try { userId = Buffer.from(idPart, 'base64url').toString('utf8'); } catch { return null; }
  if (!UUID_RE.test(userId)) return null;
  const expected = Buffer.from(sign(userId, key));
  const given = Buffer.from(sigPart);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return userId;
}
