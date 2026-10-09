import { Router, type Response } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { broadcastToUser } from '../lib/sseManager.js';
import { sendEmail, renderNotificationEmail, renderUnsubscribePage, appUrl } from '../lib/email.js';
import { pushToUser } from '../lib/push.js';
import { unsubscribeUrl, verifyUnsubscribeToken } from '../lib/unsubscribe.js';
import { rateLimit, clientIp } from '../lib/rateLimit.js';
import { logger } from '../lib/logger.js';

/** Notification types that should NOT trigger an email (too high-frequency). */
const EMAIL_SKIP_TYPES = new Set(['post_like', 'post_comment', 'new_follower']);

/** Best-effort deep link into the app for a notification, for the email CTA. */
function emailCta(type: string, shiftId?: string | null, postId?: string | null):
  { label: string; href: string } {
  const base = appUrl();
  if (shiftId) return { label: 'View shift', href: `${base}/shift/${shiftId}` };
  if (postId)  return { label: 'View post',  href: `${base}/post/${postId}` };
  return { label: 'Open 365 Connect', href: `${base}/notifications` };
}

const router = Router();

// ── One-click email unsubscribe (no login) ──────────────────────────────────
// The link in every email footer and in the List-Unsubscribe header. GET is
// what a person clicks; POST is what a mail client sends for RFC 8058
// one-click unsubscribe. Both turn users.email_notifications off for the
// user the token was issued to, and nothing else.
const unsubscribeLimiter = rateLimit({
  windowMs: 10 * 60_000,
  max: 30,
  keys: (req) => [`ip:${clientIp(req)}`],
  message: 'Too many requests. Please try the link again in a few minutes.',
});

async function handleUnsubscribe(token: unknown, res: Response, wantsHtml: boolean) {
  const userId = verifyUnsubscribeToken(token);
  const page = (status: number, ok: boolean, message: string) => {
    res.status(status);
    if (wantsHtml) {
      res.setHeader('Cache-Control', 'no-store');
      return res.type('html').send(renderUnsubscribePage({ ok, message }));
    }
    return res.json(ok ? { ok: true } : { error: message });
  };
  if (!userId) {
    return page(400, false, 'The unsubscribe link is invalid or has expired. Open the app and turn off email in Settings → Notifications instead.');
  }
  const { data, error } = await adminDb
    .from('users')
    .update({ email_notifications: false })
    .eq('id', userId)
    .select('id')
    .maybeSingle();
  if (error) {
    logger.warn({ err: error.message }, '[unsubscribe] update failed');
    return page(500, false, 'Something went wrong on our side. Please try again later.');
  }
  if (!data) {
    // The account is gone: there is nothing left to email, so this is a success.
    return page(200, true, 'This account no longer exists, so no more email will be sent to it.');
  }
  return page(200, true, 'You will no longer receive notification emails from 365 Connect. In-app and push notifications are unchanged; you can turn email back on any time in the app.');
}

router.get('/unsubscribe', unsubscribeLimiter, async (req, res) => {
  await handleUnsubscribe(req.query.token, res, true);
});

router.post('/unsubscribe', unsubscribeLimiter, async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  // RFC 8058: the token stays in the URL; the body is "List-Unsubscribe=One-Click".
  const token = req.query.token ?? body.token;
  const wantsHtml = (req.get('accept') ?? '').includes('text/html');
  await handleUnsubscribe(token, res, wantsHtml);
});

