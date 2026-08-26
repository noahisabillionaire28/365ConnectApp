import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

/** GET /api/shifts — open shifts, optional filters */
router.get('/', async (req, res) => {
  const { job_type, status = 'open', limit = '50', offset = '0' } = req.query as Record<string, string>;
  const lim = parseInt(limit);
  const off = parseInt(offset);
  let q = adminDb.from('shifts').select('*').eq('status', status);
  if (job_type) {
    q = q.or(`job_type.eq.${job_type},job_types.cs.{${job_type}}`);
  }
  const { data: shifts, error } = await q
    .order('created_at', { ascending: false })
    .range(off, off + lim - 1);
  if (error) return res.status(500).json({ error: error.message });

  const clientIds = [...new Set((shifts ?? []).map((s: any) => s.client_id).filter(Boolean))];
  const userMap = new Map<string, any>();
  if (clientIds.length) {
    const { data: users, error: uErr } = await adminDb
      .from('users')
      .select('id, username, company_name, photo_url')
      .in('id', clientIds);
    if (uErr) return res.status(500).json({ error: uErr.message });
    for (const u of users ?? []) userMap.set(u.id, u);
  }

  const rows = (shifts ?? []).map((s: any) => {
    const u = userMap.get(s.client_id);
    return {
      ...s,
      client_username: u?.username ?? null,
      client_company: u?.company_name ?? null,
      client_photo_url: u?.photo_url ?? null,
    };
  });
  return res.json(rows);
});

/** GET /api/shifts/my — shifts posted by the current user (client) */
router.get('/my', requireAuth, async (req, res) => {
  const { data, error } = await adminDb
    .from('shifts')
    .select('*')
    .eq('client_id', req.userId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/shifts/:id — single shift */
router.get('/:id', async (req, res) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(404).json({ error: 'Not found' });
  }
  const { data: shift, error } = await adminDb
    .from('shifts')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!shift) return res.status(404).json({ error: 'Not found' });

  let u: any = null;
  if (shift.client_id) {
    const { data: user, error: uErr } = await adminDb
      .from('users')
      .select('id, username, company_name, photo_url, rating')
      .eq('id', shift.client_id)
      .maybeSingle();
    if (uErr) return res.status(500).json({ error: uErr.message });
    u = user;
  }

  return res.json({
    ...shift,
    client_username: u?.username ?? null,
    client_company: u?.company_name ?? null,
    client_photo_url: u?.photo_url ?? null,
    client_rating: u?.rating ?? null,
  });
});

/** POST /api/shifts — create shift */
router.post('/', requireAuth, requireRole('client', 'staffer'), async (req, res) => {
  const b = req.body as Record<string, unknown>;
  const payload = {
    client_id: req.userId,
    title: b.title,
    description: b.description ?? null,
    location: b.location ?? null,
    event_type: b.event_type ?? null,
    job_type: b.job_type,
    job_types: b.job_types ?? [],
    pay_rate: b.pay_rate ?? null,
    pay_period: b.pay_period ?? 'hr',
    start_time: b.start_time,
    end_time: b.end_time,
    spots_available: b.spots_available ?? 1,
    lat: b.lat ?? null,
    lng: b.lng ?? null,
    cover_image: b.cover_image ?? null,
    company_name: b.company_name ?? null,
    requirements: b.requirements ?? [],
    dress_code: b.dress_code ?? null,
    dress_code_items: b.dress_code_items ?? [],
    point_of_contact: b.point_of_contact ?? null,
    contact_phone: b.contact_phone ?? null,
    unit_info: b.unit_info ?? null,
    parking_notes: b.parking_notes ?? null,
    special_instructions: b.special_instructions ?? null,
    repeat_type: b.repeat_type ?? 'once',
  };
  const { data, error } = await adminDb
    .from('shifts')
    .insert(payload)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json(data);
});

/** PATCH /api/shifts/:id — update shift (owner only) */
router.patch('/:id', requireAuth, requireRole('client', 'staffer'), async (req, res) => {
  const allowed = [
    'title','description','location','event_type','job_type','job_types','pay_rate','pay_period',
    'start_time','end_time','spots_available','status','lat','lng','cover_image',
    'company_name','requirements','dress_code','dress_code_items',
    'point_of_contact','contact_phone','unit_info','parking_notes',
    'special_instructions','repeat_type',
  ];
  const body = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No valid fields' });

  const { data, error } = await adminDb
    .from('shifts')
    .update(updates)
    .eq('id', req.params.id)
    .eq('client_id', req.userId)
    .select()
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Not found or not authorized' });
  return res.json(data);
});

export default router;
