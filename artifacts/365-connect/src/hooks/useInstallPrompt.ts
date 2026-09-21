/**
 * "Add to Home Screen" support.
 *
 * Chrome/Edge/Android fire `beforeinstallprompt`, which we hold on to so a
 * button in the app can trigger the native install dialog. iOS Safari has no
 * such event — the user must use Share → Add to Home Screen — so we detect
 * that case and show instructions instead. Once running as an installed app
 * (standalone display mode) nothing is shown.
 */
import { useCallback, useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    for (const l of listeners) l();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    for (const l of listeners) l();
  });
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
}

export function useInstallPrompt() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const installed = isStandalone();
  const canPrompt = !!deferredPrompt && !installed;
  const ios = isIOS() && !installed;

  /** Opens the browser's install dialog (Chrome/Edge/Android). */
  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) return 'unavailable';
    const p = deferredPrompt;
    await p.prompt();
    const { outcome } = await p.userChoice;
    if (outcome === 'accepted') deferredPrompt = null;
    for (const l of listeners) l();
    return outcome;
  }, []);

  return { installed, canPrompt, ios, promptInstall };
}
