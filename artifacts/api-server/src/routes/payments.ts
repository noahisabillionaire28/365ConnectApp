import { Router } from 'express';
import { z } from 'zod';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { createNotification } from './notifications.js';
import { sendError } from '../lib/httpError.js';
import { assertShiftOwner } from '../lib/shiftAccess.js';
import { formatUsd } from '../lib/shiftLabel.js';

const router = Router();

/** GET /api/payments — my payments (earned as a worker AND paid out as a client) */
router.get('/', requireAuth, async (req, res) => {
  const { data: payments, error } = await adminDb
    .from('payments')
    .select('*')
    .or(`worker_id.eq.${req.userId},client_id.eq.${req.userId}`)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const shiftIds = [...new Set((payments ?? []).map((p) => p.shift_id).filter(Boolean))];
  const shiftMap = new Map<string, { title: string | null; company_name: string | null }>();
  if (shiftIds.length) {
    const { data: shifts, error: sErr } = await adminDb
      .from('shifts')
      .select('id, title, company_name')
      .in('id', shiftIds);
    if (sErr) return res.status(500).json({ error: sErr.message });
    for (const s of shifts ?? []) shiftMap.set(s.id, s);
  }

  const rows = (payments ?? []).map((p) => {
    const s = p.shift_id ? shiftMap.get(p.shift_id) : undefined;
    // 'out' = the caller paid this (they are the client); 'in' = they earned it.
    const direction = p.client_id === req.userId && p.worker_id !== req.userId ? 'out' : 'in';
    return {
      ...p,
      shift_title: s?.title ?? null,
      company_name: s?.company_name ?? null,
      direction,
    };
  });
  return res.json(rows);
});

// ── Pro upgrade (simulated subscription) ────────────────────────────────────
// The only caller of POST /payments is ProUpgradeScreen (payment_type
// 'pro_subscription'). Shift payments are recorded exclusively by /confirm
// after Stripe verifies the checkout session, so this route never accepts a
// client-chosen amount/status — a caller cannot mint 'completed' rows.
const PRO_SUBSCRIPTION_PRICE = 17.0;

/** POST /api/payments — record the (simulated) Pro subscription payment */
router.post('/', requireAuth, async (req, res) => {
  const { payment_type } = req.body as Record<string, unknown>;
  if (payment_type !== 'pro_subscription') {
    return res.status(400).json({
      error: 'Only pro_subscription payments can be recorded here. Shift payments go through /payments/checkout.',
    });
  }
  const payload = {
    shift_id: null,
    client_id: req.userId,
    worker_id: req.userId,
    amount: PRO_SUBSCRIPTION_PRICE,
    fee: 0,
    total: PRO_SUBSCRIPTION_PRICE,
    net_amount: PRO_SUBSCRIPTION_PRICE,
    status: 'simulated',
    payment_type: 'pro_subscription',
  };
  const { data, error } = await adminDb.from('payments').insert(payload).select().single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json(data);
});

// ── Stripe Checkout ──────────────────────────────────────────────────────────
// Uses Stripe's hosted checkout via the REST API (no SDK, no webhook): the
// client is redirected to Stripe to pay; on return the app calls /confirm which
// verifies the session server-side and records the payment idempotently.
const PLATFORM_FEE_PCT = 0; // platform fee removed for now
const STRIPE_API = 'https://api.stripe.com/v1';

function stripeKey(): string | null {
  return process.env['STRIPE_SECRET_KEY'] || null;
}

const checkoutBody = z.object({
  shift_id: z.string().min(1, 'shift_id is required'),
  worker_id: z.string().min(1, 'worker_id is required'),
});

/** Has this worker already been paid (a completed shift payment) for the shift? */
async function alreadyPaid(shiftId: string, workerId: string): Promise<boolean> {
  const { count } = await adminDb
    .from('payments')
    .select('*', { count: 'exact', head: true })
    .eq('shift_id', shiftId)
    .eq('worker_id', workerId)
    .eq('status', 'completed');
  return (count ?? 0) > 0;
}

/**
 * POST /api/payments/checkout { shift_id, worker_id } — create a Stripe
 * Checkout session for a shift payment. The amount is never taken from the
 * request: it is the approved pay on the worker's timesheet for that shift.
 * Only the shift owner (or an admin) may pay, the timesheet must be approved,
 * and a worker cannot be paid twice for the same shift (409).
 */
