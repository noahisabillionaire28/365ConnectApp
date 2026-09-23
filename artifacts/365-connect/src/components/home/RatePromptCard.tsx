/**
 * "Rate your last shift" / "Rate your crew" — a dismissible card at the top of
 * the home list for the newest completed shift the viewer has not rated yet.
 * Nobody rates unless asked, so this asks. Dismissal is per shift and lives in
 * localStorage (best-effort: a blocked store just means the card comes back).
 */
import { useState } from 'react';
import { useLocation } from 'wouter';
import { Star, X } from 'lucide-react';
import { usePendingReviews, type PendingReview } from '@/hooks/useReviews';

const DISMISS_KEY = 'rate-prompt-dismissed';

function readDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

function writeDismissed(set: Set<string>): void {
  try {
    // Keep the list short — only recent shifts matter.
    localStorage.setItem(DISMISS_KEY, JSON.stringify([...set].slice(-20)));
  } catch { /* private mode / blocked storage — the card simply returns next time */ }
}

function dayLabel(iso: string | null): string {
  if (!iso) return 'your last shift';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return 'your last shift';
  return `${new Date(ms).toLocaleDateString('en-US', { weekday: 'long' })}'s shift`;
}

export function RatePromptCard({ role }: { role: 'worker' | 'poster' }) {
  const [, navigate] = useLocation();
  const { pending } = usePendingReviews();
  const [dismissed, setDismissed] = useState<Set<string>>(readDismissed);

  const item: PendingReview | undefined = pending.find((p) => p.role === role && !dismissed.has(p.shift_id));
  if (!item) return null;

  function dismiss() {
    const next = new Set(dismissed);
    next.add(item!.shift_id);
    writeDismissed(next);
    setDismissed(next);
  }

  const isWorker = role === 'worker';
  const title = isWorker ? 'Rate your last shift' : 'Rate your crew';
  const who = item.counterpart_name ?? (isWorker ? 'the poster' : 'your workers');
  const body = isWorker
    ? `How was ${dayLabel(item.date)} with ${who}?`
    : `${item.title ? `${item.title} · ` : ''}${dayLabel(item.date)} · ${who} is waiting on your rating.`;
  const href = isWorker ? `/review/${item.shift_id}/${item.counterpart_id}` : `/shift/${item.shift_id}/applicants`;

  return (
    <div className="mx-4 mb-3 rounded-[12px] border border-[#E5E7EB] bg-white px-4 py-3 flex items-center gap-3" role="status">
      <div className="w-9 h-9 rounded-full bg-[#FFFBEB] border border-[#FDE68A] flex items-center justify-center flex-shrink-0">
        <Star size={16} aria-hidden className="text-[#F59E0B] fill-[#F59E0B]" />
      </div>
      <button type="button" onClick={() => navigate(href)} className="flex-1 min-w-0 text-left">
        <p className="text-[#111827] font-bold text-[14px]">{title}</p>
        <p className="text-[#6B7280] text-[12px] mt-0.5 truncate">{body}</p>
      </button>
      <button type="button" onClick={() => navigate(href)}
        className="h-9 px-3.5 rounded-[8px] bg-[#0A1628] text-white text-[12px] font-bold flex-shrink-0">
        Rate
      </button>
      <button type="button" onClick={dismiss} aria-label="Dismiss"
        className="w-8 h-8 rounded-full flex items-center justify-center text-[#9CA3AF] flex-shrink-0">
        <X size={15} aria-hidden />
      </button>
    </div>
  );
}
