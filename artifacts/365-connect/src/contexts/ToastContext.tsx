/**
 * Global toast notification system.
 *
 * Usage:
 *   const { showToast } = useToast();
 *   showToast('Your message here');
 *
 * Design:
 *   – Anchored to the top of the screen, safe-area aware
 *   – Slides down on enter, fades out on exit
 *   – Green #10B981, white bold text, checkmark icon
 *   – 3-second auto-dismiss; tappable to dismiss early
 *   – Only ONE toast visible at a time; extras are queued sequentially
 *   – pointer-events: none on the overlay so buttons/nav are never blocked
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, XCircle } from 'lucide-react';

type ToastVariant = 'success' | 'error';
type ToastItem = { id: string; message: string; variant: ToastVariant };

type ToastContextValue = { showToast: (message: string, variant?: ToastVariant) => void };

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [queue,   setQueue]   = useState<ToastItem[]>([]);
  const [current, setCurrent] = useState<ToastItem | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Dismiss the current toast (clears timer too). */
  const dismiss = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setCurrent(null);
  }, []);

  /**
   * When the current toast is gone, pull the next one from the queue.
   * Using two separate effects keeps the "advance queue" logic from running
   * on every queue mutation while a toast is already visible.
   */
  useEffect(() => {
    if (current !== null) return;        // still showing — wait
    if (queue.length === 0) return;      // nothing queued
    const [next, ...rest] = queue;
    setQueue(rest);
    setCurrent(next);
  }, [current, queue]);

  /** Start/restart the 3-second auto-dismiss clock whenever a new id appears. */
  useEffect(() => {
    if (!current) return;
    timerRef.current = setTimeout(() => setCurrent(null), 3000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  /** Add a message to the queue — called from any screen via useToast(). */
  const showToast = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    setQueue((prev) => [...prev, { id, message, variant }]);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/*
        Full-screen fixed overlay with pointer-events:none so it never blocks
        taps, buttons, or navigation. Only the toast pill itself has pointer-events:auto.
      */}
      <div
        className="fixed inset-0 z-[9999] pointer-events-none"
        aria-live="polite"
        aria-atomic="true"
      >
        <div
          className="flex justify-center"
          style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
        >
          {/* Matches the app column width */}
          <div className="w-full max-w-app px-4">
            <AnimatePresence mode="wait">
              {current && (
                <motion.button
                  key={current.id}
                  type="button"
                  onClick={dismiss}
                  initial={{ y: -80, opacity: 1 }}
                  animate={{ y: 0,   opacity: 1 }}
                  exit={{ opacity: 0, y: -16, transition: { duration: 0.22, ease: 'easeIn' } }}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className={`pointer-events-auto w-full flex items-center gap-3 rounded-[14px] px-4 py-3.5 shadow-lg ${
                    current.variant === 'error' ? 'bg-[#EF4444]' : 'bg-[#10B981]'
                  }`}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                  aria-label={`${current.message} — tap to dismiss`}
                >
                  {current.variant === 'error'
                    ? <XCircle size={20} className="text-white flex-shrink-0" aria-hidden />
                    : <CheckCircle2 size={20} className="text-white flex-shrink-0" aria-hidden />}
                  <p className="text-white font-bold text-[14px] leading-snug text-left">
                    {current.message}
                  </p>
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </ToastContext.Provider>
  );
}
