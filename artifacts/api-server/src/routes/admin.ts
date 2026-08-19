/**
 * Admin API — all backed by the Replit Postgres pool.
 * Auth: reads x-user-id header and verifies role='admin' in users table.
 * Mounted at /admin/* under the /api prefix → full paths: /api/admin/*
 */
import { Router } from 'express';
import { pool } from '../lib/db.js';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

async function requireAdminSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.userId;
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    const { rows } = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
    if (!rows[0] || rows[0].role !== 'admin') {
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
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COUNT(*) FROM shifts'),
      pool.query('SELECT COUNT(*) FROM applications'),
      pool.query('SELECT COALESCE(SUM(amount),0) AS rev, COALESCE(SUM(fee),0) AS fee FROM payments'),
      pool.query('SELECT COUNT(*) FROM users WHERE created_at >= $1', [todayStart.toISOString()]),
      pool.query("SELECT COUNT(*) FROM shifts WHERE status IN ('open','filled')"),
      pool.query("SELECT COUNT(*) FROM disputes WHERE status = 'open'").catch(() => ({ rows: [{ count: 0 }] })),
    ]);

    res.json({
      totalUsers:      parseInt(users.rows[0].count),
      totalShifts:     parseInt(shifts.rows[0].count),
      totalApps:       parseInt(apps.rows[0].count),
      totalRevenue:    parseFloat(payments.rows[0].rev),
      platformFeeRev:  parseFloat(payments.rows[0].fee),
      newSignupsToday: parseInt(newToday.rows[0].count),
      activeShifts:    parseInt(activeShifts.rows[0].count),
      openDisputes:    parseInt(String(disputes.rows[0].count)),
    });
  } catch (err) {
    console.error('[admin/stats]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ── GET /api/admin/users ─────────────────────────────────────────────────── */
router.get('/users', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, role, username, photo_url, is_pro, rating, status, created_at
       FROM users ORDER BY created_at DESC`,
    );
    res.json(rows);
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
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const k of allowed) {
      if (k in req.body) { updates.push(`${k} = $${idx++}`); values.push((req.body as Record<string,unknown>)[k]); }
    }
    if (!updates.length) { res.status(400).json({ error: 'No valid fields' }); return; }
    values.push(id);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`, values);
    res.json({ ok: true });
  } catch (err) {
    console.error('[admin/users PATCH]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ── GET /api/admin/shifts ────────────────────────────────────────────────── */
router.get('/shifts', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, job_type, company_name, status, pay_rate,
              spots_available, spots_filled, created_at, client_id,
              start_time, end_time, location
       FROM shifts ORDER BY created_at DESC`,
    );
    res.json(rows);
  } catch (err) {
    console.error('[admin/shifts]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ── PATCH /api/admin/shifts/:id/cancel ──────────────────────────────────── */
router.patch('/shifts/:id/cancel', async (req, res) => {
  try {
    await pool.query(`UPDATE shifts SET status = 'cancelled' WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[admin/shifts/cancel]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ── GET /api/admin/payments ──────────────────────────────────────────────── */
router.get('/payments', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, shift_id, worker_id, payment_type, amount, fee, net_amount, status, created_at
       FROM payments ORDER BY created_at DESC`,
    );
    res.json(rows);
  } catch (err) {
    console.error('[admin/payments]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ── GET /api/admin/disputes ──────────────────────────────────────────────── */
router.get('/disputes', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, type, reported_user_id, reported_by_user_id, reason, status, created_at, resolution_note
       FROM disputes ORDER BY created_at DESC`,
    ).catch(() => ({ rows: [] as Record<string,unknown>[] }));
    res.json(rows);
  } catch (err) {
    console.error('[admin/disputes]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ── PATCH /api/admin/disputes/:id ───────────────────────────────────────── */
router.patch('/disputes/:id', async (req, res) => {
  try {
    const { status, resolution_note } = req.body as { status: string; resolution_note?: string };
    const updates = ['status = $1'];
    const values: unknown[] = [status];
    let idx = 2;
    if (resolution_note !== undefined) { updates.push(`resolution_note = $${idx++}`); values.push(resolution_note); }
    if (['resolved','warned','banned'].includes(status)) { updates.push(`resolved_at = $${idx++}`); values.push(new Date().toISOString()); }
    values.push(req.params.id);
    await pool.query(`UPDATE disputes SET ${updates.join(', ')} WHERE id = $${idx}`, values);
    res.json({ ok: true });
  } catch (err) {
    console.error('[admin/disputes PATCH]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ── GET /api/admin/applications ─────────────────────────────────────────── */
router.get('/applications', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.*, s.title AS shift_title, u.username AS worker_username
       FROM applications a JOIN shifts s ON s.id = a.shift_id JOIN users u ON u.id = a.worker_id
       ORDER BY a.created_at DESC`,
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
