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

/**
 * Rejects requests with no authenticated user (401).
 */
export function requireAuth(
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
 * Looks up a user's role from the database. Returns null if the user row
 * does not exist. Result is memoised on req.userRole for the request.
 */
export async function getUserRole(userId: string): Promise<string | null> {
  const { data } = await adminDb
    .from("users")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return (data?.role as string | undefined) ?? null;
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
      const role = await getUserRole(req.userId);
      req.userRole = role;
      if (!role || !roles.includes(role)) {
        res.status(403).json({ error: "Forbidden — insufficient role" });
        return;
      }
      next();
    } catch {
      res.status(500).json({ error: "Auth check failed" });
    }
  };
}
