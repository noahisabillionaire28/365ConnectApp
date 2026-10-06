/**
 * Keyboard behaviour for bottom sheets and modals: while open, focus moves
 * into the dialog, Tab cycles inside it, Escape closes it (unless the dialog
 * is non-dismissable) and, when it closes, focus returns to the element that
 * opened it. Body scroll is locked while open.
 *
 *   const ref = useDialog<HTMLDivElement>(open, onClose);
 *   <div ref={ref} role="dialog" aria-modal="true" aria-labelledby=…>
 */
import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
    .filter((el) => el.offsetParent !== null || el === document.activeElement);
}

export function useDialog<T extends HTMLElement>(
  open: boolean,
  onClose?: (() => void) | null,
  opts: { initialFocus?: 'first' | 'container'; lockScroll?: boolean } = {},
): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const { initialFocus = 'first', lockScroll = true } = opts;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    if (lockScroll) document.body.style.overflow = 'hidden';

    // Focus after paint so animated sheets have mounted their content.
    const t = window.setTimeout(() => {
      const root = ref.current;
      if (!root) return;
      if (root.contains(document.activeElement)) return; // autoFocus already landed
      const list = focusables(root);
      const target = initialFocus === 'first' && list.length ? list[0] : root;
      if (target === root && !root.hasAttribute('tabindex')) root.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }, 30);

    const onKey = (e: KeyboardEvent) => {
      const root = ref.current;
      if (e.key === 'Escape') {
        if (onCloseRef.current) { e.preventDefault(); e.stopPropagation(); onCloseRef.current(); }
        return;
      }
      if (e.key !== 'Tab' || !root) return;
      const list = focusables(root);
      if (!list.length) { e.preventDefault(); root.focus(); return; }
      const first = list[0], last = list[list.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !root.contains(active))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (active === last || !root.contains(active))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);

    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey, true);
      if (lockScroll) document.body.style.overflow = prevOverflow;
      // Give focus back to whoever opened the dialog, if they are still around.
      if (opener && document.contains(opener) && typeof opener.focus === 'function') {
        opener.focus({ preventScroll: true });
      }
    };
  }, [open, initialFocus, lockScroll]);

  return ref;
}
