import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

type StoryRow = {
  id: string;
  user_id: string;
  photo_url: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
};

/**
 * GET /api/stories — the viewer's story tray.
 *
 * Returns one group per author who has at least one active (non-expired) story,
 * from the people the viewer follows plus the viewer themselves. Each group is
 * ordered oldest→newest so the viewer plays them in sequence. Ordering of the
 * groups: your own first, then groups with unseen stories, then fully-seen —
 * newest activity first within each band (Instagram behaviour).
 */
router.get('/', requireAuth, async (req, res) => {
  const me = req.userId!;
  const nowIso = new Date().toISOString();

  // Who to show: everyone I follow + myself.
  const { data: follows, error: fErr } = await adminDb
    .from('follows').select('following_id').eq('follower_id', me);
  if (fErr) return res.status(500).json({ error: fErr.message });
  const authorIds = [...new Set([me, ...(follows ?? []).map((f) => f.following_id)])];

  const { data: stories, error: sErr } = await adminDb
    .from('stories')
    .select('id, user_id, photo_url, caption, created_at, expires_at')
    .in('user_id', authorIds)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: true });
  if (sErr) return res.status(500).json({ error: sErr.message });

  const rows = (stories ?? []) as StoryRow[];
  if (!rows.length) return res.json([]);

  // Which of these stories has the viewer already seen?
  const storyIds = rows.map((r) => r.id);
  const { data: views } = await adminDb
    .from('story_views').select('story_id').eq('viewer_id', me).in('story_id', storyIds);
  const seen = new Set((views ?? []).map((v) => v.story_id));

  // Author profiles for the ring avatars.
  const uniqueAuthors = [...new Set(rows.map((r) => r.user_id))];
  const { data: users } = await adminDb
    .from('users').select('id, username, photo_url, is_pro').in('id', uniqueAuthors);
  const userMap = new Map((users ?? []).map((u) => [u.id, u]));

  // Group by author.
  const groups = new Map<string, {
    user_id: string; username: string | null; photo_url: string | null;
    is_pro: boolean; is_me: boolean; has_unseen: boolean;
    latest_at: string; stories: Array<StoryRow & { viewed_by_me: boolean }>;
  }>();

  for (const r of rows) {
    const u = userMap.get(r.user_id);
    let g = groups.get(r.user_id);
    if (!g) {
      g = {
        user_id: r.user_id,
        username: u?.username ?? null,
        photo_url: u?.photo_url ?? null,
        is_pro: !!u?.is_pro,
        is_me: r.user_id === me,
        has_unseen: false,
        latest_at: r.created_at,
        stories: [],
      };
      groups.set(r.user_id, g);
    }
    const viewed = seen.has(r.id);
    g.stories.push({ ...r, viewed_by_me: viewed });
    if (!viewed) g.has_unseen = true;
    if (r.created_at > g.latest_at) g.latest_at = r.created_at;
  }

  const ordered = [...groups.values()].sort((a, b) => {
    if (a.is_me !== b.is_me) return a.is_me ? -1 : 1;              // me first
    if (a.has_unseen !== b.has_unseen) return a.has_unseen ? -1 : 1; // unseen next
    return b.latest_at.localeCompare(a.latest_at);                 // newest activity
  });

  return res.json(ordered);
});

/** POST /api/stories { photo_url, caption? } — post a story (expires in 24h). */
router.post('/', requireAuth, async (req, res) => {
  const { photo_url, caption } = req.body as { photo_url?: string; caption?: string };
  if (!photo_url) return res.status(400).json({ error: 'photo_url is required' });
  const { data, error } = await adminDb
    .from('stories')
    .insert({ user_id: req.userId, photo_url, caption: caption?.trim() || null })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json(data);
});

/** POST /api/stories/:storyId/view — mark a story as seen by the viewer. */
router.post('/:storyId/view', requireAuth, async (req, res) => {
  const { error } = await adminDb
    .from('story_views')
    .upsert(
      { story_id: req.params.storyId, viewer_id: req.userId },
      { onConflict: 'story_id,viewer_id', ignoreDuplicates: true },
    );
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

/** GET /api/stories/:storyId/viewers — who saw this story (author only). */
router.get('/:storyId/viewers', requireAuth, async (req, res) => {
  const { data: story } = await adminDb
    .from('stories').select('user_id').eq('id', req.params.storyId).maybeSingle();
  if (!story) return res.status(404).json({ error: 'Story not found' });
  if (story.user_id !== req.userId) return res.status(403).json({ error: 'Forbidden' });

  const { data: views } = await adminDb
    .from('story_views').select('viewer_id, created_at')
    .eq('story_id', req.params.storyId).order('created_at', { ascending: false });
  const ids = [...new Set((views ?? []).map((v) => v.viewer_id))];
  if (!ids.length) return res.json([]);
  const { data: users } = await adminDb
    .from('users').select('id, username, photo_url').in('id', ids);
  const map = new Map((users ?? []).map((u) => [u.id, u]));
  return res.json((views ?? []).map((v) => ({
    ...map.get(v.viewer_id), viewed_at: v.created_at,
  })).filter((v) => v.id));
});

/** DELETE /api/stories/:storyId — remove your own story. */
router.delete('/:storyId', requireAuth, async (req, res) => {
  const { data: story } = await adminDb
    .from('stories').select('user_id').eq('id', req.params.storyId).maybeSingle();
  if (!story) return res.status(404).json({ error: 'Not found' });
  if (story.user_id !== req.userId) return res.status(403).json({ error: 'Forbidden' });
  const { error } = await adminDb.from('stories').delete().eq('id', req.params.storyId);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

export default router;
