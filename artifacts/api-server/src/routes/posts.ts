import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/** GET /api/posts/:userId — posts by a user */
router.get('/:userId', async (req, res) => {
  const { data, error } = await adminDb
    .from('posts')
    .select('*')
    .eq('user_id', req.params.userId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data ?? []);
});

/** POST /api/posts — create post */
router.post('/', requireAuth, async (req, res) => {
  const { image_url, caption } = req.body as Record<string, unknown>;
  const { data, error } = await adminDb
    .from('posts')
    .insert({ user_id: req.userId, image_url: image_url ?? null, caption: caption ?? null })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json(data);
});

export default router;
