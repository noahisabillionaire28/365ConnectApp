/**
 * The push subscription this device holds for the signed-in user, and how to
 * give it back on sign-out. Kept outside the React hook so AuthContext can
 * call it: a subscription left behind would keep delivering the previous
 * user's messages to whoever signs in next on this device.
 */
import { apiClient } from '@/lib/api';
import { isNative } from '@/lib/native';

/** The APNs token this device registered with (native only). */
let nativeToken: string | null = null;

export function getNativeToken(): string | null { return nativeToken; }
export function setNativeToken(token: string | null): void { nativeToken = token; }

/**
 * Best-effort: tell the server to forget this device for `userId`, then drop
 * the browser subscription. Never throws and never takes more than ~2.5 s,
 * so sign-out is not held up by a flaky network.
 */
export async function forgetPushSubscription(userId: string): Promise<void> {
  const work = (async () => {
    if (isNative()) {
      if (nativeToken) await apiClient(userId).post('/push/unsubscribe', { token: nativeToken }).catch(() => {});
      nativeToken = null;
      return;
    }
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await apiClient(userId).post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  })();
  await Promise.race([work, new Promise<void>((resolve) => setTimeout(resolve, 2500))]).catch(() => {});
}
