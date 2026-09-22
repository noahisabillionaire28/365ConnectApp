import { Router } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { pushConfigured, pushPublicKey, pushToUser } from '../lib/push.js';
import { apnsConfigured } from '../lib/apns.js';

const router = Router();

/** GET /api/push/public-key — VAPID public key (null when web push isn't configured). */
router.get('/public-key', (_req, res) => {
  return res.json({ configured: pushConfigured(), publicKey: pushPublicKey(), native: apnsConfigured() });
});

/**
 * POST /api/push/subscribe — save this device.
 *   Web:    { subscription: PushSubscriptionJSON }
 *   iOS:    { platform: 'ios', token: '<APNs device token>' }
 */
router.post('/subscribe', requireAuth, async (req, res) => {
  const body = req.body as {
    platform?: string;
    token?: string;
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  };

  if (body.platform === 'ios' || body.platform === 'android') {
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    if (!/^[0-9a-f]{32,512}$/i.test(token)) return res.status(400).json({ error: 'Invalid device token' });
    const { error } = await adminDb
      .from('push_subscriptions')
      .upsert(
        { user_id: req.userId, endpoint: token, keys: null, platform: body.platform, user_agent: req.get('user-agent') ?? null },
        { onConflict: 'endpoint' },
      );
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  const sub = body.subscription;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return res.status(400).json({ error: 'Invalid subscription' });
  }
  const { error } = await adminDb
    .from('push_subscriptions')
    .upsert(
      { user_id: req.userId, endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, platform: 'web', user_agent: req.get('user-agent') ?? null },
      { onConflict: 'endpoint' },
    );
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

/** POST /api/push/unsubscribe { endpoint | token } — forget this device. */
router.post('/unsubscribe', requireAuth, async (req, res) => {
  const { endpoint, token } = req.body as { endpoint?: string; token?: string };
  const key = endpoint || token;
  if (!key) return res.status(400).json({ error: 'endpoint required' });
  await adminDb.from('push_subscriptions').delete().eq('endpoint', key).eq('user_id', req.userId!);
  return res.json({ ok: true });
});

/** GET /api/push/status — do I have any subscribed devices? */
router.get('/status', requireAuth, async (req, res) => {
  const { count } = await adminDb
    .from('push_subscriptions').select('*', { count: 'exact', head: true }).eq('user_id', req.userId);
  return res.json({ configured: pushConfigured() || apnsConfigured(), devices: count ?? 0 });
});

/** POST /api/push/test — send myself a test notification. */
router.post('/test', requireAuth, async (req, res) => {
  if (!pushConfigured() && !apnsConfigured()) return res.status(503).json({ error: 'Push is not configured on the server yet.' });
  await pushToUser(req.userId!, { title: '365 Connect', body: 'Push notifications are working 🎉', url: '/messages', tag: 'test' });
  return res.json({ ok: true });
});

export default router;
