import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const VALID_TYPES = [
  'no-show', 'late-cancel', 'fake-review', 'dress-code', 'payment', 'harassment', 'other',
];

/** POST /api/disputes — file a report against another user */
router.post('/', requireAuth, async (req, res) => {
  const { reported_user_id, type, reason, shift_id } = req.body as Record<string, unknown>;
  if (!reported_user_id || typeof reported_user_id !== 'string') {
    return res.status(400).json({ error: 'reported_user_id is required' });
  }
  if (reported_user_id === req.userId) {
    return res.status(400).json({ error: 'You cannot report yourself' });
  }
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return res.status(400).json({ error: 'A reason is required' });
  }
  const safeType = typeof type === 'string' && VALID_TYPES.includes(type) ? type : 'other';

  const { data, error } = await adminDb
    .from('disputes')
    .insert({
      reported_user_id,
      reported_by_user_id: req.userId,
      type: safeType,
      reason: reason.trim(),
      shift_id: (typeof shift_id === 'string' ? shift_id : null) ?? null,
      status: 'open',
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json(data);
});

/** GET /api/disputes/mine — reports the current user has filed */
router.get('/mine', requireAuth, async (req, res) => {
  const { data, error } = await adminDb
    .from('disputes')
    .select('*')
    .eq('reported_by_user_id', req.userId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data ?? []);
});

export default router;
