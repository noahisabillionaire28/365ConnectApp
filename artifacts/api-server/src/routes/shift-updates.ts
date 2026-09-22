import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createNotification } from './notifications.js';
import { sendError } from '../lib/httpError.js';
import { assertShiftOwner } from '../lib/shiftAccess.js';
import { getRoleInfo } from '../lib/roleCache.js';

const router = Router();

async function ownsShift(userId: string, shiftId: string): Promise<boolean> {
  const { count } = await adminDb
    .from('shifts').select('*', { count: 'exact', head: true })
    .eq('id', shiftId).eq('client_id', userId);
  return (count ?? 0) > 0;
}

/** GET /api/shift-updates/:shiftId — updates for a shift (owner or booked worker). */
router.get('/:shiftId', requireAuth, async (req, res) => {
  const shiftId = String(req.params.shiftId);
  // Access: shift owner, a booked worker, or an admin.
  const owner = await ownsShift(req.userId!, shiftId);
  let allowed = owner;
  if (!allowed) {
    const { count } = await adminDb
      .from('applications').select('*', { count: 'exact', head: true })
      .eq('shift_id', shiftId).eq('worker_id', req.userId).eq('status', 'accepted');
    allowed = (count ?? 0) > 0;
  }
  if (!allowed) allowed = (await getRoleInfo(req.userId!)).isAdmin;
  if (!allowed) return res.status(403).json({ error: 'Forbidden' });

  const { data: rows, error } = await adminDb
    .from('shift_updates').select('*').eq('shift_id', shiftId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const authorIds = [...new Set((rows ?? []).map((r) => r.author_id))];
  const { data: authors } = authorIds.length
    ? await adminDb.from('users').select('id, username, photo_url').in('id', authorIds)
    : { data: [] as Array<Record<string, unknown>> };
  const map = new Map((authors ?? []).map((u) => [u.id, u]));
  return res.json((rows ?? []).map((r) => ({
    ...r,
    author_username: map.get(r.author_id)?.username ?? null,
    author_photo_url: map.get(r.author_id)?.photo_url ?? null,
  })));
});

/** POST /api/shift-updates { shift_id, body, kind } — the shift owner (or admin) posts an update. */
router.post('/', requireAuth, requireRole('client', 'staffer'), async (req, res) => {
  const { shift_id, body, kind } = req.body as { shift_id?: string; body?: string; kind?: string };
  if (!shift_id || !body?.trim()) return res.status(400).json({ error: 'shift_id and body are required' });
  const k = kind === 'announcement' ? 'announcement' : 'update';

  try {
    const shift = await assertShiftOwner(shift_id, req.userId!);

    const { data, error } = await adminDb
      .from('shift_updates')
      .insert({ shift_id, author_id: req.userId, kind: k, body: body.trim() })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });

    // Notify every booked (accepted) worker.
    const { data: booked } = await adminDb
      .from('applications').select('worker_id').eq('shift_id', shift_id).eq('status', 'accepted');
    const label = shift.title ? `"${shift.title}"` : 'your shift';
    await Promise.all((booked ?? []).map((b) =>
      createNotification({
        userId: b.worker_id,
        fromUserId: req.userId,
        type: k === 'announcement' ? 'shift_announcement' : 'shift_update',
        title: k === 'announcement' ? 'Announcement' : 'Shift update',
        body: `${label}: ${body.trim().slice(0, 80)}`,
        shiftId: shift_id,
      }),
    ));
    return res.status(201).json(data);
  } catch (e) {
    return sendError(res, e);
  }
});

export default router;
