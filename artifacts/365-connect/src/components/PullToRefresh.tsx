/**
 * Instagram-style pull to refresh. Wraps a screen; when the user drags down
 * from the very top, a small indicator stretches out and, past the threshold,
 * every query the screen is showing is refetched. Works for screens that
 * scroll the page and for screens with their own scrolling list (the pull
 * only starts when whatever the finger is on is already scrolled to the top).
 *
 * Data already refreshes on its own (live events + polling); this is the
 * explicit "I want it now" gesture people expect on a phone.
 */
import { useCallback, useRef, useState, type ReactNode, type TouchEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';

const THRESHOLD = 72;   // px of pull needed to trigger
const MAX_PULL  = 110;  // px the indicator can stretch

/**
 * Overlays that own their own gestures (story viewer, image cropper, the map,
 * bottom sheets) mark themselves with `data-no-pull`; a touch that starts
 * inside one never arms the refresh.
 */
function insideNoPull(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el?.closest?.('[data-no-pull]');
}

function scrolledAway(target: EventTarget | null): boolean {
  let el = target as HTMLElement | null;
  while (el && el !== document.body) {
    const oy = getComputedStyle(el).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && el.scrollTop > 0) return true;
    el = el.parentElement;
  }
  return (document.scrollingElement?.scrollTop ?? window.scrollY ?? 0) > 0;
}

export function PullToRefresh({ children, disabled = false, onRefresh }: {
  children: ReactNode;
  disabled?: boolean;
  /** Defaults to refetching every active query. */
  onRefresh?: () => Promise<unknown>;
}) {
  const qc = useQueryClient();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const armed = useRef(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setPull(THRESHOLD * 0.7);
    try {
      if (onRefresh) await onRefresh();
      else await qc.refetchQueries({ type: 'active' });
    } catch { /* screen-level errors already show in place */ }
    finally { setRefreshing(false); setPull(0); }
  }, [onRefresh, qc]);

  function onTouchStart(e: TouchEvent<HTMLDivElement>) {
    if (disabled || refreshing) return;
    if (insideNoPull(e.target) || scrolledAway(e.target)) { armed.current = false; return; }
    startY.current = e.touches[0]?.clientY ?? null;
    armed.current = startY.current != null;
  }

  function onTouchMove(e: TouchEvent<HTMLDivElement>) {
    if (!armed.current || startY.current == null) return;
    const dy = (e.touches[0]?.clientY ?? 0) - startY.current;
    if (dy <= 0) { if (pull) setPull(0); return; }
    // Resist: the indicator moves half as far as the finger, capped.
    setPull(Math.min(MAX_PULL, dy * 0.5));
  }

  function onTouchEnd() {
    if (!armed.current) return;
    armed.current = false;
    startY.current = null;
    if (pull >= THRESHOLD) void refresh();
    else setPull(0);
  }

  const progress = Math.min(1, pull / THRESHOLD);
  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
      <div
        aria-hidden={pull === 0}
        role="status"
        aria-label={refreshing ? 'Refreshing' : progress >= 1 ? 'Release to refresh' : 'Pull to refresh'}
        className="flex items-end justify-center overflow-hidden bg-white"
        style={{ height: pull, transition: armed.current ? 'none' : 'height 200ms ease-out' }}
      >
        <div className="mb-3 w-8 h-8 rounded-full bg-white border border-[#E5E7EB] shadow-sm flex items-center justify-center"
          style={{ opacity: Math.min(1, progress * 1.4), transform: `scale(${0.6 + progress * 0.4})` }}>
          <RefreshCw size={15} className={`text-[#0A1628] ${refreshing ? 'animate-spin' : ''}`}
            style={refreshing ? undefined : { transform: `rotate(${progress * 270}deg)` }} />
        </div>
      </div>
      {children}
    </div>
  );
}
