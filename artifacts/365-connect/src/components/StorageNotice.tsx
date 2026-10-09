/**
 * One-time storage notice. The app uses essential storage only (sign-in
 * session, data cache, small preferences), so a consent banner is not
 * required; this small dismissible line simply tells people what to expect
 * and links the Cookie & Local Storage Policy. Remembered in localStorage,
 * never shown inside the native iOS shell (nothing there is a "cookie").
 */
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { isNative } from '@/lib/native';

export const STORAGE_NOTICE_KEY = '365connect:storage-notice-dismissed';

function readDismissed(): boolean {
  try { return localStorage.getItem(STORAGE_NOTICE_KEY) === '1'; } catch { return false; }
}

/** Screens with the bottom tab bar: the notice sits above it instead of covering it. */
const TAB_BAR_ROUTES = /^\/(home|jobs|explore|messages|profile|roster|post-shift|notifications|notification-settings|saved|templates|earnings|pro-upgrade)(\/|$)/;

export function StorageNotice() {
  const [location] = useLocation();
  const [dismissed, setDismissed] = useState<boolean>(() => isNative() || readDismissed());
  // Let the first screen settle before the notice slides in.
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setReady(true), 800); return () => window.clearTimeout(t); }, []);

  if (dismissed || !ready) return null;
  // Never on top of the document it links to, nor over the admin console.
  if (/^\/(cookies|admin)(\/|$)/.test(location)) return null;

  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem(STORAGE_NOTICE_KEY, '1'); } catch { /* ignore */ }
  }

  const aboveTabBar = TAB_BAR_ROUTES.test(location);

  return (
    <div data-no-pull role="region" aria-label="Storage notice"
      className={`fixed left-1/2 -translate-x-1/2 w-full max-w-app z-[140] px-3 pointer-events-none ${
        aboveTabBar ? 'bottom-[calc(env(safe-area-inset-bottom)+64px)]' : 'bottom-[calc(env(safe-area-inset-bottom)+12px)]'}`}
      data-testid="storage-notice">
      <div className="pointer-events-auto mx-auto rounded-[12px] bg-[#0A1628] text-white shadow-lg px-4 py-3 flex items-center gap-3 anim-rise-in">
        <p className="flex-1 min-w-0 text-[12px] leading-snug text-white/90">
          We use essential storage only to keep you signed in and remember your settings. No ads or tracking.{' '}
          <Link href="/cookies" className="underline underline-offset-2 font-semibold text-white whitespace-nowrap" data-testid="storage-notice-learn-more">
            Learn more
          </Link>
        </p>
        <button type="button" onClick={dismiss}
          className="h-9 px-3 rounded-[8px] bg-white text-[#0A1628] text-[12px] font-bold flex-shrink-0"
          data-testid="storage-notice-dismiss">
          Got it
        </button>
      </div>
    </div>
  );
}
