/**
 * Apple MapKit JS tokens.
 *   GET /api/maps/token — { configured: true, token, expiresAt } for signed-in users,
 *                         or 404 { configured: false } when no Apple Maps key is set.
 */
import { Router, type IRouter } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { mapsConfigured, mapsToken, originAllowed } from '../lib/appleMaps.js';

const router: IRouter = Router();

router.get('/token', requireAuth, async (req, res) => {
  if (!mapsConfigured()) return res.status(404).json({ configured: false });
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
  if (!originAllowed(origin)) return res.status(403).json({ error: 'Origin not allowed' });
  try {
    const { token, expiresAt } = await mapsToken(origin);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ configured: true, token, expiresAt });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message || 'Could not mint a map token' });
  }
});

export default router;
