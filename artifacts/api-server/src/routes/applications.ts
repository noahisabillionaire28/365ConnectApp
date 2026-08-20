import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

/** Returns true if userId is the client that owns the given shift. */
async function ownsShift(userId: string, shiftId: string): Promise<boolean> {
  const { count } = await adminDb
    .from('shifts')
    .select('*', { count: 'exact', head: true })
    .eq('id', shiftId)
    .eq('client_id', userId);
  return (count ?? 0) > 0;
}

/** GET /api/applications?shift_id=&worker_id= */
router.get('/', requireAuth, async (req, res) => {
  const { shift_id, worker_id } = req.query as Record<string, string>;
  try {
    if (shift_id) {
      // Only the shift owner may see the applicants for their shift.
      if (!(await ownsShift(req.userId!, shift_id))) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const { data: apps, error } = await adminDb
        .from('applications')
        .select('*')
        .eq('shift_id', shift_id)
        .order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });

      const workerIds = [...new Set((apps ?? []).map((a) => a.worker_id))];
      const { data: users, error: uErr } = await adminDb
        .from('users')
        .select(
          'id, username, photo_url, rating, job_types, primary_job_type, certifications, bio',
        )
        .in('id', workerIds);
      if (uErr) return res.status(500).json({ error: uErr.message });

      const userMap = new Map((users ?? []).map((u) => [u.id, u]));
      const merged = (apps ?? []).map((a) => {
        const u = userMap.get(a.worker_id);
        return {
          ...a,
          username: u?.username ?? null,
          photo_url: u?.photo_url ?? null,
          rating: u?.rating ?? null,
          job_types: u?.job_types ?? null,
          primary_job_type: u?.primary_job_type ?? null,
          certifications: u?.certifications ?? null,
          bio: u?.bio ?? null,
        };
      });
      return res.json(merged);
    }
    // Any other listing is scoped to the caller's own applications only.
    // (An explicit worker_id belonging to someone else is not honoured.)
    if (worker_id && worker_id !== 'me' && worker_id !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { data: apps, error } = await adminDb
      .from('applications')
      .select('*')
      .eq('worker_id', req.userId)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    const shiftIds = [...new Set((apps ?? []).map((a) => a.shift_id))];
    const { data: shifts, error: sErr } = await adminDb
      .from('shifts')
      .select(
        'id, title, job_type, start_time, end_time, location, pay_rate, pay_period, company_name',
      )
      .in('id', shiftIds);
    if (sErr) return res.status(500).json({ error: sErr.message });

    const shiftMap = new Map((shifts ?? []).map((s) => [s.id, s]));
    const merged = (apps ?? []).map((a) => {
      const s = shiftMap.get(a.shift_id);
      return {
        ...a,
        title: s?.title ?? null,
        job_type: s?.job_type ?? null,
        start_time: s?.start_time ?? null,
        end_time: s?.end_time ?? null,
        location: s?.location ?? null,
        pay_rate: s?.pay_rate ?? null,
        pay_period: s?.pay_period ?? null,
        company_name: s?.company_name ?? null,
      };
    });
    return res.json(merged);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** GET /api/applications/status/:shiftId - caller's own status for a shift */
router.get('/status/:shiftId', requireAuth, async (req, res) => {
  try {
    const { data, error } = await adminDb
      .from('applications')
      .select('status')
      .eq('shift_id', req.params.shiftId)
      .eq('worker_id', req.userId)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ status: data?.status ?? null });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** GET /api/applications/my-shift-ids - set of shift IDs I've applied to */
router.get('/my-shift-ids', requireAuth, async (req, res) => {
  try {
    const { data, error } = await adminDb
      .from('applications')
      .select('shift_id, status')
      .eq('worker_id', req.userId);
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** POST /api/applications - a worker applies to a shift (always as themselves, pending) */
router.post('/', requireAuth, requireRole('worker'), async (req, res) => {
  const { shift_id, match_score, message } = req.body as Record<string, unknown>;
  try {
    const { data, error } = await adminDb
      .from('applications')
      .upsert(
        {
          shift_id,
          worker_id: req.userId,
          status: 'pending',
          match_score: match_score ?? null,
          message: message ?? null,
        },
        { onConflict: 'shift_id,worker_id', ignoreDuplicates: true },
      )
      .select()
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(409).json({ error: 'Already applied' });
    return res.status(201).json(data);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/**
 * PATCH /api/applications/:id - update an application's status.
 * The applicant (worker) may only 'withdraw' their own application.
 * The shift's owning client may accept/reject/decline or reset to pending.
 */
router.patch('/:id', requireAuth, async (req, res) => {
  const { status } = req.body as { status: string };
  const validStatuses = ['pending', 'accepted', 'rejected', 'declined', 'withdrawn'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    const { data: appRow, error: aErr } = await adminDb
      .from('applications')
      .select('worker_id, shift_id')
      .eq('id', req.params.id)
      .maybeSingle();
    if (aErr) return res.status(500).json({ error: aErr.message });
    if (!appRow) return res.status(404).json({ error: 'Not found' });

    const { data: shiftRow, error: sErr } = await adminDb
      .from('shifts')
      .select('client_id')
      .eq('id', appRow.shift_id)
      .maybeSingle();
    if (sErr) return res.status(500).json({ error: sErr.message });

    const app = { worker_id: appRow.worker_id, client_id: shiftRow?.client_id };

    const isApplicant = app.worker_id === req.userId;
    const isShiftOwner = app.client_id === req.userId;

    if (isApplicant && !isShiftOwner) {
      // Workers may only withdraw their own application, never self-accept.
      if (status !== 'withdrawn') {
        return res.status(403).json({ error: 'Workers may only withdraw an application' });
      }
    } else if (!isShiftOwner) {
      // Neither the applicant nor the shift owner.
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { data, error } = await adminDb
      .from('applications')
      .update({ status })
      .eq('id', req.params.id)
      .select()
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Not found' });
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/**
 * POST /api/applications/assign - directly assign a worker to a shift.
 * Only the shift's owning client (or a staffer acting for them) may do this.
 */
router.post('/assign', requireAuth, requireRole('client', 'staffer'), async (req, res) => {
  const { shift_id, worker_id } = req.body as Record<string, string>;
  if (!shift_id || !worker_id) {
    return res.status(400).json({ error: 'shift_id and worker_id are required' });
  }
  try {
    // Clients may only assign on shifts they own. Staffers may assign on any shift.
    if (req.userRole === 'client' && !(await ownsShift(req.userId!, shift_id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { data, error } = await adminDb
      .from('applications')
      .upsert(
        { shift_id, worker_id, status: 'accepted' },
        { onConflict: 'shift_id,worker_id' },
      )
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

export default router;
