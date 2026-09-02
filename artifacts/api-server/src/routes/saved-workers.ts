import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/** GET /api/saved-workers — the caller's saved workers, enriched with profile info */
router.get('/', requireAuth, async (req, res) => {
  const { data: rows, error } = await adminDb
    .from('saved_workers')
    .select('worker_id, created_at')
    .eq('owner_id', req.userId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const ids = [...new Set((rows ?? []).map((r) => r.worker_id))];
  if (!ids.length) return res.json([]);

  const { data: users, error: uErr } = await adminDb
    .from('users')
    .select('id, username, photo_url, role, rating, primary_job_type, job_types, hourly_rate, bio, is_pro')
    .in('id', ids);
  if (uErr) return res.status(500).json({ error: uErr.message });
  const map = new Map((users ?? []).map((u) => [u.id, u]));
  return res.json(
    (rows ?? [])
      .map((r) => { const u = map.get(r.worker_id); return u ? { ...u, saved_at: r.created_at } : null; })
      .filter(Boolean),
  );
});

/** GET /api/saved-workers/status/:workerId — is this worker saved by the caller? */
router.get('/status/:workerId', requireAuth, async (req, res) => {
  const { count, error } = await adminDb
    .from('saved_workers')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', req.userId)
    .eq('worker_id', req.params.workerId);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ saved: (count ?? 0) > 0 });
});

/** POST /api/saved-workers { worker_id } — save a worker */
router.post('/', requireAuth, async (req, res) => {
  const { worker_id } = req.body as { worker_id: string };
  if (!worker_id) return res.status(400).json({ error: 'worker_id is required' });
  const { error } = await adminDb
    .from('saved_workers')
    .upsert({ owner_id: req.userId, worker_id }, { onConflict: 'owner_id,worker_id', ignoreDuplicates: true });
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ saved: true });
});

/** DELETE /api/saved-workers/:workerId — unsave a worker */
router.delete('/:workerId', requireAuth, async (req, res) => {
  const { error } = await adminDb
    .from('saved_workers')
    .delete()
    .eq('owner_id', req.userId)
    .eq('worker_id', req.params.workerId);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ saved: false });
});

export default router;
