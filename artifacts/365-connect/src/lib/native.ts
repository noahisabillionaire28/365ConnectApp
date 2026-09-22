/**
 * Native shell helpers. The same React app runs on the web and inside the
 * iOS app (Capacitor). These helpers let a screen ask "am I inside the native
 * app?" so it can swap web-only behaviour (install banner, web push, Pro
 * checkout) for the native equivalent, and nothing else has to care.
 */
import { Capacitor } from '@capacitor/core';

export function isNative(): boolean {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
}

export function isIOS(): boolean {
  try { return Capacitor.getPlatform() === 'ios'; } catch { return false; }
}

/** Custom URL scheme the iOS app answers to (deep links, auth callbacks). */
export const APP_SCHEME = 'connect365';

/**
 * One-time native setup: status bar, splash screen, deep links, and the
 * "app came back to the foreground" signal. Safe to call on the web (no-op).
 */
export async function initNative(handlers: {
  onOpenPath: (path: string) => void;
  onResume?: () => void;
}): Promise<void> {
  if (!isNative()) return;
  const [{ App }, { StatusBar, Style }, { SplashScreen }, { Keyboard }] = await Promise.all([
    import('@capacitor/app'),
    import('@capacitor/status-bar'),
    import('@capacitor/splash-screen'),
    import('@capacitor/keyboard'),
  ]);

  try { await StatusBar.setStyle({ style: Style.Dark }); } catch { /* not on this platform */ }
  try { await Keyboard.setAccessoryBarVisible({ isVisible: false }); } catch { /* ignore */ }

  // connect365://shift/abc  or  https://365-connect-app.vercel.app/shift/abc
  void App.addListener('appUrlOpen', ({ url }) => {
    try {
      const u = new URL(url);
      const path = u.protocol === `${APP_SCHEME}:`
        ? `/${u.host}${u.pathname}${u.search}${u.hash}`
        : `${u.pathname}${u.search}${u.hash}`;
      handlers.onOpenPath(path.replace(/^\/+/, '/'));
    } catch { /* ignore malformed links */ }
  });

  // Cold start from a link: the listener above may have missed it.
  try {
    const launch = await App.getLaunchUrl();
    if (launch?.url) {
      const u = new URL(launch.url);
      const path = u.protocol === `${APP_SCHEME}:` ? `/${u.host}${u.pathname}${u.search}${u.hash}` : `${u.pathname}${u.search}${u.hash}`;
      handlers.onOpenPath(path.replace(/^\/+/, '/'));
    }
  } catch { /* ignore */ }

  void App.addListener('appStateChange', ({ isActive }) => { if (isActive) handlers.onResume?.(); });

  // Tapping a notification opens the screen it's about.
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    void PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const url = (action.notification.data as { url?: string } | undefined)?.url;
      if (typeof url === 'string' && url.startsWith('/')) handlers.onOpenPath(url);
    });
  } catch { /* plugin not available */ }

  // The web app has painted by now — drop the native splash.
  try { await SplashScreen.hide({ fadeOutDuration: 200 }); } catch { /* ignore */ }
}

/**
 * Register this device for Apple push and resolve its token, or null when
 * the user hasn't allowed notifications (and we were told not to ask).
 */
export async function registerNativePush(opts: { promptIfNeeded: boolean }): Promise<string | null> {
  if (!isNative()) return null;
  const { PushNotifications } = await import('@capacitor/push-notifications');
  let { receive } = await PushNotifications.checkPermissions();
  if (receive !== 'granted') {
    if (!opts.promptIfNeeded) return null;
    ({ receive } = await PushNotifications.requestPermissions());
    if (receive !== 'granted') return null;
  }
  return new Promise<string | null>((resolve) => {
    let done = false;
    const finish = (t: string | null) => { if (!done) { done = true; resolve(t); } };
    void PushNotifications.addListener('registration', ({ value }) => finish(value));
    void PushNotifications.addListener('registrationError', () => finish(null));
    void PushNotifications.register().catch(() => finish(null));
    setTimeout(() => finish(null), 10_000);
  });
}

/** Current native notification permission: 'granted' | 'denied' | 'prompt'. */
export async function nativePushPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  if (!isNative()) return 'denied';
  const { PushNotifications } = await import('@capacitor/push-notifications');
  const { receive } = await PushNotifications.checkPermissions();
  return receive === 'granted' ? 'granted' : receive === 'denied' ? 'denied' : 'prompt';
}
