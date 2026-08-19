import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

/** GET /api/shift-requests — my shift requests (worker or client) */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data: requests, error } = await adminDb
      .from('shift_requests')
      .select('*')
      .or(`worker_id.eq.${req.userId},client_id.eq.${req.userId}`)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    const rows = requests ?? [];
    const shiftIds = [...new Set(rows.map((r: any) => r.shift_id).filter((id: any) => id != null))];
    const workerIds = [...new Set(rows.map((r: any) => r.worker_id).filter((id: any) => id != null))];

    let shiftsById = new Map<string, any>();
    if (shiftIds.length) {
      const { data: shifts, error: shiftsError } = await adminDb
        .from('shifts')
        .select('id, title, job_type, start_time, end_time, location, pay_rate, company_name')
        .in('id', shiftIds);
      if (shiftsError) return res.status(500).json({ error: shiftsError.message });
      shiftsById = new Map((shifts ?? []).map((s: any) => [s.id, s]));
    }

    let workersById = new Map<string, any>();
    if (workerIds.length) {
      const { data: workers, error: workersError } = await adminDb
        .from('users')
        .select('id, username, photo_url')
        .in('id', workerIds);
      if (workersError) return res.status(500).json({ error: workersError.message });
      workersById = new Map((workers ?? []).map((w: any) => [w.id, w]));
    }

    const merged = rows.map((r: any) => {
      const s = shiftsById.get(r.shift_id);
      const w = workersById.get(r.worker_id);
      return {
        ...r,
        shift_title: s?.title ?? null,
        job_type: s?.job_type ?? null,
        start_time: s?.start_time ?? null,
        end_time: s?.end_time ?? null,
        location: s?.location ?? null,
        pay_rate: s?.pay_rate ?? null,
        company_name: s?.company_name ?? null,
        worker_username: w?.username ?? null,
        worker_photo: w?.photo_url ?? null,
      };
    });
    return res.json(merged);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** POST /api/shift-requests — create a shift request (client invites worker) */
router.post('/', requireAuth, requireRole('client', 'staffer'), async (req, res) => {
  const { shift_id, worker_id, message } = req.body as Record<string, string>;
  try {
    const { data, error } = await adminDb
      .from('shift_requests')
      .upsert(
        {
          shift_id,
          client_id: req.userId,
          worker_id,
          message: message ?? null,
        },
        { onConflict: 'shift_id,worker_id', ignoreDuplicates: true },
      )
      .select()
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(409).json({ error: 'Request already exists' });
    return res.status(201).json(data);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** PATCH /api/shift-requests/:id — accept or decline (worker only) */
router.patch('/:id', requireAuth, async (req, res) => {
  const { status } = req.body as { status: 'accepted' | 'declined' };
  if (!['accepted','declined'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    const { data, error } = await adminDb
      .from('shift_requests')
      .update({ status })
      .eq('id', req.params.id)
      .eq('worker_id', req.userId)
      .eq('status', 'pending')
      .select()
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Not found, already decided, or not authorized' });
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

export default router;
