import { Router, type IRouter } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { logger } from '../lib/logger.js';

const router: IRouter = Router();

/**
 * POST /api/auth/register
 *
 * Creates a Supabase auth user that is ALREADY email-confirmed, so email
 * sign-up works immediately without the confirmation round-trip (there is no
 * transactional email provider configured on this project). Public endpoint —
 * the client then signs in normally via supabase.auth.signInWithPassword to
 * obtain a session.
 */
router.post('/register', async (req, res) => {
  const email =
    typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  const password =
    typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || password.length < 6) {
    res
      .status(400)
      .json({ error: 'A valid email and a 6+ character password are required.' });
    return;
  }

  try {
    const { data, error } = await adminDb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      // Already-registered is fine — the client will just sign in.
      if (/already|registered|exists|duplicate/i.test(error.message)) {
        res.status(200).json({ ok: true, existing: true });
        return;
      }
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(200).json({ ok: true, userId: data.user?.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Registration failed';
    logger.error({ err: msg }, 'auth/register failed');
    res.status(500).json({ error: msg });
  }
});

export default router;
