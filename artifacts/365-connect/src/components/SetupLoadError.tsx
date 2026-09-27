/**
 * Shown by the setup wizards when the profile read fails before the first
 * step can render. Without it the screen sat on its skeleton forever.
 */
import { WifiOff } from 'lucide-react';

const NAVY  = '#0A1628';
const MUTED = '#6B7280';

export function SetupLoadError({ onRetry, onBack }: { onRetry: () => void; onBack?: () => void }) {
  return (
    <div className="min-h-[100dvh] bg-white flex flex-col items-center justify-center px-8 text-center gap-3">
      <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: '#F3F4F6' }}>
        <WifiOff size={22} style={{ color: NAVY }} aria-hidden />
      </div>
      <p className="font-bold text-[17px]" style={{ color: NAVY }}>Couldn't load your profile</p>
      <p className="text-[14px] leading-relaxed max-w-[280px]" style={{ color: MUTED }}>
        Check your connection and try again. Nothing you've saved so far is lost.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 w-full max-w-[280px] text-white font-bold text-[15px] h-[48px] rounded-[12px] active:scale-[0.98] transition-transform"
        style={{ background: NAVY }}
        data-testid="btn-setup-retry"
      >
        Try again
      </button>
      {onBack && (
        <button type="button" onClick={onBack} className="text-[13px] font-semibold mt-1" style={{ color: MUTED }}>
          Back
        </button>
      )}
    </div>
  );
}
