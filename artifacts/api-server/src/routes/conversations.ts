import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * Fetch the participant/shift rows referenced by a set of conversations and
 * merge them back onto each conversation as flat aliased fields, reproducing
 * the shape of the original LEFT JOINs (two-queries + merge in JS).
 */
async function enrichConversations(
  convs: Array<Record<string, any>>,
  includeRole: boolean,
): Promise<Array<Record<string, any>>> {
  const userIds = new Set<string>();
  const shiftIds = new Set<string>();
  for (const c of convs) {
    if (c.participant_a_id) userIds.add(c.participant_a_id);
    if (c.participant_b_id) userIds.add(c.participant_b_id);
    if (c.shift_id) shiftIds.add(c.shift_id);
  }

  const userMap = new Map<string, any>();
  if (userIds.size) {
    const { data: users } = await adminDb
      .from('users')
      .select('id, username, photo_url, role')
      .in('id', [...userIds]);
    for (const u of users ?? []) userMap.set(u.id, u);
  }

  const shiftMap = new Map<string, any>();
  if (shiftIds.size) {
    const { data: shifts } = await adminDb
      .from('shifts')
      .select('id, title')
      .in('id', [...shiftIds]);
    for (const s of shifts ?? []) shiftMap.set(s.id, s);
  }

  return convs.map((c) => {
    const pa = c.participant_a_id ? userMap.get(c.participant_a_id) ?? null : null;
    const pb = c.participant_b_id ? userMap.get(c.participant_b_id) ?? null : null;
    const s = c.shift_id ? shiftMap.get(c.shift_id) ?? null : null;
    const obj: Record<string, any> = { ...c };
    obj.participant_a_username = pa?.username ?? null;
    obj.participant_a_photo = pa?.photo_url ?? null;
    if (includeRole) obj.participant_a_role = pa?.role ?? null;
    obj.participant_b_username = pb?.username ?? null;
    obj.participant_b_photo = pb?.photo_url ?? null;
    if (includeRole) obj.participant_b_role = pb?.role ?? null;
    obj.shift_title = s?.title ?? null;
    return obj;
  });
}

/** GET /api/conversations — my conversations with user+shift info */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data: convs, error } = await adminDb
      .from('conversations')
      .select('*')
      .or(`participant_a_id.eq.${req.userId},participant_b_id.eq.${req.userId}`)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    const rows = await enrichConversations(convs ?? [], true);
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** POST /api/conversations — get or create a DM between two users */
router.post('/', requireAuth, async (req, res) => {
  const { other_user_id, shift_id } = req.body as Record<string, string | undefined>;
  const myId = req.userId!;
  const otherId = other_user_id;
  if (!otherId) return res.status(400).json({ error: 'other_user_id required' });

  // Look for an existing conversation for this (pair[, shift]) — mirrors the
  // original find query for both the shift and no-shift cases.
  const findConversation = async () => {
    let q = adminDb.from('conversations').select('*');
    q = shift_id ? q.eq('shift_id', shift_id) : q.is('shift_id', null);
    q = q.or(
      `and(participant_a_id.eq.${myId},participant_b_id.eq.${otherId}),` +
        `and(participant_a_id.eq.${otherId},participant_b_id.eq.${myId})`,
    );
    const { data } = await q.limit(1).maybeSingle();
    return data;
  };

  try {
    // Try to find existing
    const existing = await findConversation();
    if (existing) return res.json(existing);

    // Create new. The original relied on ON CONFLICT DO NOTHING against the
    // expression-based partial unique indexes (LEAST/GREATEST[, shift]); those
    // cannot be targeted by an upsert, so we insert plainly and, on a
    // unique-violation race, re-fetch the winning row (same effect).
    const { data: inserted, error } = await adminDb
      .from('conversations')
      .insert({ participant_a_id: myId, participant_b_id: otherId, shift_id: shift_id ?? null })
      .select()
      .maybeSingle();

    if (error) {
      const raced = await findConversation();
      if (raced) return res.json(raced);
      return res.status(500).json({ error: error.message });
    }
    if (!inserted) {
      const raced = await findConversation();
      return res.json(raced);
    }
    return res.status(201).json(inserted);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** GET /api/conversations/:id — single conversation */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data: conv, error } = await adminDb
      .from('conversations')
      .select('*')
      .eq('id', req.params.id)
      .or(`participant_a_id.eq.${req.userId},participant_b_id.eq.${req.userId}`)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!conv) return res.status(404).json({ error: 'Not found' });
    const [row] = await enrichConversations([conv], false);
    return res.json(row);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

export default router;
