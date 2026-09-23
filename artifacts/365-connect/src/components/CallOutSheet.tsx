/**
 * "Can't make it?" sheet for a booked worker calling out before a shift
 * starts: a short reason picker (plus optional note) and a clear warning that
 * the spot is released and may be given to a standby worker.
 */
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ConfirmSheet } from './ConfirmSheet';

export const CALL_OUT_REASONS = ['Sick', 'Emergency', 'Transportation', 'Schedule conflict', 'Other'] as const;
export type CallOutReason = (typeof CALL_OUT_REASONS)[number];

export function CallOutSheet({ open, shiftLabel, busy, onConfirm, onCancel }: {
  open: boolean;
  /** e.g. "Saturday · 6:00 PM" — shown in the warning copy. */
  shiftLabel?: string | null;
  busy: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState<CallOutReason | null>(null);
  const [note, setNote] = useState('');

  function close() {
    if (busy) return;
    setReason(null); setNote('');
    onCancel();
  }

  function confirm() {
    if (!reason) return;
    const text = note.trim();
    onConfirm(text ? `${reason} — ${text}` : reason);
  }

  return (
    <ConfirmSheet
      open={open}
      title="Can't make it?"
      confirmLabel={reason ? 'Release my spot' : 'Pick a reason to continue'}
      cancelLabel="Keep my spot"
      tone="danger"
      busy={busy}
      confirmDisabled={!reason}
      onConfirm={confirm}
      onCancel={close}
      body={
        <div className="flex flex-col gap-3">
          <p>Let the poster know why{shiftLabel ? ` you can't work ${shiftLabel}` : ''}.</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Reason">
            {CALL_OUT_REASONS.map((r) => {
              const on = reason === r;
              return (
                <button key={r} type="button" role="radio" aria-checked={on} disabled={busy}
                  onClick={() => setReason(r)}
                  className={`h-9 px-3.5 rounded-full border text-[13px] font-semibold transition-colors ${
                    on ? 'bg-[#0A1628] border-[#0A1628] text-white' : 'bg-white border-[#E5E7EB] text-[#111827]'}`}>
                  {r}
                </button>
              );
            })}
          </div>
          <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} rows={2} disabled={busy}
            placeholder="Anything the poster should know? (optional)" aria-label="Optional note"
            className="w-full border border-[#E5E7EB] rounded-[12px] px-3 py-2.5 text-[14px] text-[#111827] resize-none outline-none focus:border-[#0A1628] placeholder:text-[#9CA3AF]" />
          <div className="flex items-start gap-2 rounded-[12px] bg-amber-50 border border-amber-200 px-3 py-2.5">
            <AlertTriangle size={15} aria-hidden className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-amber-800 text-[12px] leading-relaxed">
              Your spot is released right away and may be given to a standby worker. Calling out close to the start time can affect your reliability.
            </p>
          </div>
        </div>
      }
    />
  );
}
