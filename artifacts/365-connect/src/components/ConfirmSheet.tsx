/**
 * Bottom confirmation sheet for consequential actions (broadcasts, removals,
 * cancellations). Replaces window.confirm so the copy can explain what will
 * happen and the primary action can be styled by intent.
 */
import type { ReactNode } from 'react';

export function ConfirmSheet({
  open, title, body, confirmLabel, cancelLabel = 'Cancel', tone = 'primary', busy = false, onConfirm, onCancel,
}: {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  const confirmCls = tone === 'danger' ? 'bg-[#EF4444] text-white' : 'bg-[#0A1628] text-white';
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40"
      role="dialog" aria-modal="true" aria-label={title}
      onClick={() => { if (!busy) onCancel(); }}>
      <div className="w-full max-w-app bg-white rounded-t-[20px] px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
        onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-[#E5E7EB] mx-auto mb-4" />
        <p className="text-[#111827] font-bold text-[17px]">{title}</p>
        {body && <div className="text-[#6B7280] text-[13px] mt-1 leading-relaxed">{body}</div>}
        <div className="flex flex-col gap-2 mt-5">
          <button type="button" onClick={onConfirm} disabled={busy}
            className={`w-full h-[50px] rounded-[10px] font-bold text-[15px] disabled:opacity-60 ${confirmCls}`}>
            {busy ? 'Working…' : confirmLabel}
          </button>
          <button type="button" onClick={onCancel} disabled={busy}
            className="w-full h-[46px] rounded-[10px] border border-[#E5E7EB] text-[#111827] font-semibold text-[14px] disabled:opacity-60">
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
