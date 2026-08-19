import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { broadcastToUser } from '../lib/sseManager.js';

const router = Router();

/** GET /api/notifications — my notifications */
router.get('/', requireAuth, async (req, res) => {
  const { limit = '50' } = req.query as Record<string, string>;
  try {
    const { data: notifications, error } = await adminDb
      .from('notifications')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));
    if (error) return res.status(500).json({ error: error.message });

    const rows = notifications ?? [];
    const fromIds = [
      ...new Set(rows.map((n: any) => n.from_user_id).filter((id: any) => id != null)),
    ];
    let usersById = new Map<string, any>();
    if (fromIds.length) {
      const { data: users, error: usersError } = await adminDb
        .from('users')
        .select('id, username, photo_url')
        .in('id', fromIds);
      if (usersError) return res.status(500).json({ error: usersError.message });
      usersById = new Map((users ?? []).map((u: any) => [u.id, u]));
    }

    const merged = rows.map((n: any) => {
      const u = usersById.get(n.from_user_id);
      return {
        ...n,
        from_username: u?.username ?? null,
        from_photo_url: u?.photo_url ?? null,
      };
    });
    return res.json(merged);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** PATCH /api/notifications/:id/read — mark one read */
router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    const { error } = await adminDb
      .from('notifications')
      .update({ read_at: new Date().toISOString(), read: true })
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .is('read_at', null);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** PATCH /api/notifications/read-all — mark all read */
router.patch('/read-all', requireAuth, async (req, res) => {
  try {
    const { error } = await adminDb
      .from('notifications')
      .update({ read_at: new Date().toISOString(), read: true })
      .eq('user_id', req.userId)
      .is('read_at', null);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/**
 * Internal helper: insert a notification row and push it to the recipient via SSE.
 * Call from any route that needs to notify a user (applications, shift-requests, etc.)
 */
export async function createNotification(params: {
  userId:      string;
  fromUserId?: string | null;
  type:        string;
  title:       string;
  body:        string;
  shiftId?:    string | null;
}): Promise<void> {
  const { userId, fromUserId, type, title, body, shiftId } = params;
  try {
    const { data, error } = await adminDb
      .from('notifications')
      .insert({
        user_id: userId,
        from_user_id: fromUserId ?? null,
        type,
        title,
        body,
        shift_id: shiftId ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    // Push live to the recipient if they're online
    broadcastToUser(userId, 'new_notification', data);
  } catch (e) {
    // Notifications are non-critical — log but don't throw
    console.error('[createNotification] failed:', e);
  }
}

export default router;
