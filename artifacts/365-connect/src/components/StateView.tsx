/**
 * One look for "nothing here" and "that didn't load" across the app. A failed
 * request must never read as an empty list ("No shifts match this filter",
 * "Your roster is empty"): people act on what they see. Error copy is ours,
 * never the server's raw text; the detail stays in the console.
 */
import { AlertTriangle, Inbox, WifiOff } from 'lucide-react';

type Kind = 'empty' | 'error' | 'offline';

export function StateView({
  kind = 'empty', title, body, actionLabel, onAction, icon: Icon, compact = false, testId,
}: {
  kind?: Kind;
  title: string;
  body?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>;
  /** Tighter spacing for use inside a card or sheet. */
  compact?: boolean;
  testId?: string;
}) {
  const Fallback = kind === 'error' ? AlertTriangle : kind === 'offline' ? WifiOff : Inbox;
  const Glyph = Icon ?? Fallback;
  const tone = kind === 'empty' ? 'text-[#6B7280]' : 'text-[#B45309]';
  return (
    <div role={kind === 'empty' ? undefined : 'alert'} data-testid={testId ?? `state-${kind}`}
      className={`flex flex-col items-center text-center px-6 ${compact ? 'py-8' : 'py-14'}`}>
      <div className="w-14 h-14 rounded-full bg-[#F7F8FA] border border-[#E5E7EB] flex items-center justify-center mb-4">
        <Glyph size={24} aria-hidden className={tone} />
      </div>
      <p className="text-[#111827] text-[17px] font-semibold leading-snug">{title}</p>
      {body && <p className="text-[#6B7280] text-[14px] leading-relaxed mt-1.5 max-w-[300px]">{body}</p>}
      {actionLabel && onAction && (
        <button type="button" onClick={onAction}
          className="mt-5 h-11 px-5 rounded-[12px] bg-[#0A1628] text-white text-[15px] font-semibold active:scale-[0.98] transition-transform">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/** The standard "couldn't load" state with a retry. */
export function LoadError({ what, onRetry, compact }: { what: string; onRetry: () => void; compact?: boolean }) {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  return (
    <StateView kind={offline ? 'offline' : 'error'} compact={compact}
      title={offline ? "You're offline" : `Couldn't load ${what}`}
      body={offline ? 'Check your connection, then try again.' : 'Something went wrong on our side. Your data is safe.'}
      actionLabel="Try again" onAction={onRetry} />
  );
}
