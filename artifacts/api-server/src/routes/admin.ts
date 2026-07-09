/**
 * Admin API endpoints — all backed by the service-role Supabase client.
 * Protected by X-Admin-Token header; value must match ADMIN_TOKEN env var
 * (defaults to 'Admin123!' for dev).
 *
 * Mounted at /admin/* under the /api prefix → full paths: /api/admin/*
 */
import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin';

const router = Router();

const SUPABASE_URL     = process.env['VITE_SUPABASE_URL'];
const SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];

/**
 * Middleware — verifies the Supabase JWT from the Authorization header and
 * confirms the caller has role='admin' in the users table.
 * No hardcoded tokens; relies entirely on Supabase's signing secret.
 */
async function requireAdminSession(
  req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction,
): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    res.status(503).json({ error: 'Server misconfigured — Supabase credentials not set' });
    return;
  }

  const auth = req.headers['authorization'];
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const accessToken = auth.slice(7);

  try {
    // Verify the JWT and get the authenticated user
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey':        SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    if (!userRes.ok) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const user = await userRes.json() as { id: string };

    // Confirm the user has the admin role in the users table
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=role`,
      {
        headers: {
          'apikey':        SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
      },
    );
    const profiles = await profileRes.json() as Array<{ role: string }>;
    if (!profiles[0] || profiles[0].role !== 'admin') {
      res.status(403).json({ error: 'Forbidden — admin role required' });
      return;
    }

    next();
  } catch {
    res.status(500).json({ error: 'Auth check failed' });
  }
}

router.use(requireAdminSession);

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function isColumnMissingError(err: unknown): boolean {
  return (err as { code?: string })?.code === '42703';
}
function isTableMissingError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return code === 'PGRST205' || code === '42P01';
}

/* ── GET /api/admin/stats ─────────────────────────────────────────────────── */
router.get('/stats', async (_req, res) => {
  try {
    const [
      { count: userCount },
      { count: shiftCount },
      { count: appCount },
    ] = await Promise.all([
      adminDb.from('users').select('*', { count: 'exact', head: true }),
      adminDb.from('shifts').select('*', { count: 'exact', head: true }),
      adminDb.from('applications').select('*', { count: 'exact', head: true }),
    ]);

    // Payments — payment_type may not exist pre-migration
    let { data: payments, error: paymentsErr } = await adminDb
      .from('payments')
      .select('amount, fee, payment_type, status');
    if (paymentsErr && isColumnMissingError(paymentsErr)) {
      const fallback = await adminDb.from('payments').select('amount, fee, status');
      payments = (fallback.data ?? []).map((p) => ({ ...p, payment_type: 'shift_payment' }));
      paymentsErr = null;
    }
    if (paymentsErr) throw paymentsErr;

    const completedPayments = (payments ?? []).filter(
      (p) => p.status === 'completed' || p.status === 'simulated',
    );
    const totalRevenue   = completedPayments.reduce((s, p) => s + Number(p.amount), 0);
    const platformFeeRev = completedPayments.reduce((s, p) => s + Number(p.fee ?? 0), 0);

    // New signups today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count: newToday } = await adminDb
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString());

    // Active shifts
    const { count: activeShifts } = await adminDb
      .from('shifts')
      .select('*', { count: 'exact', head: true })
      .in('status', ['open', 'filled']);

    // Open disputes — table may not exist pre-migration
    let openDisputes = 0;
    const disputeRes = await adminDb
      .from('disputes')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open');
    if (!disputeRes.error && !isTableMissingError(disputeRes.error)) {
      openDisputes = disputeRes.count ?? 0;
    }

    res.json({
      totalUsers:      userCount    ?? 0,
      totalShifts:     shiftCount   ?? 0,
      totalApps:       appCount     ?? 0,
      totalRevenue,
      platformFeeRev,
      newSignupsToday: newToday     ?? 0,
      activeShifts:    activeShifts ?? 0,
      openDisputes,
    });
  } catch (err) {
    console.error('[admin/stats]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ── GET /api/admin/users ─────────────────────────────────────────────────── */
router.get('/users', async (_req, res) => {
  try {
    // Try with Phase 11 `status` column first; fall back if it doesn't exist yet.
    let { data, error } = await adminDb
      .from('users')
      .select('id, email, role, username, photo_url, is_pro, rating, status, created_at')
      .order('created_at', { ascending: false });

    if (error && (error as { code?: string }).code === '42703') {
      // `status` column not yet migrated — query without it and default to 'active'
      const fallback = await adminDb
        .from('users')
        .select('id, email, role, username, photo_url, is_pro, rating, created_at')
        .order('created_at', { ascending: false });

      if (fallback.error) throw fallback.error;
      data = (fallback.data ?? []).map((u) => ({ ...u, status: 'active' }));
      error = null;
    }

    if (error) throw error;
    res.json(data ?? []);
  } catch (err) {
    console.error('[admin/users]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ── PATCH /api/admin/users/:id ───────────────────────────────────────────── */
router.patch('/users/:id', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const updates = req.body as Record<string, unknown>;
    // Only allow safe fields
    // 'status' is only available after Phase 11 migration; skip if column missing
    const allowed = ['role', 'is_pro', 'status'] as const;
    const safe: Record<string, unknown> = {};
    for (const k of allowed) if (k in updates) safe[k] = updates[k];

    const { error } = await adminDb.from('users').update(safe).eq('id', id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('[admin/users PATCH]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ── GET /api/admin/shifts ────────────────────────────────────────────────── */
router.get('/shifts', async (_req, res) => {
  try {
    const { data, error } = await adminDb
      .from('shifts')
      .select('id, title, job_type, company_name, status, pay_rate, spots_available, spots_filled, created_at, client_id, start_time, end_time, date, location')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data ?? []);
  } catch (err) {
    console.error('[admin/shifts]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ── PATCH /api/admin/shifts/:id/cancel ──────────────────────────────────── */
router.patch('/shifts/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const { error } = await adminDb
      .from('shifts')
      .update({ status: 'cancelled' })
      .eq('id', id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('[admin/shifts/cancel]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ── GET /api/admin/payments ──────────────────────────────────────────────── */
router.get('/payments', async (_req, res) => {
  try {
    // Full select (Phase 10 columns: payment_type, net_amount, fee)
    let { data, error } = await adminDb
      .from('payments')
      .select('id, shift_id, worker_id, payment_type, amount, fee, net_amount, status, created_at')
      .order('created_at', { ascending: false });

    if (error && isColumnMissingError(error)) {
      // Some Phase-10 columns not yet migrated — use only baseline columns
      const fallback = await adminDb
        .from('payments')
        .select('id, shift_id, worker_id, amount, status, created_at')
        .order('created_at', { ascending: false });
      if (fallback.error) throw fallback.error;
      data = (fallback.data ?? []).map((p) => ({
        ...p,
        payment_type: 'shift_payment',
        fee: 0,
        net_amount: Number(p.amount),
      }));
      error = null;
    }

    if (error) throw error;
    res.json(data ?? []);
  } catch (err) {
    console.error('[admin/payments]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ── GET /api/admin/disputes ──────────────────────────────────────────────── */
router.get('/disputes', async (_req, res) => {
  try {
    const { data, error } = await adminDb
      .from('disputes')
      .select('id, type, reported_user_id, reported_by_user_id, reason, status, created_at, resolution_note')
      .order('created_at', { ascending: false });

    // disputes table doesn't exist pre-Phase-11-migration — return empty array
    if (error && isTableMissingError(error)) {
      res.json([]);
      return;
    }

    if (error) throw error;
    res.json(data ?? []);
  } catch (err) {
    console.error('[admin/disputes]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ── PATCH /api/admin/disputes/:id ───────────────────────────────────────── */
router.patch('/disputes/:id', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const { status, resolution_note } = req.body as {
      status: string;
      resolution_note?: string;
    };
    const update: Record<string, unknown> = { status };
    if (resolution_note !== undefined) update['resolution_note'] = resolution_note;
    if (['resolved', 'warned', 'banned'].includes(status)) {
      update['resolved_at'] = new Date().toISOString();
    }

    const { error } = await adminDb.from('disputes').update(update).eq('id', id);
    if (error && isTableMissingError(error)) {
      // Table not yet migrated — acknowledge gracefully
      res.json({ ok: true });
      return;
    }
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('[admin/disputes PATCH]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
