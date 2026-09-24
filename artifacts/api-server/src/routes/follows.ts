import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { createNotification } from './notifications.js';

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

/**
 * GET /api/follows/followers/:userId — who follows this user. For a worker
 * these are the clients and agencies whose roster they are on.
 */
router.get('/followers/:userId', async (req, res) => {
  const { data: follows, error } = await adminDb
    .from('follows')
    .select('follower_id, created_at')
    .eq('following_id', req.params.userId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const ids = [...new Set((follows ?? []).map((f) => f.follower_id).filter(Boolean))];
  if (!ids.length) return res.json([]);

  const { data: users, error: uErr } = await adminDb
    .from('users')
    .select('id, username, photo_url, role, company_name')
    .in('id', ids);
  if (uErr) return res.status(500).json({ error: uErr.message });
  const byId = new Map((users ?? []).map((u) => [u.id, u]));
  return res.json(
    (follows ?? [])
      .map((f) => { const u = byId.get(f.follower_id); return u ? { ...u, followed_at: f.created_at } : null; })
      .filter(Boolean),
  );
});

/**
 * DELETE /api/follows/followers/:followerId — leave someone's roster: removes
 * the follow where they follow ME. A worker's way out of an agency's list.
 */
router.delete('/followers/:followerId', requireAuth, async (req, res) => {
  const { error } = await adminDb
    .from('follows')
    .delete()
    .eq('follower_id', req.params.followerId)
    .eq('following_id', req.userId);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
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

/** POST /api/follows — follow a worker (self-follow and non-workers are rejected) */
router.post('/', requireAuth, async (req, res) => {
  const { following_id } = req.body as { following_id?: string };
  if (!following_id || typeof following_id !== 'string') {
    return res.status(400).json({ error: 'following_id is required' });
  }
  if (following_id === req.userId) return res.status(409).json({ error: "You can't follow yourself." });

  const { data: target, error: tErr } = await adminDb
    .from('users').select('id, role').eq('id', following_id).maybeSingle();
  if (tErr) return res.status(500).json({ error: tErr.message });
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.role !== 'worker') return res.status(409).json({ error: 'You can only follow workers.' });

  const { data: inserted, error } = await adminDb
    .from('follows')
    .upsert(
      { follower_id: req.userId, following_id },
      { onConflict: 'follower_id,following_id', ignoreDuplicates: true },
    )
    .select('follower_id')
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });

  // A new roster entry: tell the worker who listed them (once, not on re-follows).
  if (inserted) {
    const { data: me } = await adminDb
      .from('users').select('username, company_name, role').eq('id', req.userId).maybeSingle();
    const who = me?.company_name || (me?.username ? `@${me.username}` : me?.role === 'staffer' ? 'An agency' : 'A client');
    await createNotification({
      userId: following_id,
      fromUserId: req.userId,
      type: 'new_follower',
      title: 'Added to a roster',
      body: `${who} added you to their roster. They can offer you their shifts directly; you can leave the roster from your profile.`,
      url: '/profile',
    });
  }
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
