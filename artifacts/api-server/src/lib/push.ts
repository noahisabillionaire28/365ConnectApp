/**
 * Web Push (VAPID) — sends browser/PWA push notifications.
 *
 * Environment variables on the API server:
 *   VAPID_PUBLIC_KEY   — shared with the browser to subscribe
 *   VAPID_PRIVATE_KEY  — server-only signing key
 *   VAPID_SUBJECT      — "mailto:you@example.com" (or an https URL)
 *
 * When the keys are missing every send is a silent no-op, so the rest of the
 * app keeps working and the Settings screen simply reports push as unavailable.
 */
import webPush from 'web-push';
import { adminDb } from './supabaseAdmin.js';

const PUBLIC_KEY  = process.env['VAPID_PUBLIC_KEY']  ?? '';
const PRIVATE_KEY = process.env['VAPID_PRIVATE_KEY'] ?? '';
const SUBJECT     = process.env['VAPID_SUBJECT']     ?? 'mailto:support@365connect.app';

let configured = false;
if (PUBLIC_KEY && PRIVATE_KEY) {
  try {
    webPush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
    configured = true;
  } catch (e) {
    console.warn('[push] invalid VAPID configuration:', e);
  }
}

export function pushConfigured(): boolean { return configured; }
export function pushPublicKey(): string | null { return configured ? PUBLIC_KEY : null; }

export type PushPayload = {
  title: string;
  body: string;
  /** In-app path to open when tapped, e.g. "/messages/<id>". */
  url?: string;
  /** Collapses repeated notifications for the same thread. */
  tag?: string;
  icon?: string;
};

/** Send a push to every device a user has subscribed. Dead endpoints are pruned. */
export async function pushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!configured) return;
  const { data: subs } = await adminDb
    .from('push_subscriptions')
    .select('id, endpoint, keys')
    .eq('user_id', userId);
  if (!subs?.length) return;

  const body = JSON.stringify({ icon: '/favicon.png', ...payload });
  await Promise.all(subs.map(async (s) => {
    try {
      await webPush.sendNotification(
        { endpoint: s.endpoint, keys: s.keys as { p256dh: string; auth: string } },
        body,
        { TTL: 60 * 60 },
      );
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      // 404/410 = subscription expired or unsubscribed → forget it.
      if (status === 404 || status === 410) {
        await adminDb.from('push_subscriptions').delete().eq('id', s.id);
      }
    }
  }));
}

export async function pushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  await Promise.all([...new Set(userIds)].map((id) => pushToUser(id, payload)));
}
