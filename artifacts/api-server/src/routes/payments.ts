import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/** GET /api/payments — my payments */
router.get('/', requireAuth, async (req, res) => {
  const { data: payments, error } = await adminDb
    .from('payments')
    .select('*')
    .eq('worker_id', req.userId)
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
    return {
      ...p,
      shift_title: s?.title ?? null,
      company_name: s?.company_name ?? null,
    };
  });
  return res.json(rows);
});

/** POST /api/payments — record a payment */
router.post('/', requireAuth, async (req, res) => {
  const { shift_id, amount, fee, net_amount, status, payment_type } = req.body as Record<string, unknown>;
  const payload = {
    shift_id: shift_id ?? null,
    worker_id: req.userId,
    amount,
    fee: fee ?? 0,
    total: amount ?? net_amount ?? 0,
    net_amount,
    status: status ?? 'completed',
    payment_type: payment_type ?? 'shift_payment',
  };
  const { data, error } = await adminDb.from('payments').insert(payload).select().single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json(data);
});

// ── Stripe Checkout ──────────────────────────────────────────────────────────
// Uses Stripe's hosted checkout via the REST API (no SDK, no webhook): the
// client is redirected to Stripe to pay; on return the app calls /confirm which
// verifies the session server-side and records the payment idempotently.
const PLATFORM_FEE_PCT = 0.08; // 8% platform fee
const STRIPE_API = 'https://api.stripe.com/v1';

function stripeKey(): string | null {
  return process.env['STRIPE_SECRET_KEY'] || null;
}

/** POST /api/payments/checkout — create a Stripe Checkout session for a shift payment */
router.post('/checkout', requireAuth, async (req, res) => {
  const key = stripeKey();
  if (!key) return res.status(503).json({ error: 'Payments are not configured yet.' });

  const { shift_id, worker_id, amount } = req.body as Record<string, unknown>;
  const amountNum = Number(amount);
  if (!amountNum || amountNum <= 0) {
    return res.status(400).json({ error: 'A positive amount is required' });
  }
  const origin =
    (typeof req.headers['origin'] === 'string' && req.headers['origin']) ||
    'https://365-connect-app.vercel.app';

  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('success_url', `${origin}/earnings?paid=1&session_id={CHECKOUT_SESSION_ID}`);
  form.set('cancel_url', `${origin}/shift/${typeof shift_id === 'string' ? shift_id : ''}`);
  form.append('line_items[0][quantity]', '1');
  form.append('line_items[0][price_data][currency]', 'usd');
  form.append('line_items[0][price_data][unit_amount]', String(Math.round(amountNum * 100)));
  form.append('line_items[0][price_data][product_data][name]', 'Shift payment');
  form.append('metadata[shift_id]', typeof shift_id === 'string' ? shift_id : '');
  form.append('metadata[worker_id]', typeof worker_id === 'string' ? worker_id : '');
  form.append('metadata[client_id]', String(req.userId));
  form.append('metadata[amount]', String(amountNum));

  try {
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
    return res.json({ url: data.url });
  } catch (e) {
    return res.status(502).json({ error: `Stripe request failed: ${String(e)}` });
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
    return res.json(data ?? { ok: true, alreadyRecorded: true });
  } catch (e) {
    return res.status(502).json({ error: `Stripe request failed: ${String(e)}` });
  }
});

export default router;
