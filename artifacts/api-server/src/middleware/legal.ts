/**
 * requireLegal — every signed-in user must have accepted the current Terms of
 * Service and Privacy Policy before they can change anything.
 *
 * Applied to the whole API after attachUserId. Reads are never gated (the app
 * must be able to render the acceptance screen, and a stale tab must still
 * show data); anonymous requests are left to each route's own auth. Writes
 * from a user whose users.terms_version / privacy_version do not match the
 * current versions get 428 { code: 'legal_required' }, which the app turns
 * into the acceptance gate.
 *
 * Exempt so onboarding and acceptance itself can proceed:
 *   /auth/*          sign-up / sign-in helpers
 *   /legal/*         versions, status and accept
 *   /users           POST — first profile row
 *   /users/me        GET / POST / PATCH / DELETE — profile setup, and a user
 *                    who declines the new terms must still be able to delete
 *                    their account
 *   /push/*          device registration happens on launch, before the gate
 */
import type { Request, Response, NextFunction } from 'express';
import { userLegalIsCurrent } from '../lib/legal.js';

export const LEGAL_REQUIRED_ERROR = {
  error: 'Please accept the updated Terms and Privacy Policy to continue.',
  code: 'legal_required',
} as const;

const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/** Paths (relative to the /api mount) that bypass the gate. */
export function isLegalExempt(method: string, path: string): boolean {
  const p = path.replace(/\/+$/, '') || '/';
  if (p === '/auth' || p.startsWith('/auth/')) return true;
  if (p === '/legal' || p.startsWith('/legal/')) return true;
  if (p === '/push' || p.startsWith('/push/')) return true;
  if (p === '/users' && method === 'POST') return true;
  if (p === '/users/me') return true;
  return false;
}

export async function requireLegal(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.userId || !WRITE_METHODS.has(req.method) || isLegalExempt(req.method, req.path)) {
    next();
    return;
  }
  try {
    if (await userLegalIsCurrent(req.userId)) {
      next();
      return;
    }
  } catch {
    // A database blip must not lock everyone out of every write; the route's
    // own query will surface a real outage.
    next();
    return;
  }
  res.status(428).json(LEGAL_REQUIRED_ERROR);
}