/** GET /api/notifications — my notifications */
router.get('/', requireAuth, async (req, res) => {
  const { limit = '50' } = req.query as Record<string, string>;
  try {
    // Hidden rows exist only so the cron jobs can dedupe for users who turned
    // in-app notifications off; they never surface here.
    const { data: notifications, error } = await adminDb
      .from('notifications')
      .select('*')
      .eq('user_id', req.userId)
      .eq('hidden', false)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));
    if (error) return res.status(500).json({ error: error.message });

    const rows = notifications ?? [];
    const fromIds = [
      ...new Set(rows.map((n: any) => n.from_user_id).filter((id: any) => id != null)),
    ];
    let usersById = new Map<string, any>();
    if (fromIds.length) {
      const { data: users, error: usersError } = await adminDb
        .from('users')
        .select('id, username, photo_url')
        .in('id', fromIds);
      if (usersError) return res.status(500).json({ error: usersError.message });
      usersById = new Map((users ?? []).map((u: any) => [u.id, u]));
    }

    const merged = rows.map((n: any) => {
      const u = usersById.get(n.from_user_id);
      return {
        ...n,
        from_username: u?.username ?? null,
        from_photo_url: u?.photo_url ?? null,
      };
    });
    return res.json(merged);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** PATCH /api/notifications/:id/read — mark one read */
router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    const { error } = await adminDb
      .from('notifications')
      .update({ read_at: new Date().toISOString(), read: true })
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .is('read_at', null);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/** PATCH /api/notifications/read-all — mark all read */
router.patch('/read-all', requireAuth, async (req, res) => {
  try {
    const { error } = await adminDb
      .from('notifications')
      .update({ read_at: new Date().toISOString(), read: true })
      .eq('user_id', req.userId)
      .is('read_at', null);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

/**
 * Internal helper: insert a notification row and push it to the recipient via SSE.
 * Call from any route that needs to notify a user (applications, shift-requests, etc.)
 */
export async function createNotification(params: {
  userId:      string;
  fromUserId?: string | null;
  type:        string;
  title:       string;
  body:        string;
  shiftId?:    string | null;
  postId?:     string | null;
  /** In-app path the push/email should open; defaults to the shift or post. */
  url?:        string | null;
}): Promise<void> {
  const { userId, fromUserId, type, title, body, shiftId, postId, url } = params;
  try {
    // Respect the recipient's preferences + grab their email in one read.
    // (A DB-level gate trigger enforces the in-app rule for SQL-trigger rows.)
    const { data: pref } = await adminDb
      .from('users')
      .select('in_app_notifications, email_notifications, email')
      .eq('id', userId)
      .maybeSingle();

    // The row is always written: the cron jobs dedupe reminders against this
    // table, so a user with in-app notifications off must still leave a
    // trace or they would get the same email on every tick. For them the row
    // is hidden + read (the DB gate trigger sets the same), and nothing is
    // pushed or broadcast.
    const inAppOn = !pref || pref.in_app_notifications !== false;
    const { data, error } = await adminDb
      .from('notifications')
      .insert({
        user_id: userId,
        from_user_id: fromUserId ?? null,
        type,
        title,
        body,
        shift_id: shiftId ?? null,
        post_id: postId ?? null,
        ...(inAppOn ? {} : { hidden: true, read: true, read_at: new Date().toISOString() }),
      })
      .select()
      .maybeSingle();
    if (error) throw error;
    if (inAppOn) {
      // Push live to the recipient if they're online…
      if (data) broadcastToUser(userId, 'new_notification', data);
      // …and to their phone if they've enabled push (no-op when unconfigured).
      const cta = emailCta(type, shiftId, postId);
      const path = url || (cta.href.startsWith(appUrl()) ? cta.href.slice(appUrl().length) : cta.href);
      void pushToUser(userId, { title, body, url: path || '/notifications', tag: shiftId ? `shift-${shiftId}` : undefined })
        .catch((e) => console.warn('[createNotification] push failed:', e));
    }

    // Email notification — best-effort, gated by the email preference and type.
    if (
      pref?.email &&
      pref.email_notifications !== false &&
      !EMAIL_SKIP_TYPES.has(type)
    ) {
      const cta = emailCta(type, shiftId, postId);
      const unsub = unsubscribeUrl(userId);
      const { html, text } = renderNotificationEmail({
        title, body, ctaLabel: cta.label, ctaHref: url ? `${appUrl()}${url}` : cta.href, preheader: body,
        unsubscribeUrl: unsub,
      });
      await sendEmail({ to: pref.email as string, subject: title, html, text, unsubscribeUrl: unsub });
    }
  } catch (e) {
    // Notifications are non-critical — log but don't throw
    console.error('[createNotification] failed:', e);
  }
}

export default router;