router.post('/checkout', requireAuth, async (req, res) => {
  const key = stripeKey();
  if (!key) return res.status(503).json({ error: 'Payments are not configured yet.' });

  const parsed = checkoutBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' });
  const { shift_id, worker_id } = parsed.data;

  try {
    await assertShiftOwner(shift_id, req.userId!);

    const { data: entry, error: eErr } = await adminDb
      .from('time_entries')
      .select('id, approved, approved_pay, total_pay, clock_out')
      .eq('shift_id', shift_id)
      .eq('worker_id', worker_id)
      .maybeSingle();
    if (eErr) return res.status(500).json({ error: eErr.message });
    if (!entry || !entry.clock_out) return res.status(409).json({ error: 'This worker has not clocked out of the shift yet.' });
    if (!entry.approved) return res.status(409).json({ error: 'Approve the timesheet before paying this worker.' });
    const amountNum = Number(entry.approved_pay ?? entry.total_pay ?? 0);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return res.status(409).json({ error: 'The approved pay for this timesheet is zero, so there is nothing to charge.' });
    }
    if (await alreadyPaid(shift_id, worker_id)) {
      return res.status(409).json({ error: 'This worker has already been paid for this shift.' });
    }

    const origin =
      (typeof req.headers['origin'] === 'string' && req.headers['origin']) ||
      'https://365-connect-app.vercel.app';

    const form = new URLSearchParams();
    form.set('mode', 'payment');
    form.set('success_url', `${origin}/earnings?paid=1&session_id={CHECKOUT_SESSION_ID}`);
    form.set('cancel_url', `${origin}/shift/${shift_id}/applicants`);
    form.append('line_items[0][quantity]', '1');
    form.append('line_items[0][price_data][currency]', 'usd');
    form.append('line_items[0][price_data][unit_amount]', String(Math.round(amountNum * 100)));
    form.append('line_items[0][price_data][product_data][name]', 'Shift payment');
    form.append('metadata[shift_id]', shift_id);
    form.append('metadata[worker_id]', worker_id);
    form.append('metadata[client_id]', String(req.userId));
    form.append('metadata[amount]', String(amountNum));

    const r = await fetch(`${STRIPE_API}/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
    const data = (await r.json()) as { url?: string; error?: { message?: string } };
    if (!r.ok) return res.status(502).json({ error: data.error?.message || 'Stripe error' });
    return res.json({ url: data.url, amount: amountNum });
  } catch (e) {
    return sendError(res, e);
  }
});

/** POST /api/payments/confirm — verify a completed Checkout session and record the payment */
router.post('/confirm', requireAuth, async (req, res) => {
  const key = stripeKey();
  if (!key) return res.status(503).json({ error: 'Payments are not configured yet.' });

  const { session_id } = req.body as Record<string, unknown>;
  if (!session_id || typeof session_id !== 'string') {
    return res.status(400).json({ error: 'session_id is required' });
  }

  try {
    const r = await fetch(`${STRIPE_API}/checkout/sessions/${encodeURIComponent(session_id)}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const s = (await r.json()) as {
      payment_status?: string;
      metadata?: Record<string, string>;
      error?: { message?: string };
    };
    if (!r.ok) return res.status(502).json({ error: s.error?.message || 'Stripe error' });
    if (s.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment has not completed' });
    }

    const m = s.metadata ?? {};
    const amount = Number(m.amount || 0);
    const fee = Math.round(amount * PLATFORM_FEE_PCT * 100) / 100;
    const payload = {
      shift_id: m.shift_id || null,
      client_id: m.client_id || null,
      worker_id: m.worker_id || null,
      amount,
      fee,
      total: amount,
      net_amount: Math.round((amount - fee) * 100) / 100,
      status: 'completed',
      payment_type: 'shift_payment',
      stripe_session_id: session_id,
    };
    const { data, error } = await adminDb
      .from('payments')
      .upsert(payload, { onConflict: 'stripe_session_id', ignoreDuplicates: true })
      .select()
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });

    // A newly recorded payment: tell the worker the money is on its way.
    if (data && payload.worker_id) {
      const { data: shift } = payload.shift_id
        ? await adminDb.from('shifts').select('title').eq('id', payload.shift_id).maybeSingle()
        : { data: null };
      await createNotification({
        userId: payload.worker_id,
        fromUserId: payload.client_id,
        type: 'payment_received',
        title: 'You got paid',
        body: `${formatUsd(payload.net_amount)} for ${shift?.title ? `"${shift.title}"` : 'your shift'} has been paid.`,
        shiftId: payload.shift_id,
        url: '/earnings',
      });
    }
    return res.json(data ?? { ok: true, alreadyRecorded: true });
  } catch (e) {
    return res.status(502).json({ error: `Stripe request failed: ${String(e)}` });
  }
});

export default router;
