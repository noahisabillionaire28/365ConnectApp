import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { createNotification } from './notifications.js';

const router = Router();

/** A user's @handle for notification copy, or a neutral fallback. */
async function handleFor(id: string): Promise<string> {
  const { data } = await adminDb.from('users').select('username').eq('id', id).maybeSingle();
  return data?.username ? `@${data.username}` : 'Someone';
}

/** Enrich raw post rows with author + like/comment counts + liked-by-viewer. */
async function enrichPosts(
  rows: Array<Record<string, unknown>>,
  viewerId: string | undefined,
): Promise<Array<Record<string, unknown>>> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id as string);
  const authorIds = [...new Set(rows.map((r) => r.user_id as string))];

  const { data: users } = await adminDb
    .from('users').select('id, username, photo_url').in('id', authorIds);
  const userMap = new Map((users ?? []).map((u) => [u.id, u]));

  const likeCount = new Map<string, number>();
  const commentCount = new Map<string, number>();
  const likedByMe = new Set<string>();

  const { data: likes } = await adminDb
    .from('post_likes').select('post_id, user_id').in('post_id', ids);
  for (const l of likes ?? []) {
    likeCount.set(l.post_id, (likeCount.get(l.post_id) ?? 0) + 1);
    if (viewerId && l.user_id === viewerId) likedByMe.add(l.post_id);
  }
  const { data: comments } = await adminDb
    .from('post_comments').select('post_id').in('post_id', ids);
  for (const c of comments ?? []) {
    commentCount.set(c.post_id, (commentCount.get(c.post_id) ?? 0) + 1);
  }

  return rows.map((r) => {
    const u = userMap.get(r.user_id as string);
    return {
      ...r,
      author_username: u?.username ?? null,
      author_photo_url: u?.photo_url ?? null,
      like_count: likeCount.get(r.id as string) ?? 0,
      comment_count: commentCount.get(r.id as string) ?? 0,
      liked_by_me: likedByMe.has(r.id as string),
    };
  });
}

/* ── GET /api/posts/feed — global content feed (must precede /:userId) ──────── */
router.get('/feed', requireAuth, async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? '30')) || 30, 50);
  const offset = parseInt(String(req.query.offset ?? '0')) || 0;
  const { data, error } = await adminDb
    .from('posts')
    .select('*')
    .not('photo_url', 'is', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) return res.status(500).json({ error: error.message });
  return res.json(await enrichPosts(data ?? [], req.userId));
});

/* ── GET /api/posts/detail/:postId — single post (must precede /:userId) ────── */
router.get('/detail/:postId', requireAuth, async (req, res) => {
  const { data, error } = await adminDb
    .from('posts').select('*').eq('id', req.params.postId).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Post not found' });
  const [enriched] = await enrichPosts([data], req.userId);
  return res.json(enriched);
});

/* ── POST /api/posts/:postId/like — toggle a like ──────────────────────────── */
router.post('/:postId/like', requireAuth, async (req, res) => {
  const postId = req.params.postId;
  const { data: post } = await adminDb
    .from('posts').select('user_id').eq('id', postId).maybeSingle();
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const { data: existing } = await adminDb
    .from('post_likes').select('id').eq('post_id', postId).eq('user_id', req.userId).maybeSingle();

  let liked: boolean;
  if (existing) {
    await adminDb.from('post_likes').delete().eq('id', existing.id);
    liked = false;
  } else {
    const { error } = await adminDb.from('post_likes').insert({ post_id: postId, user_id: req.userId });
    if (error) return res.status(500).json({ error: error.message });
    liked = true;
    if (post.user_id !== req.userId) {
      await createNotification({
        userId: post.user_id, fromUserId: req.userId, type: 'post_like',
        title: 'New like', body: `${await handleFor(req.userId!)} liked your post.`, postId,
      });
    }
  }
  const { count } = await adminDb
    .from('post_likes').select('*', { count: 'exact', head: true }).eq('post_id', postId);
  return res.json({ liked, like_count: count ?? 0 });
});

/* ── GET /api/posts/:postId/comments — list comments ───────────────────────── */
router.get('/:postId/comments', async (req, res) => {
  const { data: rows, error } = await adminDb
    .from('post_comments').select('*').eq('post_id', req.params.postId)
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  const authorIds = [...new Set((rows ?? []).map((c) => c.user_id))];
  const { data: users } = authorIds.length
    ? await adminDb.from('users').select('id, username, photo_url').in('id', authorIds as string[])
    : { data: [] as Array<Record<string, unknown>> };
  const userMap = new Map((users ?? []).map((u) => [u.id, u]));
  return res.json((rows ?? []).map((c) => ({
    ...c,
    author_username: userMap.get(c.user_id)?.username ?? null,
    author_photo_url: userMap.get(c.user_id)?.photo_url ?? null,
  })));
});

/* ── POST /api/posts/:postId/comments — add a comment ──────────────────────── */
router.post('/:postId/comments', requireAuth, async (req, res) => {
  const body = String((req.body?.body ?? '')).trim();
  if (!body) return res.status(400).json({ error: 'Comment cannot be empty' });
  if (body.length > 1000) return res.status(400).json({ error: 'Comment is too long' });
  const postId = req.params.postId;

  const { data: post } = await adminDb
    .from('posts').select('user_id').eq('id', postId).maybeSingle();
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const { data, error } = await adminDb
    .from('post_comments').insert({ post_id: postId, user_id: req.userId, body })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });

  if (post.user_id !== req.userId) {
    await createNotification({
      userId: post.user_id, fromUserId: req.userId, type: 'post_comment',
      title: 'New comment', body: `${await handleFor(req.userId!)} commented: ${body.slice(0, 60)}`,
      postId,
    });
  }
  const { data: me } = await adminDb
    .from('users').select('username, photo_url').eq('id', req.userId).maybeSingle();
  return res.status(201).json({
    ...data,
    author_username: me?.username ?? null,
    author_photo_url: me?.photo_url ?? null,
  });
});

/* ── DELETE /api/posts/:postId — author or admin (moderation) ───────────────── */
router.delete('/:postId', requireAuth, async (req, res) => {
  const { data: post } = await adminDb
    .from('posts').select('user_id').eq('id', req.params.postId).maybeSingle();
  if (!post) return res.status(404).json({ error: 'Not found' });
  let allowed = post.user_id === req.userId;
  if (!allowed) {
    const { data: me } = await adminDb.from('users').select('role').eq('id', req.userId).maybeSingle();
    allowed = me?.role === 'admin';
  }
  if (!allowed) return res.status(403).json({ error: 'Forbidden' });
  const { error } = await adminDb.from('posts').delete().eq('id', req.params.postId);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

/* ── GET /api/posts/:userId — posts by a user (keep LAST: greedy match) ─────── */
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
  // Accept either field name — the client sends photo_url; image_url kept for compat.
  const { image_url, photo_url, caption } = req.body as Record<string, unknown>;
  const { data, error } = await adminDb
    .from('posts')
    .insert({ user_id: req.userId, photo_url: (photo_url ?? image_url) ?? null, caption: caption ?? null })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json(data);
});

export default router;
