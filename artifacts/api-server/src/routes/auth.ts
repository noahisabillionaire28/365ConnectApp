import { Router, type IRouter } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { logger } from '../lib/logger.js';
import { rateLimit, clientIp } from '../lib/rateLimit.js';

const router: IRouter = Router();

/**
 * AUTH_AUTOCONFIRM — how email sign-up works (see docs/auth-and-security.md):
 *   unset / "true"  → the server creates an already-confirmed account and the
 *                     app signs the user straight in. This is today's
 *                     behaviour: the project has no email templates or SMTP
 *                     configured, so a confirmation mail could not be sent.
 *   "false"         → the server does not create anything; the app calls
 *                     supabase.auth.signUp itself, Supabase sends the
 *                     confirmation email, and the app shows "Check your email".
 */
export function autoConfirmEnabled(): boolean {
  const v = (process.env['AUTH_AUTOCONFIRM'] ?? 'true').trim().toLowerCase();
  return v !== 'false' && v !== '0' && v !== 'no';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sign-up is the only unauthenticated write in the API: 5 attempts per
// 15 minutes per IP and per email address.
const registerLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 5,
  keys: (req) => [
    `ip:${clientIp(req)}`,
    typeof req.body?.email === 'string' ? `email:${req.body.email.trim().toLowerCase()}` : null,
  ],
  message: 'Too many sign-up attempts. Please wait 15 minutes and try again.',
});

/**
 * POST /api/auth/register { email, password }
 *
 * Public. Always answers `{ ok: true }` (plus `confirm: true` when the app
 * must run Supabase's confirmation flow) whether or not the address is
 * already registered, so the endpoint cannot be used to enumerate accounts.
 * The app then calls supabase.auth.signInWithPassword; a failed sign-in after
 * a successful register tells the user the account already exists.
 */
router.post('/register', registerLimiter, async (req, res) => {
  const email =
    typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password =
    typeof req.body?.password === 'string' ? req.body.password : '';

  if (!EMAIL_RE.test(email) || email.length > 254 || password.length < 6 || password.length > 128) {
    res
      .status(400)
      .json({ error: 'A valid email and a 6+ character password are required.' });
    return;
  }

  if (!autoConfirmEnabled()) {
    // The app runs supabase.auth.signUp itself so Supabase sends (and
    // rate-limits) the confirmation email.
    res.status(200).json({ ok: true, confirm: true });
    return;
  }

  try {
    const { error } = await adminDb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error && !/already|registered|exists|duplicate/i.test(error.message)) {
      // Weak password, malformed address, etc. — safe to show.
      res.status(400).json({ error: error.message });
      return;
    }
    // New or existing: same body either way.
    res.status(200).json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Registration failed';
    logger.error({ err: msg }, 'auth/register failed');
    res.status(500).json({ error: 'Could not create your account right now. Please try again.' });
  }
});

export default router;
