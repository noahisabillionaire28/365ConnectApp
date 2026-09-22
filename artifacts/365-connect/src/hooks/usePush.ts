/**
 * Push subscription management.
 *  - Web / installed PWA: service worker + VAPID (web push).
 *  - Native iOS app: Apple push via the Capacitor plugin.
 * Gracefully reports "unavailable" when the platform or server can't do push.
 */
import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { isNative, nativePushPermission, registerNativePush } from '@/lib/native';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function pushSupported(): boolean {
  if (isNative()) return true;
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (isNative() || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/sw.js`);
  } catch (e) {
    console.debug('[push] service worker registration failed:', e);
    return null;
  }
}

/** The APNs token this device registered with (native only). */
let nativeToken: string | null = null;

export function usePush() {
  const { user } = useAuth();
  const native = isNative();
  const [serverReady, setServerReady] = useState<boolean | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>(
    !native && typeof Notification !== 'undefined' ? Notification.permission : 'default',
  );
  const [busy, setBusy] = useState(false);
  const supported = pushSupported();

  const refresh = useCallback(async () => {
    if (!supported) return;
    try {
      const status = await apiClient(user?.id).get<{ configured: boolean; publicKey: string | null; native?: boolean }>('/push/public-key');
      if (native) {
        setServerReady(!!status.native);
        const perm = await nativePushPermission();
        setPermission(perm === 'prompt' ? 'default' : perm);
        setSubscribed(perm === 'granted' && !!nativeToken);
        return;
      }
      setServerReady(status.configured);
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setSubscribed(!!sub);
      setPermission(Notification.permission);
    } catch { setServerReady(false); }
  }, [supported, native, user?.id]);

  useEffect(() => { void refresh(); }, [refresh]);

  const subscribe = useCallback(async (): Promise<string | null> => {
    if (!supported || !user?.id) return 'Push is not supported on this device.';
    setBusy(true);
    try {
      if (native) {
        const token = await registerNativePush({ promptIfNeeded: true });
        if (!token) { setPermission(await nativePushPermission() === 'denied' ? 'denied' : 'default'); return 'Notifications were not allowed.'; }
        await apiClient(user.id).post('/push/subscribe', { platform: 'ios', token });
        nativeToken = token;
        setPermission('granted');
        setSubscribed(true);
        return null;
      }
      const { configured, publicKey } = await apiClient(user.id).get<{ configured: boolean; publicKey: string | null }>('/push/public-key');
      if (!configured || !publicKey) return 'Push is not set up on the server yet.';
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return 'Notifications were not allowed.';
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await registerServiceWorker());
      if (!reg) return 'Could not start the notification service.';
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource });
      await apiClient(user.id).post('/push/subscribe', { subscription: sub.toJSON() });
      setSubscribed(true);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Could not turn on notifications.';
    } finally { setBusy(false); }
  }, [supported, native, user?.id]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!supported || !user?.id) return;
    setBusy(true);
    try {
      if (native) {
        if (nativeToken) await apiClient(user.id).post('/push/unsubscribe', { token: nativeToken }).catch(() => {});
        nativeToken = null;
        setSubscribed(false);
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await apiClient(user.id).post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally { setBusy(false); }
  }, [supported, native, user?.id]);

  const sendTest = useCallback(async (): Promise<string | null> => {
    if (!user?.id) return 'Not signed in.';
    try { await apiClient(user.id).post('/push/test', {}); return null; }
    catch (e) { return e instanceof Error ? e.message : 'Could not send a test.'; }
  }, [user?.id]);

  return { supported, serverReady, subscribed, permission, busy, subscribe, unsubscribe, sendTest, refresh };
}

/** Called by the native bridge after a silent registration so the settings screen agrees. */
export function rememberNativeToken(token: string | null): void { nativeToken = token; }
