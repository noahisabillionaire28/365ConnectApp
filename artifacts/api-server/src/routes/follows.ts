import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/** GET /api/follows/roster — all users I follow (my roster) */
router.get('/roster', requireAuth, async (req, res) => {
  const { data: follows, error } = await adminDb
    .from('follows')
    .select('following_id, created_at')
    .eq('follower_id', req.userId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const ids = [...new Set((follows ?? []).map((f) => f.following_id).filter(Boolean))];
  const userMap = new Map<string, Record<string, unknown>>();
  if (ids.length) {
    const { data: users, error: uErr } = await adminDb
      .from('users')
      .select('id, username, photo_url, role, rating, job_types, primary_job_type, certifications, is_pro, company_name')
      .in('id', ids);
    if (uErr) return res.status(500).json({ error: uErr.message });
    for (const u of users ?? []) userMap.set(u.id, u);
  }

  const rows = (follows ?? [])
    .map((f) => {
      const u = userMap.get(f.following_id);
      if (!u) return null;
      return { ...u, followed_at: f.created_at };
    })
    .filter(Boolean);
  return res.json(rows);
});

/** GET /api/follows/status/:userId — am I following this user? */
router.get('/status/:userId', requireAuth, async (req, res) => {
  const { count, error } = await adminDb
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', req.userId)
    .eq('following_id', req.params.userId);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ following: (count ?? 0) > 0 });
});

/** GET /api/follows/followers/:userId — who follows this user */
router.get('/followers/:userId', async (req, res) => {
  const { data: follows, error } = await adminDb
    .from('follows')
    .select('follower_id')
    .eq('following_id', req.params.userId);
  if (error) return res.status(500).json({ error: error.message });

  const ids = [...new Set((follows ?? []).map((f) => f.follower_id).filter(Boolean))];
  if (!ids.length) return res.json([]);

  const { data: users, error: uErr } = await adminDb
    .from('users')
    .select('id, username, photo_url, role')
    .in('id', ids);
  if (uErr) return res.status(500).json({ error: uErr.message });
  return res.json(users ?? []);
});

/** GET /api/follows/counts/:userId — follower + following counts */
router.get('/counts/:userId', async (req, res) => {
  const id = req.params.userId;
  const [followers, following] = await Promise.all([
    adminDb.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', id),
    adminDb.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', id),
  ]);
  return res.json({ followers: followers.count ?? 0, following: following.count ?? 0 });
});

/** POST /api/follows — follow a user */
router.post('/', requireAuth, async (req, res) => {
  const { following_id } = req.body as { following_id: string };
  const { error } = await adminDb
    .from('follows')
    .upsert(
      { follower_id: req.userId, following_id },
      { onConflict: 'follower_id,following_id', ignoreDuplicates: true },
    );
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

/** DELETE /api/follows/:userId — unfollow */
router.delete('/:userId', requireAuth, async (req, res) => {
  const { error } = await adminDb
    .from('follows')
    .delete()
    .eq('follower_id', req.userId)
    .eq('following_id', req.params.userId);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

export default router;
