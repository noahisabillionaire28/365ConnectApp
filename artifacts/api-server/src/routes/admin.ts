/**
 * Admin API — all backed by the Supabase service-role client (adminDb).
 * Auth: reads x-user-id header and verifies role='admin' in users table.
 * Mounted at /admin/* under the /api prefix → full paths: /api/admin/*
 */
import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

async function requireAdminSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.userId;
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    const { data, error } = await adminDb
      .from('users')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
    if (error) { res.status(500).json({ error: 'Auth check failed' }); return; }
    if (!data || data.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden — admin role required' });
      return;
    }
    next();
  } catch {
    res.status(500).json({ error: 'Auth check failed' });
  }
}

router.use(requireAdminSession);

/* ── GET /api/admin/stats ─────────────────────────────────────────────────── */
router.get('/stats', async (_req, res) => {
  try {
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);

    const [users, shifts, apps, payments, newToday, activeShifts, disputes] = await Promise.all([
      adminDb.from('users').select('*', { count: 'exact', head: true }),
      adminDb.from('shifts').select('*', { count: 'exact', head: true }),
      adminDb.from('applications').select('*', { count: 'exact', head: true }),
      adminDb.from('payments').select('amount, fee, status, payment_type'),
      adminDb.from('users').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
      adminDb.from('shifts').select('*', { count: 'exact', head: true }).in('status', ['open', 'filled']),
      adminDb.from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'open')
        .then((r) => (r.error ? { count: 0 } : r), () => ({ count: 0 })),
    ]);

    const payRows = (payments.data ?? []) as Array<{
      amount: unknown; fee: unknown; status?: string; payment_type?: string;
    }>;
    // Real revenue = completed shift payments only. Simulated Pro subscriptions
    // are demo data and must not inflate the platform's revenue/fee totals.
    const realPays = payRows.filter(
      (p) => p.status !== 'simulated' && p.payment_type !== 'pro_subscription',
    );
    const rev = realPays.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const feeTotal = realPays.reduce((sum, p) => sum + (Number(p.fee) || 0), 0);

    res.json({
      totalUsers:      users.count ?? 0,
      totalShifts:     shifts.count ?? 0,
      totalApps:       apps.count ?? 0,
      totalRevenue:    rev,
      platformFeeRev:  feeTotal,
      newSignupsToday: newToday.count ?? 0,
      activeShifts:    activeShifts.count ?? 0,
      openDisputes:    disputes.count ?? 0,
    });
  } catch (err) {
    console.error('[admin/stats]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ── GET /api/admin/users ─────────────────────────────────────────────────── */
router.get('/users', async (_req, res) => {
  try {
    const { data, error } = await adminDb
      .from('users')
      .select('id, email, role, username, photo_url, is_pro, rating, status, created_at')
      .order('created_at', { ascending: false });
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
    const { id } = req.params;
    const allowed = ['role', 'is_pro', 'status'] as const;
    const body = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    for (const k of allowed) {
      if (k in body) updates[k] = body[k];
    }
    if (!Object.keys(updates).length) { res.status(400).json({ error: 'No valid fields' }); return; }
    const { error } = await adminDb.from('users').update(updates).eq('id', id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('[admin/users PATCH]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ── DELETE /api/admin/users/:id ──────────────────────────────────────────── */
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Remove the profile row, then the auth account (best-effort).
    const { error } = await adminDb.from('users').delete().eq('id', id);
    if (error) throw error;
    try { await adminDb.auth.admin.deleteUser(id); } catch { /* auth user may already be gone */ }
    res.json({ ok: true });
  } catch (err) {
    console.error('[admin/users DELETE]', err);
    res.status(409).json({ error: 'Could not delete — this user has linked shifts/payments. Ban them instead.' });
  }
});

/* ── GET /api/admin/shifts ────────────────────────────────────────────────── */
router.get('/shifts', async (_req, res) => {
  try {
    const { data, error } = await adminDb
      .from('shifts')
      .select(
        'id, title, job_type, company_name, status, pay_rate, ' +
          'spots_available, spots_filled, created_at, client_id, ' +
          'start_time, end_time, location, date',
      )
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data ?? []);
  } catch (err) {
    console.error('[admin/shifts]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ── POST /api/admin/shifts/backfill-coords ──────────────────────────────────
 * One-time cleanup: the client geocodes each shift's address and sends the
 * resolved {id, lat, lng} here to overwrite stale/wrong stored coordinates
 * (older shifts were saved with the poster's own location). Admin-only. */
router.post('/shifts/backfill-coords', async (req, res) => {
  try {
    const updates = (req.body?.updates ?? []) as Array<{ id: string; lat: number; lng: number }>;
    if (!Array.isArray(updates)) { res.status(400).json({ error: 'updates[] required' }); return; }
    let updated = 0;
    for (const u of updates) {
      if (!u || typeof u.id !== 'string') continue;
      const lat = Number(u.lat), lng = Number(u.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const { error } = await adminDb.from('shifts').update({ lat, lng }).eq('id', u.id);
      if (!error) updated++;
    }
    res.json({ updated });
  } catch (err) {
    console.error('[admin/shifts/backfill-coords]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ── PATCH /api/admin/shifts/:id/cancel ──────────────────────────────────── */
router.patch('/shifts/:id/cancel', async (req, res) => {
  try {
    const { error } = await adminDb.from('shifts').update({ status: 'cancelled' }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('[admin/shifts/cancel]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ── PATCH /api/admin/shifts/:id/reopen — reassign: reopen for re-staffing ── */
router.patch('/shifts/:id/reopen', async (req, res) => {
  try {
    const { id } = req.params;
    // Reopen the shift and clear any accepted bookings so it can be re-staffed.
    const { error } = await adminDb.from('shifts').update({ status: 'open' }).eq('id', id);
    if (error) throw error;
    await adminDb.from('applications').update({ status: 'declined' })
      .eq('shift_id', id).eq('status', 'accepted');
    res.json({ ok: true });
  } catch (err) {
    console.error('[admin/shifts/reopen]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ── GET /api/admin/payments ──────────────────────────────────────────────── */
router.get('/payments', async (_req, res) => {
  try {
    const { data, error } = await adminDb
      .from('payments')
      .select('id, shift_id, worker_id, payment_type, amount, fee, net_amount, status, created_at')
      .order('created_at', { ascending: false });
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
    // disputes table may not exist — stay resilient and return an empty list.
    if (error) { res.json([]); return; }
    res.json(data ?? []);
  } catch (err) {
    console.error('[admin/disputes]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ── PATCH /api/admin/disputes/:id ───────────────────────────────────────── */
router.patch('/disputes/:id', async (req, res) => {
  try {
    const { status, resolution_note } = req.body as { status: string; resolution_note?: string };
    const updates: Record<string, unknown> = { status };
    if (resolution_note !== undefined) updates.resolution_note = resolution_note;
    if (['resolved','warned','banned'].includes(status)) updates.resolved_at = new Date().toISOString();

    const { data: dispute, error } = await adminDb
      .from('disputes')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .maybeSingle();
    if (error) { res.status(500).json({ error: error.message }); return; }

    // Banning a dispute bans the reported user for real.
    if (status === 'banned' && dispute?.reported_user_id) {
      await adminDb
        .from('users')
        .update({ status: 'banned', is_banned: true })
        .eq('id', dispute.reported_user_id);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[admin/disputes PATCH]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ── GET /api/admin/applications ─────────────────────────────────────────── */
router.get('/applications', async (_req, res) => {
  try {
    const { data: apps, error } = await adminDb
      .from('applications')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const rows = (apps ?? []) as Array<Record<string, unknown>>;
    const shiftIds = [...new Set(rows.map((a) => a.shift_id).filter(Boolean))];
    const workerIds = [...new Set(rows.map((a) => a.worker_id).filter(Boolean))];

    const [shiftsRes, usersRes] = await Promise.all([
      shiftIds.length
        ? adminDb.from('shifts').select('id, title').in('id', shiftIds as string[])
        : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null }),
      workerIds.length
        ? adminDb.from('users').select('id, username').in('id', workerIds as string[])
        : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null }),
    ]);
    if (shiftsRes.error) throw shiftsRes.error;
    if (usersRes.error) throw usersRes.error;

    const shiftById = new Map((shiftsRes.data ?? []).map((s) => [s.id, s]));
    const userById = new Map((usersRes.data ?? []).map((u) => [u.id, u]));

    // Original used INNER JOINs on shifts and users — drop rows lacking either match.
    const merged = rows
      .filter((a) => shiftById.has(a.shift_id) && userById.has(a.worker_id))
      .map((a) => ({
        ...a,
        shift_title: shiftById.get(a.shift_id)!.title,
        worker_username: userById.get(a.worker_id)!.username,
      }));

    res.json(merged);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
