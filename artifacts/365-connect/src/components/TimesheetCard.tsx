/**
 * The worker's timesheet once they clock out: what was recorded, what the
 * poster approved, where the money is, and the worker's own sign-off.
 *
 * Both sides approve a timesheet: the worker confirms it is right (or says
 * what is wrong) as soon as they clock out, and the poster approves it
 * before paying. If the poster approves different hours, the worker is
 * asked again. Used on Home, the clock-out summary and the shift page.
 */
import { useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { PayTimeline } from '@/components/PayTimeline';
import { useAckHours, formatHoursMinutes, type TimeEntryRow } from '@/hooks/useTimeEntry';
import { useToast } from '@/contexts/ToastContext';
import { formatTime } from '@/lib/supabase';

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export function TimesheetCard({ entry: e, timezone, companyName, compact = false, showTimeline = true }: {
  entry: TimeEntryRow;
  timezone?: string | null;
  companyName?: string | null;
  /** Tighter, borderless version for inside another card (Home). */
  compact?: boolean;
  showTimeline?: boolean;
}) {
  const { ack, busy } = useAckHours();
  const { showToast } = useToast();
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [note, setNote] = useState('');

  const tz = timezone ?? undefined;
  const approved = !!e.approved;
  const changed = approved && e.hoursChanged;
  const hours = e.total_hours ?? 0;
  const pay = approved ? (e.approvedPay ?? e.total_pay ?? 0) : (e.total_pay ?? 0);
  const paid = !!e.paid || e.payTimeline?.stage === 'paid';
  const needsAnswer = !e.workerAck && !paid;
  const who = companyName || 'the organizer';

  const status = e.workerAck === 'disputed' ? { label: 'Disputed · under review', cls: 'bg-red-50 border-red-200 text-red-700' }
    : needsAnswer ? { label: changed ? 'Hours changed · check them' : 'Needs your OK', cls: 'bg-amber-50 border-amber-200 text-amber-800' }
    : approved ? { label: e.workerAck === 'accepted' ? 'Approved · confirmed by you' : 'Approved', cls: 'bg-emerald-50 border-emerald-200 text-emerald-800' }
    : { label: 'Confirmed · awaiting approval', cls: 'bg-[#EEF2F8] border-[#D6DEEA] text-[#1E3A5F]' };

  async function answer(action: 'accept' | 'dispute') {
    const err = await ack(e.id, action, action === 'dispute' ? note : undefined);
    if (err) { showToast(err, 'error'); return; }
    setDisputeOpen(false); setNote('');
    showToast(action === 'accept'
      ? (approved ? 'Thanks. Your hours are confirmed.' : `Timesheet confirmed. ${who} will approve it next.`)
      : `${who} has been told. Our team will take a look too.`);
  }

  return (
    <div className={compact ? '' : 'rounded-[12px] border border-[#E5E7EB] bg-white px-4 py-4'} data-testid="timesheet-card">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 mb-3">
        <p className="text-[#111827] font-bold text-[15px] whitespace-nowrap">Your timesheet</p>
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap ${status.cls}`}>{status.label}</span>
      </div>
      <div className="flex flex-col gap-2 text-[14px]">
        <Row label="Clocked in" value={formatTime(e.clock_in, tz)} />
        <Row label="Clocked out" value={formatTime(e.clock_out ?? e.clock_in, tz)} />
        {(e.breakMinutes ?? 0) > 0 && <Row label="Unpaid break" value={`${e.breakMinutes} min`} />}
        <div className="border-t border-[#F3F4F6] my-0.5" />
        <div className="flex justify-between">
          <span className="text-[#6B7280]">Total hours</span>
          <span className="text-[#111827] font-semibold">
            {changed
              ? <><span className="line-through text-[#6B7280] font-normal mr-1.5">{formatHoursMinutes(e.clocked_hours)}</span>{formatHoursMinutes(hours)}</>
              : formatHoursMinutes(hours)}
            {(e.overtime_hours ?? 0) > 0 && <span className="ml-1.5 text-[11px] text-amber-700 font-bold">{formatHoursMinutes(e.overtime_hours)} OT</span>}
          </span>
        </div>
        <div className="flex justify-between text-[15px]">
          <span className="text-[#111827] font-bold">{approved ? 'Approved pay' : 'Estimated pay'}</span>
          <span className="text-[#111827] font-bold">{usd(Number(pay) || 0)}</span>
        </div>
      </div>

      {needsAnswer && (
        <div className="mt-4 flex flex-col gap-2.5">
          <p className={`text-[13px] leading-relaxed ${changed ? 'text-amber-800' : 'text-[#374151]'}`}>
            {changed
              ? <>{who} changed your hours from <b>{formatHoursMinutes(e.clocked_hours)}</b> to <b>{formatHoursMinutes(hours)}</b>. Is that right?</>
              : <>Check your times and confirm they're right. {approved ? '' : `${who} approves it next, then you get paid.`}</>}
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" disabled={busy} onClick={() => void answer('accept')} data-testid="btn-timesheet-confirm"
              className="h-11 rounded-[12px] bg-[#0A1628] text-white text-[15px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60">
              <CheckCircle2 size={16} aria-hidden /> {busy ? 'Saving…' : changed ? 'Looks right' : 'Confirm'}
            </button>
            <button type="button" disabled={busy} onClick={() => setDisputeOpen(true)} data-testid="btn-timesheet-dispute"
              className="h-11 rounded-[12px] border border-red-300 bg-white text-red-700 text-[15px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60">
              <AlertTriangle size={15} aria-hidden /> Report issue
            </button>
          </div>
        </div>
      )}
      {e.workerAck === 'disputed' && e.dispute_note && (
        <p className="text-[#6B7280] text-[12px] mt-3 leading-relaxed">Your note: “{e.dispute_note}”</p>
      )}
      {!e.workerAck && paid && changed && (
        <p className="text-[#6B7280] text-[12px] mt-3 leading-relaxed">Paid · contact support to adjust these hours.</p>
      )}
      {showTimeline && e.payTimeline && (
        <div className="mt-4 pt-3.5 border-t border-[#F3F4F6]">
          <PayTimeline timeline={e.payTimeline} tz={timezone ?? 'America/New_York'} />
        </div>
      )}

      <ConfirmSheet open={disputeOpen} title="What's wrong with your timesheet?"
        confirmLabel="Send to the organizer" cancelLabel="Never mind" tone="danger" busy={busy}
        onConfirm={() => void answer('dispute')}
        onCancel={() => { if (!busy) { setDisputeOpen(false); setNote(''); } }}
        body={
          <div className="flex flex-col gap-3">
            <p>Tell {who} what the hours should be. They'll see your note before approving, and our team can step in.</p>
            <textarea value={note} onChange={(ev) => setNote(ev.target.value.slice(0, 500))} rows={3} disabled={busy}
              placeholder="e.g. I clocked out late, I left at 9:15 pm" aria-label="What's wrong"
              className="w-full border border-[#E5E7EB] rounded-[12px] px-3 py-2.5 text-[14px] text-[#111827] resize-none outline-none focus:border-[#0A1628] placeholder:text-[#6B7280]" />
          </div>
        } />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-[#6B7280]">{label}</span><span className="text-[#111827] font-semibold">{value}</span></div>;
}
