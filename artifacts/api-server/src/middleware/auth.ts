/**
 * Auth middleware.
 * Reads the authenticated user's ID from Clerk's verified session via getAuth().
 * Identity is derived ONLY from the Clerk session — there is no header-based
 * fallback, so callers cannot spoof another user by setting a request header.
 */
import { getAuth } from "@clerk/express";
import { pool } from "@workspace/db";
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
export function attachUserId(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const auth = getAuth(req);
  req.userId = auth?.userId ?? null;
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
