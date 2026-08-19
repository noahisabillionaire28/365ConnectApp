import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';

const router = Router();

/**
 * GET /api/workers — workers + people feed
 * Optional: ?role=worker&job_type=Bartender&lat=25.7&lng=-80.1
 */
router.get('/', async (req, res) => {
  const { role, job_type, limit = '50', offset = '0' } = req.query as Record<string, string>;
  try {
    const lim = parseInt(limit);
    const off = parseInt(offset);

    let q = adminDb
      .from('users')
      .select(
        'id, username, photo_url, role, bio, rating, is_pro, ' +
          'job_types, primary_job_type, secondary_job_types, certifications, ' +
          'lat, lng, company_name, created_at',
      )
      .neq('role', 'admin')
      .not('username', 'is', null);

    if (role) q = q.eq('role', role);
    if (job_type) {
      q = q.or(
        `primary_job_type.eq.${job_type},job_types.cs.{${job_type}},secondary_job_types.cs.{${job_type}}`,
      );
    }

    const { data, error } = await q
      .order('rating', { ascending: false })
      .order('created_at', { ascending: false })
      .range(off, off + lim - 1);

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data ?? []);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

export default router;
