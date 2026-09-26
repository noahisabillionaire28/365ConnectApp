/**
 * Small in-memory rate limiter for the handful of routes that are open to the
 * world (sign-up) or fetch arbitrary URLs on a user's behalf (link previews).
 *
 * Best effort by design: the API runs as Vercel serverless functions, so each
 * warm instance keeps its own counters and a cold start resets them. That still
 * stops a single client from hammering one instance, which is what the abuse
 * cases here look like (bulk account creation, SSRF probing). Move the counters
 * to a shared store (Upstash/Redis) if a hard global limit is ever needed.
 */
import type { Request, Response, NextFunction } from 'express';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

/** The caller's IP as seen through Vercel's proxy (first x-forwarded-for hop). */
export function clientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
  return first || req.ip || req.socket?.remoteAddress || 'unknown';
}

function hit(key: string, windowMs: number, max: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      // Drop expired entries first; if still full, drop the oldest.
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
      if (buckets.size >= MAX_BUCKETS) buckets.delete(buckets.keys().next().value as string);
    }
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  return { ok: b.count <= max, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
}

export type RateLimitOptions = {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Requests allowed per key per window. */
  max: number;
  /** Bucket keys for a request (e.g. the IP and the email). Empty keys are skipped. */
  keys: (req: Request) => Array<string | null | undefined>;
  /** Message for the 429 body. */
  message?: string;
};

/**
 * Express middleware: 429 when any of the request's keys is over its limit.
 * Every key is counted on every request, so a burst from one IP across many
 * emails and a burst on one email from many IPs are both caught.
 */
export function rateLimit(opts: RateLimitOptions) {
  const message = opts.message ?? 'Too many requests. Please wait a moment and try again.';
  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    let blocked: number | null = null;
    for (const raw of opts.keys(req)) {
      if (!raw) continue;
      const r = hit(`${req.baseUrl}${req.path}:${raw}`, opts.windowMs, opts.max);
      if (!r.ok) blocked = Math.max(blocked ?? 0, r.retryAfterSec);
    }
    if (blocked != null) {
      res.setHeader('Retry-After', String(blocked));
      res.status(429).json({ error: message });
      return;
    }
    next();
  };
}
