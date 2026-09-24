/**
 * Auth middleware — Supabase Auth.
 *
 * Identity is derived ONLY from a verified Supabase session access token, sent
 * by the SPA as an `Authorization: Bearer` header (and mirrored in
 * `X-Supabase-Token`, which survives cross-origin proxying). The `x-user-id`
 * header is NOT trusted for identity, so callers cannot spoof another user.
 */
import { adminDb } from "../lib/supabaseAdmin.js";
import { logger } from "../lib/logger.js";
import { verifySupabaseToken } from "../lib/jwtVerify.js";
import { getRoleInfo } from "../lib/roleCache.js";
import type { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      userId: string | null;
      userRole?: string | null;
      authReason?: string;
    }
  }
}

/**
 * Attaches req.userId from a verified Supabase access token.
 * Never rejects — routes that require auth must call requireAuth().
 */
export async function attachUserId(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authz = req.headers["authorization"];
  const bearer =
    typeof authz === "string" ? authz.replace(/^Bearer\s+/i, "") : undefined;
  const xToken = req.headers["x-supabase-token"];
  const token =
    (typeof xToken === "string" ? xToken : undefined) || bearer || undefined;

  if (!token) {
    req.userId = null;
    req.authReason = "no-token";
    next();
    return;
  }

  try {
    // Fast path: verify the JWT signature in-process (no network hop).
    const local = await verifySupabaseToken(token);
    if (local.ok === true) {
      req.userId = local.userId;
      next();
      return;
    }
    if (local.ok === false) {
      req.userId = null;
      req.authReason = `verify-failed: ${local.reason}`;
      next();
      return;
    }

    // Slow path: local verification isn't possible for this token/config.
    const { data, error } = await adminDb.auth.getUser(token);
    if (error || !data?.user) {
      req.userId = null;
      req.authReason = `verify-failed: ${error?.message ?? "no user"}`;
    } else {
      req.userId = data.user.id;
    }
  } catch (err) {
    req.userId = null;
    req.authReason = `verify-error: ${err instanceof Error ? err.message : String(err)}`;
    logger.warn({ err: req.authReason }, "supabase token verification threw");
  }

  next();
}

/** The 403 body every route returns for a suspended or banned account. */
export const SUSPENDED_ERROR = { error: "Account suspended" } as const;

/**
 * Rejects requests with no authenticated user (401). Does NOT check the
 * account's moderation status — only for the handful of routes a suspended
 * user must still reach (GET /users/me, so the app can show the suspended
 * screen). Everything else uses requireAuth.
 */
export function requireSession(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.userId) {
    res.status(401).json({ error: `Unauthorized — ${req.authReason ?? "no session"}` });
    return;
  }
  next();
}

/**
 * Rejects requests with no authenticated user (401) and requests from a
 * suspended or banned account (403 { error: 'Account suspended' }).
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: `Unauthorized — ${req.authReason ?? "no session"}` });
    return;
  }
  try {
    // Cached for 60s per user — see lib/roleCache.ts.
    const info = await getRoleInfo(req.userId);
    if (info.isSuspended) {
      res.status(403).json(SUSPENDED_ERROR);
      return;
    }
    req.userRole = info.role;
  } catch {
    res.status(500).json({ error: "Auth check failed" });
    return;
  }
  next();
}

/**
 * Looks up a user's role from the database. Returns null if the user row
 * does not exist. Result is memoised on req.userRole for the request.
 */
export async function getUserRole(userId: string): Promise<string | null> {
  return (await getRoleInfo(userId)).role;
}

/**
 * Middleware factory: allows the request only if the authenticated user's
 * role is one of the supplied roles. Implies requireAuth.
 */
export function requireRole(...roles: string[]) {
  return async function (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    if (!req.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    try {
      // Cached for 60s per user — see lib/roleCache.ts.
      const { role, isAdmin, isSuspended } = await getRoleInfo(req.userId);
      if (isSuspended) {
        res.status(403).json(SUSPENDED_ERROR);
        return;
      }
      req.userRole = role;
      // Admins are superusers: they can act in any role (this powers the
      // in-app "view as worker/client/staffer" switcher).
      if (!isAdmin && (!role || !roles.includes(role))) {
        res.status(403).json({ error: "Forbidden — insufficient role" });
        return;
      }
      next();
    } catch {
      res.status(500).json({ error: "Auth check failed" });
    }
  };
}
