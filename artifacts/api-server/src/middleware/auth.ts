/**
 * Auth middleware.
 * Reads the authenticated user's ID from Clerk's verified session via getAuth().
 * Identity is derived ONLY from the Clerk session — there is no header-based
 * fallback, so callers cannot spoof another user by setting a request header.
 */
import { getAuth, verifyToken } from "@clerk/express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger.js";
import type { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      userId: string | null;
      userRole?: string | null;
    }
  }
}

/**
 * Attaches req.userId from Clerk's verified session.
 * Never rejects — routes that require auth must call requireAuth().
 */
export async function attachUserId(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  // 1) Standard Clerk middleware (session cookie or Authorization bearer).
  try {
    const auth = getAuth(req);
    if (auth?.userId) {
      req.userId = auth.userId;
      next();
      return;
    }
  } catch {
    /* fall through to explicit-token verification */
  }

  // 2) Fallback: verify a Clerk session token passed explicitly by the SPA.
  // The frontend and API run on different origins (the API is proxied under
  // /api), so cookie-based auth is unreliable — the SPA sends the token in an
  // x-clerk-token header (and Authorization) which survives the proxy. verify
  // it directly here.
  const authz = req.headers["authorization"];
  const bearer =
    typeof authz === "string" ? authz.replace(/^Bearer\s+/i, "") : undefined;
  const xToken = req.headers["x-clerk-token"];
  const token =
    (typeof xToken === "string" ? xToken : undefined) || bearer || undefined;

  if (token) {
    try {
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });
      req.userId = (payload.sub as string | undefined) ?? null;
      next();
      return;
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        "clerk token verification failed",
      );
    }
  }

  req.userId = null;
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
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

/**
 * Looks up a user's role from the database. Returns null if the user row
 * does not exist. Result is memoised on req.userRole for the request.
 */
export async function getUserRole(userId: string): Promise<string | null> {
  const { rows } = await pool.query(
    "SELECT role FROM users WHERE id = $1",
    [userId],
  );
  return rows[0]?.role ?? null;
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
        res.status(403).json({ error: "Forbidden \u2014 insufficient role" });
        return;
      }
      next();
    } catch {
      res.status(500).json({ error: "Auth check failed" });
    }
  };
}
