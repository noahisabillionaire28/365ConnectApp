import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { getRoleInfo } from '../lib/roleCache.js';

const router = Router();

/** Coarsen a coordinate to two decimals (~1 km) for the public directory. */
function coarse(v: unknown): number | null {
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * GET /api/workers — the worker directory ("Browse Workers" / Explore).
 * Optional: ?role=worker|client|staffer (default worker) &job_type=Bartender
 *           &lat=25.7&lng=-80.1 (viewer position → distance_miles on each row)
 *           &q=mar (username contains, for pickers) &exclude_self=1
 * Adds per row: distance_miles (null without lat/lng), is_available,
 * availability, and is_followed. Signed-in only, and home coordinates are
 * coarsened to two decimals for everyone but the viewer themselves and admins
 * (distance is computed from the exact values before that).
 */
router.get('/', requireAuth, async (req, res) => {
  const {
    role = 'worker', job_type, limit = '50', offset = '0', lat, lng, q: search, exclude_self,
  } = req.query as Record<string, string>;
  try {
    const viewerIsAdmin = (await getRoleInfo(req.userId!)).isAdmin;
    const lim = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
    const off = Math.max(parseInt(offset) || 0, 0);
    const vLat = lat !== undefined ? Number(lat) : NaN;
    const vLng = lng !== undefined ? Number(lng) : NaN;
    const hasViewerPos = Number.isFinite(vLat) && Number.isFinite(vLng);

    let q = adminDb
      .from('users')
      .select(
        'id, username, photo_url, role, bio, rating, is_pro, is_available, availability, ' +
          'job_types, primary_job_type, secondary_job_types, certifications, ' +
          'lat, lng, company_name, created_at, status',
      )
      .neq('role', 'admin')
      .not('username', 'is', null);

    // "all" lists every non-admin account (admin tooling); anything else is a role.
    if (role !== 'all') q = q.eq('role', role);
    if (job_type) {
      q = q.or(
        `primary_job_type.eq.${job_type},job_types.cs.{${job_type}},secondary_job_types.cs.{${job_type}}`,
      );
    }
    // Name search for pickers (swap sheet). Pattern characters are stripped so
    // a typed "%" or "_" cannot widen the match.
    const term = (search ?? '').trim().replace(/^@/, '').replace(/[%_,().\\*]/g, '').slice(0, 40);
    if (term) q = q.ilike('username', `%${term}%`);
    if (exclude_self === '1' || exclude_self === 'true') q = q.neq('id', req.userId);

    const { data: raw, error } = await q
      .order('rating', { ascending: false })
      .order('created_at', { ascending: false })
      .range(off, off + lim - 1);
    if (error) return res.status(500).json({ error: error.message });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (raw ?? []) as Array<Record<string, any>>;

    // Who the viewer already follows (roster) — one query, not one per card.
    const followed = new Set<string>();
    if (req.userId && data.length) {
      const { data: f } = await adminDb
        .from('follows')
        .select('following_id')
        .eq('follower_id', req.userId)
        .in('following_id', data.map((u) => u.id as string));
      for (const row of f ?? []) followed.add(row.following_id);
    }

    const rows = data
      .filter((u) => u.status !== 'banned' && u.status !== 'suspended')
      .map((u) => {
        const { status: _status, ...pub } = u;
        const uLat = u.lat != null ? Number(u.lat) : NaN;
        const uLng = u.lng != null ? Number(u.lng) : NaN;
        const distance = hasViewerPos && Number.isFinite(uLat) && Number.isFinite(uLng)
          ? Math.round(haversineMiles(vLat, vLng, uLat, uLng) * 10) / 10
          : null;
        const exact = viewerIsAdmin || u.id === req.userId;
        return {
          ...pub,
          lat: exact ? u.lat : coarse(u.lat),
          lng: exact ? u.lng : coarse(u.lng),
          is_available: u.is_available !== false,
          distance_miles: distance,
          is_followed: followed.has(u.id),
        };
      });
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

export default router;
