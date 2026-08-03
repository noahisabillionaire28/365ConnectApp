import { Router } from 'express';
import { pool } from '@workspace/db';

const router = Router();

/**
 * GET /api/workers — workers + people feed
 * Optional: ?role=worker&job_type=Bartender&lat=25.7&lng=-80.1
 */
router.get('/', async (req, res) => {
  const { role, job_type, limit = '50', offset = '0' } = req.query as Record<string, string>;
  try {
    const conditions: string[] = ["u.role <> 'admin'"];
    const values: unknown[] = [];
    let idx = 1;
    if (role) { conditions.push(`u.role = $${idx++}`); values.push(role); }
    if (job_type) {
      conditions.push(`(u.primary_job_type = $${idx} OR $${idx} = ANY(u.job_types) OR $${idx} = ANY(u.secondary_job_types))`);
      values.push(job_type); idx++;
    }
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.photo_url, u.role, u.bio,
              u.rating::float AS rating, u.is_pro,
              u.job_types, u.primary_job_type, u.secondary_job_types, u.certifications,
              u.lat, u.lng, u.company_name, u.created_at
       FROM users u
       WHERE ${conditions.join(' AND ')}
         AND u.username IS NOT NULL
       ORDER BY u.rating DESC, u.created_at DESC
       LIMIT $${idx} OFFSET $${idx+1}`,
      [...values, parseInt(limit), parseInt(offset)],
    );
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

export default router;
