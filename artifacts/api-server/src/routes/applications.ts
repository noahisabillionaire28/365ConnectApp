import { Router } from 'express';
import { pool } from '@workspace/db';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

/** Returns true if userId is the client that owns the given shift. */
async function ownsShift(userId: string, shiftId: string): Promise<boolean> {
  const { rows } = await pool.query(
    'SELECT 1 FROM shifts WHERE id = $1 AND client_id = $2',
    [shiftId, userId],
  );
  return rows.length > 0;
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
      const { rows } = await pool.query(
        `SELECT a.*, u.username, u.photo_url, u.rating, u.job_types,
                u.primary_job_type, u.certifications, u.bio
           FROM applications a JOIN users u ON u.id = a.worker_id
          WHERE a.shift_id = $1
          ORDER BY a.created_at DESC`,
        [shift_id],
      );
      return res.json(rows);
    }
    // Any other listing is scoped to the caller's own applications only.
    // (An explicit worker_id belonging to someone else is not honoured.)
    if (worker_id && worker_id !== 'me' && worker_id !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { rows } = await pool.query(
      `SELECT a.*, s.title, s.job_type, s.start_time, s.end_time, s.location,
              s.pay_rate, s.pay_period, s.company_name
         FROM applications a JOIN shifts s ON s.id = a.shift_id
        WHERE a.worker_id = $1
        ORDER BY a.created_at DESC`,
      [req.userId],
    );
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** GET /api/applications/status/:shiftId - caller's own status for a shift */
router.get('/status/:shiftId', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT status FROM applications WHERE shift_id = $1 AND worker_id = $2`,
      [req.params.shiftId, req.userId],
    );
    return res.json({ status: rows[0]?.status ?? null });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** GET /api/applications/my-shift-ids - set of shift IDs I've applied to */
router.get('/my-shift-ids', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT shift_id, status FROM applications WHERE worker_id = $1`,
      [req.userId],
    );
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** POST /api/applications - a worker applies to a shift (always as themselves, pending) */
router.post('/', requireAuth, requireRole('worker'), async (req, res) => {
  const { shift_id, match_score, message } = req.body as Record<string, unknown>;
  try {
    const { rows } = await pool.query(
      `INSERT INTO applications (shift_id, worker_id, status, match_score, message)
         VALUES ($1, $2, 'pending', $3, $4)
         ON CONFLICT (shift_id, worker_id) DO NOTHING
         RETURNING *`,
      [shift_id, req.userId, match_score ?? null, message ?? null],
    );
    if (!rows[0]) return res.status(409).json({ error: 'Already applied' });
    return res.status(201).json(rows[0]);
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
    const { rows: appRows } = await pool.query(
      `SELECT a.worker_id, s.client_id
         FROM applications a JOIN shifts s ON s.id = a.shift_id
        WHERE a.id = $1`,
      [req.params.id],
    );
    const app = appRows[0];
    if (!app) return res.status(404).json({ error: 'Not found' });

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

    const { rows } = await pool.query(
      `UPDATE applications SET status = $1 WHERE id = $2 RETURNING *`,
      [status, req.params.id],
    );
    return res.json(rows[0]);
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
    const { rows } = await pool.query(
      `INSERT INTO applications (shift_id, worker_id, status)
         VALUES ($1, $2, 'accepted')
         ON CONFLICT (shift_id, worker_id) DO UPDATE SET status = 'accepted'
         RETURNING *`,
      [shift_id, worker_id],
    );
    return res.status(201).json(rows[0]);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

export default router;
