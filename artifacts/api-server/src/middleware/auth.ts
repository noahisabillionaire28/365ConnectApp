/**
 * Auth middleware — Task #21.
 * Reads the authenticated user's ID from Clerk's session via getAuth().
 * Falls back to x-user-id header for local seed/admin tooling.
 */
import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      userId: string | null;
    }
  }
}

/**
 * Attaches req.userId from Clerk's verified session.
 * Falls back to x-user-id header (seed scripts / admin tools only).
 * Never rejects — routes that require auth must call requireAuth().
 */
export function attachUserId(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const auth = getAuth(req);
  req.userId =
    (auth?.sessionClaims?.userId as string | undefined) ??
    auth?.userId ??
    (req.headers["x-user-id"] as string | undefined) ??
    null;
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
