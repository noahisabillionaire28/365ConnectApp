import { useState } from 'react';
import { Download, Share, X, Smartphone } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

const DISMISS_KEY = '365connect:install-banner-dismissed';

function readDismissed(): boolean {
  try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
}

/**
 * Compact "Add to Home Screen" card. Shows the native install button where
 * the browser supports it, iOS instructions on Safari, and nothing once the
 * app is installed or the user has dismissed it.
 */
export function InstallBanner({ compact = false, flush = false }: { compact?: boolean; flush?: boolean }) {
  const { installed, canPrompt, ios, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(readDismissed);
  const [showIosSteps, setShowIosSteps] = useState(false);

  if (installed || dismissed || (!canPrompt && !ios)) return null;

  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  }

  return (
    <div className={`${flush ? '' : 'mx-4'} ${compact ? 'mb-3' : 'mb-4'} rounded-[14px] border border-[#E5E7EB] bg-[#0A1628] text-white px-4 py-3.5 relative`}>
      <button type="button" aria-label="Dismiss" onClick={dismiss}
        className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
        <X size={14} />
      </button>
      <div className="flex items-start gap-3 pr-8">
        <div className="w-10 h-10 rounded-[10px] bg-white/10 flex items-center justify-center flex-shrink-0">
          <Smartphone size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-[14px] leading-tight">Add 365 Connect to your Home Screen</p>
          <p className="text-white/75 text-[12px] mt-0.5 leading-snug">
            Opens like an app, and it is the only way to get shift and message alerts on iPhone.
          </p>
          {canPrompt && (
            <button type="button" onClick={() => void promptInstall()}
              className="mt-2.5 h-9 px-3.5 rounded-[8px] bg-white text-[#0A1628] text-[13px] font-bold flex items-center gap-1.5">
              <Download size={14} /> Install app
            </button>
          )}
          {!canPrompt && ios && !showIosSteps && (
            <button type="button" onClick={() => setShowIosSteps(true)}
              className="mt-2.5 h-9 px-3.5 rounded-[8px] bg-white text-[#0A1628] text-[13px] font-bold flex items-center gap-1.5">
              <Share size={14} /> Show me how
            </button>
          )}
          {!canPrompt && ios && showIosSteps && (
            <ol className="mt-2.5 text-[12.5px] text-white/90 space-y-1 list-decimal pl-4">
              <li>Tap the <span className="inline-flex items-center gap-1 font-bold"><Share size={12} /> Share</span> button in Safari.</li>
              <li>Scroll and tap <span className="font-bold">Add to Home Screen</span>.</li>
              <li>Tap <span className="font-bold">Add</span>, then open 365 Connect from your Home Screen.</li>
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
