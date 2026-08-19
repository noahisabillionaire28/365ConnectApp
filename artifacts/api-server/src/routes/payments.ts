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
    net_amount,
    status: status ?? 'completed',
    payment_type: payment_type ?? 'shift_payment',
  };
  const { data, error } = await adminDb.from('payments').insert(payload).select().single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json(data);
});

export default router;
