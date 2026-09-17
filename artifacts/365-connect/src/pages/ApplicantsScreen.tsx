import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
  ChevronLeft, Check, X, Star, Send, UserPlus, Users, AlarmClock,
  CheckCircle2, Flag, DollarSign, Clock3,
} from 'lucide-react';
import { useShiftApplicants } from '@/hooks/useShiftApplicants';
import { useAcceptedWorkers, type AcceptedWorker, type Attendance } from '@/hooks/useAcceptedWorkers';
import { useShiftInvites, type ShiftInvite } from '@/hooks/useShiftInvites';
import { useShiftById } from '@/hooks/useShifts';
import { broadcastShiftRequest } from '@/hooks/useShiftRequests';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useProfile } from '@/hooks/useProfile';
import { apiClient } from '@/lib/api';
import { startShiftPayment } from '@/lib/checkout';

/* ── Small UI atoms ──────────────────────────────────────────────────────── */
function Avatar({ url, name, size = 40 }: { url: string | null; name: string | null; size?: number }) {
  const initials = (name ?? 'W').replace('@', '').slice(0, 2).toUpperCase();
  return (
    <div style={{ width: size, height: size }}
      className="rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center overflow-hidden flex-shrink-0">
      {url ? <img src={url} alt="" className="w-full h-full object-cover" />
           : <span className="text-black font-bold text-[13px]">{initials}</span>}
    </div>
  );
}

const ATTENDANCE: Record<Attendance, { label: string; cls: string }> = {
  applied: { label: 'Applied',  cls: 'bg-[#FAFAFA] border-[#DBDBDB] text-[#737373]' },
  booked:  { label: 'Confirmed', cls: 'bg-[#FAFAFA] border-[#DBDBDB] text-[#737373]' },
  on_site: { label: 'On-site',  cls: 'bg-blue-50 border-blue-200 text-blue-600' },
  done:    { label: 'Done',     cls: 'bg-emerald-50 border-emerald-200 text-emerald-600' },
  no_show: { label: 'No-show',  cls: 'bg-red-50 border-red-200 text-red-500' },
};

function AttendanceChip({ a }: { a: Attendance }) {
  const m = ATTENDANCE[a];
  return <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${m.cls}`}>{m.label}</span>;
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-2.5 mt-6 first:mt-0">
      <p className="text-[#6B7280] text-[11px] font-bold uppercase tracking-[0.16em]">{label}</p>
      <span className="text-[#9CA3AF] text-[12px] font-semibold">{count}</span>
    </div>
  );
}

/* ── Confirmed worker row (attendance + pay / no-show / remove) ───────────── */
function ConfirmedRow({ w, late, onApprove, onPay, onNoShow, onRemove, onReview, busy }: {
  w: AcceptedWorker; late: boolean;
  onApprove: () => void; onPay: () => void; onNoShow: () => void; onRemove: () => void; onReview: () => void;
  busy: boolean;
}) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[12px] px-3.5 py-3 flex flex-col gap-2.5">
      <div className="flex items-center gap-3">
        <Avatar url={w.photoUrl} name={w.username} />
        <div className="flex-1 min-w-0">
          <p className="text-[#111827] font-semibold text-[14px] truncate">
            {w.username ? `@${w.username}` : 'Worker'}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {Number(w.rating) > 0 && (
              <span className="flex items-center gap-0.5 text-[11px] text-[#6B7280]">
                <Star size={10} aria-hidden className="text-[#FFD700] fill-[#FFD700]" />
                {Number(w.rating).toFixed(1)}
              </span>
            )}
            {w.clock_in && (
              <span className="flex items-center gap-1 text-[11px] text-[#6B7280]">
                <Clock3 size={10} aria-hidden />
                {new Date(w.clock_in).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                {w.clock_out && ` – ${new Date(w.clock_out).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
              </span>
            )}
            {(w.overtimeHours ?? 0) > 0 && (
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">
                {w.overtimeHours}h OT
              </span>
            )}
          </div>
        </div>
        {late
          ? <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border bg-red-50 border-red-200 text-red-500">Late</span>
          : <AttendanceChip a={w.attendance} />}
      </div>

      <div className="flex gap-2">
        {w.attendance === 'done' && !w.approved && (
          <button type="button" disabled={busy} onClick={onApprove}
            className="flex-1 h-9 rounded-[8px] bg-[#0A1628] text-white text-[12px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-60">
            <Clock3 size={13} aria-hidden />
            Review &amp; Approve
          </button>
        )}
        {w.attendance === 'done' && w.approved && !w.paid && (
          <button type="button" disabled={busy} onClick={onPay}
            className="flex-1 h-9 rounded-[8px] bg-emerald-600 text-white text-[12px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-60">
            <DollarSign size={13} aria-hidden />
            Pay ${(w.approvedPay ?? 0).toFixed(2)}
          </button>
        )}
        {w.paid && (
          <span className="flex-1 h-9 rounded-[8px] bg-emerald-50 border border-emerald-200 text-emerald-600 text-[12px] font-bold flex items-center justify-center gap-1.5">
            <CheckCircle2 size={13} aria-hidden /> Paid
          </span>
        )}
        {w.attendance === 'done' && !w.alreadyReviewed && (
          <button type="button" onClick={onReview}
            className="flex-1 h-9 rounded-[8px] border border-[#E5E7EB] text-[#111827] text-[12px] font-bold flex items-center justify-center gap-1.5">
            <Star size={13} aria-hidden /> Rate
          </button>
        )}
        {(w.attendance === 'no_show' || late) && (
          <button type="button" disabled={busy} onClick={onNoShow}
            className="flex-1 h-9 rounded-[8px] border border-red-200 bg-red-50 text-red-500 text-[12px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-60">
            <Flag size={13} aria-hidden /> Report no-show
          </button>
        )}
        {(w.attendance === 'booked') && (
          <button type="button" disabled={busy} onClick={onRemove}
            className="flex-1 h-9 rounded-[8px] border border-[#E5E7EB] text-[#6B7280] text-[12px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60">
            <X size={13} aria-hidden /> Remove
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Timesheet review sheet (approve hours + overtime) ───────────────────── */
function ReviewSheet({ w, payRate, busy, onApprove, onClose }: {
  w: AcceptedWorker; payRate: number; busy: boolean;
  onApprove: (breakMinutes: number) => void; onClose: () => void;
}) {
  const grossH = w.clock_in && w.clock_out
    ? (Date.parse(w.clock_out) - Date.parse(w.clock_in)) / 3_600_000 : 0;
  const [breakMin, setBreakMin] = useState<number>(Math.round(w.breakMinutes ?? 0));
  const billable = Math.max(0, grossH - breakMin / 60);
  const regular = Math.min(billable, 8);
  const overtime = Math.max(0, billable - 8);
  const pay = regular * payRate + overtime * payRate * 1.5;
  const fmt = (h: number) => `${h.toFixed(2)}h`;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-[390px] max-h-[85dvh] overflow-y-auto bg-white rounded-t-[20px] px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+32px)]">
        <div className="w-10 h-1 rounded-full bg-[#DBDBDB] mx-auto mb-4" />
        <p className="text-[#111827] font-bold text-[17px] mb-1">Review timesheet</p>
        <p className="text-[#6B7280] text-[13px] mb-4">
          {w.username ? `@${w.username}` : 'Worker'} · {payRate ? `$${payRate}/hr` : ''}
        </p>

        <div className="bg-[#FAFAFA] border border-[#E5E7EB] rounded-[12px] px-4 py-3 mb-4 flex flex-col gap-2.5">
          <div className="flex justify-between text-[14px]"><span className="text-[#6B7280]">Clocked time</span><span className="text-[#111827] font-semibold">{fmt(grossH)}</span></div>
          <div className="flex items-center justify-between">
            <span className="text-[#6B7280] text-[14px]">Unpaid break (min)</span>
            <input type="number" min={0} value={breakMin}
              onChange={(e) => setBreakMin(Math.max(0, parseInt(e.target.value || '0') || 0))}
              className="w-20 h-9 rounded-[8px] border border-[#E5E7EB] bg-white px-2.5 text-[14px] text-[#111827] text-right outline-none focus:border-[#0A1628]" />
          </div>
          {billable > 6 && breakMin < 30 && (
            <p className="text-[11px] text-amber-600">Tip: shifts over 6h usually include a 30-min unpaid break.</p>
          )}
          <div className="border-t border-[#E5E7EB] my-0.5" />
          <div className="flex justify-between text-[14px]"><span className="text-[#6B7280]">Regular hours</span><span className="text-[#111827] font-semibold">{fmt(regular)}</span></div>
          {overtime > 0 && (
            <div className="flex justify-between text-[14px]"><span className="text-amber-600">Overtime (1.5×)</span><span className="text-amber-600 font-semibold">{fmt(overtime)}</span></div>
          )}
          <div className="flex justify-between text-[15px] pt-1"><span className="text-[#111827] font-bold">Approved pay</span><span className="text-[#111827] font-bold">${pay.toFixed(2)}</span></div>
        </div>

        <button type="button" disabled={busy} onClick={() => onApprove(breakMin)}
          className="w-full h-[50px] rounded-[10px] bg-[#0A1628] text-white font-bold text-[15px] disabled:opacity-60">
          {busy ? 'Approving…' : 'Approve timesheet'}
        </button>
        <button type="button" onClick={onClose} className="w-full h-11 mt-1 text-[#6B7280] font-semibold text-[14px]">
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ── Roster screen ───────────────────────────────────────────────────────── */
export function ApplicantsScreen() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { role } = useProfile();
  const { data: shift, isLoading: shiftLoading } = useShiftById(id);
  const { applicants, isLoading: appsLoading, approve, decline, refetch: refetchApps } = useShiftApplicants(id);
  const { workers: confirmed, isLoading: confLoading, refetch: refetchConfirmed } = useAcceptedWorkers(id);
  const { invites, refetch: refetchInvites } = useShiftInvites(id);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [reviewing, setReviewing] = useState<AcceptedWorker | null>(null);

  const loading = shiftLoading || appsLoading || confLoading;
  const pending = applicants.filter((a) => a.status === 'pending');
  const standby = applicants.filter((a) => a.status === 'standby');
  const invitedPending = invites.filter(
    (i) => i.status === 'pending' && !confirmed.some((c) => c.workerId === i.worker_id),
  );
  const total = shift?.spotsTotal ?? confirmed.length;
  const fillPct = Math.min(100, Math.round((confirmed.length / Math.max(total, 1)) * 100));

  // Live day-of attendance.
  const startMs = shift?.startTimeISO ? Date.parse(shift.startTimeISO) : NaN;
  const started = Number.isFinite(startMs) && Date.now() > startMs;
  const isLate = (w: AcceptedWorker) => w.attendance === 'booked' && started && !w.clock_in;
  const onSiteCount = confirmed.filter((w) => w.attendance === 'on_site').length;
  const doneCount   = confirmed.filter((w) => w.attendance === 'done').length;
  const noShowCount = confirmed.filter((w) => w.attendance === 'no_show').length;
  const lateCount   = confirmed.filter(isLate).length;
  // Shift state gates: no booking actions once cancelled/over; no over-booking.
  const endMs  = shift?.endTimeISO ? Date.parse(shift.endTimeISO) : NaN;
  const closed = shift?.status === 'cancelled' || (Number.isFinite(endMs) && Date.now() > endMs);
  const isFull = !!shift && confirmed.length >= total;

  function refetchAll() { void refetchApps(); void refetchConfirmed(); void refetchInvites(); }

  // Auto-refresh every 30s so the roster stays live during a shift.
  useEffect(() => {
    const t = setInterval(() => { void refetchApps(); void refetchConfirmed(); }, 30_000);
    return () => clearInterval(t);
  }, [refetchApps, refetchConfirmed]);

  async function handleBroadcast() {
    if (!user?.id || !id || inviting) return;
    setInviting(true);
    const r = await broadcastShiftRequest(user.id, id);
    setInviting(false);
    if (r.ok) { showToast(`Invited ${r.invited ?? 0} worker${r.invited === 1 ? '' : 's'}! They can accept to claim a spot.`); refetchInvites(); }
    else showToast(r.message ?? 'Could not send invites.', 'error');
  }

  async function handleRemove(w: AcceptedWorker) {
    if (!user?.id || busyId) return;
    setBusyId(w.id);
    try {
      await apiClient(user.id).patch(`/applications/${w.id}`, { status: 'declined' });
      showToast('Worker removed.');
      refetchAll();
    } catch { showToast('Could not remove worker.', 'error'); }
    finally { setBusyId(null); }
  }

  async function handleNoShow(w: AcceptedWorker) {
    if (!user?.id || busyId) return;
    setBusyId(w.id);
    try {
      await apiClient(user.id).post('/applications/no-show', { shift_id: id, worker_id: w.workerId });
      showToast('No-show reported — our team will review it.');
      refetchAll();
    } catch (e) { showToast(e instanceof Error ? e.message : 'Could not report no-show.', 'error'); }
    finally { setBusyId(null); }
  }

  async function handlePay(w: AcceptedWorker) {
    if (!user?.id || !id || busyId) return;
    setBusyId(w.id);
    try {
      await startShiftPayment(user.id, { shift_id: id, worker_id: w.workerId, amount: w.approvedPay ?? w.totalPay ?? 0 });
    } catch (e) { showToast(e instanceof Error ? e.message : 'Could not start payment.', 'error'); }
    finally { setBusyId(null); }
  }

  async function handleApprove(w: AcceptedWorker, breakMinutes: number) {
    if (!user?.id || !id) return;
    setBusyId(w.id);
    try {
      await apiClient(user.id).post('/time-entries/approve', {
        shift_id: id, worker_id: w.workerId, break_minutes: breakMinutes,
      });
      showToast('Timesheet approved. You can pay this worker now.');
      setReviewing(null);
      refetchAll();
    } catch (e) { showToast(e instanceof Error ? e.message : 'Could not approve.', 'error'); }
    finally { setBusyId(null); }
  }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      {/* Header */}
      <div className="px-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-4 border-b border-[#DBDBDB] flex items-center gap-3 flex-shrink-0">
        <button type="button" aria-label="Go back"
          onClick={() => { if (window.history.length > 1) window.history.back(); else navigate(`/shift/${id ?? ''}`); }}
          className="w-9 h-9 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center flex-shrink-0">
          <ChevronLeft size={18} aria-hidden className="text-black" />
        </button>
        <div className="min-w-0">
          <h1 className="text-black font-bold text-[18px] leading-tight truncate">Roster</h1>
          <p className="text-[#737373] text-[12px] truncate">
            {[shift?.jobType, shift?.companyName].filter(Boolean).join(' · ') || 'Shift'}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-10">
        {/* Fill bar */}
        <div className="bg-[#FAFAFA] border border-[#E5E7EB] rounded-[14px] px-4 py-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#111827] font-bold text-[15px] flex items-center gap-1.5">
              <Users size={15} aria-hidden className="text-[#6B7280]" />
              {confirmed.length} / {total} confirmed
            </span>
            <span className="text-[#6B7280] text-[12px] font-semibold">{fillPct}% filled</span>
          </div>
          <div className="w-full h-2 rounded-full bg-[#E5E7EB] overflow-hidden">
            <div className="h-full rounded-full bg-[#10B981] transition-all duration-500" style={{ width: `${fillPct}%` }} />
          </div>
          {/* Live attendance summary */}
          {confirmed.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-200">{onSiteCount} on-site</span>
              {lateCount > 0 && <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-500 border border-red-200">{lateCount} late</span>}
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">{doneCount} done</span>
              {noShowCount > 0 && <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#FAFAFA] text-[#737373] border border-[#DBDBDB]">{noShowCount} no-show</span>}
            </div>
          )}
        </div>

        {/* Actions — hidden once the shift is cancelled or over */}
        {closed && (
          <div className="mb-3 rounded-[10px] bg-[#FAFAFA] border border-[#DBDBDB] px-4 py-3 text-center">
            <p className="text-[#737373] text-[13px] font-semibold">
              {shift?.status === 'cancelled' ? 'This shift was cancelled.' : 'This shift has ended.'}
            </p>
          </div>
        )}
        {!closed && (
        <div className="flex gap-2 mb-2">
          <button type="button" onClick={() => void handleBroadcast()} disabled={inviting}
            className="flex-1 h-[46px] rounded-[8px] bg-[#0095F6] text-white font-bold text-[13px] flex items-center justify-center gap-2 disabled:opacity-60">
            <Send size={15} aria-hidden />
            {inviting ? 'Sending…' : 'Request All Workers'}
          </button>
          {role === 'staffer' && (
            <button type="button" onClick={() => navigate(`/shift/${id}/assign`)}
              className="flex-1 h-[46px] rounded-[8px] border border-[#0A1628] text-[#0A1628] font-bold text-[13px] flex items-center justify-center gap-2">
              <UserPlus size={15} aria-hidden />
              Assign from Roster
            </button>
          )}
        </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-[#DBDBDB] border-t-[#0A1628] animate-spin" role="status" aria-label="Loading roster" />
          </div>
        ) : (
          <>
            {/* Confirmed */}
            <SectionHeader label="Confirmed" count={confirmed.length} />
            {confirmed.length === 0 ? (
              <p className="text-[#9CA3AF] text-[13px] px-1">No one confirmed yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {confirmed.map((w) => (
                  <ConfirmedRow key={w.id} w={w} late={isLate(w)} busy={busyId === w.id}
                    onApprove={() => setReviewing(w)}
                    onPay={() => void handlePay(w)}
                    onNoShow={() => void handleNoShow(w)}
                    onRemove={() => void handleRemove(w)}
                    onReview={() => navigate(`/review/${id}/${w.workerId}`)} />
                ))}
              </div>
            )}

            {/* Pending applications */}
            {pending.length > 0 && (
              <>
                <SectionHeader label="Applied — needs review" count={pending.length} />
                <div className="flex flex-col gap-2">
                  {pending.map((a) => (
                    <div key={a.applicationId} className="bg-white border border-[#E5E7EB] rounded-[12px] px-3.5 py-3 flex items-center gap-3">
                      <Avatar url={a.photoUrl} name={a.username} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[#111827] font-semibold text-[14px] truncate">
                          {a.username ? `@${a.username}` : 'Applicant'}
                        </p>
                        {a.matchScore !== null && (
                          <p className="text-[#0095F6] text-[11px] font-bold">{a.matchScore}% match</p>
                        )}
                      </div>
                      <button type="button" aria-label="Decline"
                        onClick={() => void decline(a.applicationId).then((err) => { showToast(err ?? 'Declined.', err ? 'error' : 'success'); refetchAll(); })}
                        className="w-9 h-9 rounded-full border border-[#E5E7EB] flex items-center justify-center">
                        <X size={16} aria-hidden className="text-[#6B7280]" />
                      </button>
                      <button type="button" aria-label="Approve"
                        onClick={() => {
                          if (isFull) { showToast('Shift is full — remove someone first.', 'error'); return; }
                          void approve(a.applicationId).then((err) => { if (err) { showToast(err, 'error'); return; } showToast('Worker confirmed!'); refetchAll(); });
                        }}
                        className="w-9 h-9 rounded-full bg-[#10B981] flex items-center justify-center">
                        <Check size={17} aria-hidden className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* A spot freed up and people are waiting — prompt the staffer */}
            {!isFull && standby.length > 0 && !closed && (
              <div className="mt-4 rounded-[10px] bg-amber-50 border border-amber-200 px-4 py-3">
                <p className="text-amber-700 text-[13px] font-semibold">
                  A spot is open — confirm a standby worker below to fill it.
                </p>
              </div>
            )}

            {/* Standby (accepted while full — confirm when a spot opens) */}
            {standby.length > 0 && (
              <>
                <SectionHeader label="Standby — waitlist" count={standby.length} />
                <div className="flex flex-col gap-2">
                  {standby.map((a) => (
                    <div key={a.applicationId} className="bg-white border border-amber-200 rounded-[12px] px-3.5 py-3 flex items-center gap-3">
                      <Avatar url={a.photoUrl} name={a.username} />
                      <p className="flex-1 min-w-0 text-[#111827] font-semibold text-[14px] truncate">
                        {a.username ? `@${a.username}` : 'Worker'}
                      </p>
                      <button type="button"
                        onClick={() => void decline(a.applicationId).then((err) => { showToast(err ?? 'Removed from waitlist.', err ? 'error' : 'success'); refetchAll(); })}
                        className="w-9 h-9 rounded-full border border-[#E5E7EB] flex items-center justify-center">
                        <X size={16} aria-hidden className="text-[#6B7280]" />
                      </button>
                      <button type="button"
                        onClick={() => void approve(a.applicationId).then((err) => { showToast(err ?? 'Worker confirmed!', err ? 'error' : 'success'); refetchAll(); })}
                        className="h-9 px-3 rounded-full bg-[#10B981] text-white text-[12px] font-bold flex items-center gap-1">
                        <Check size={14} aria-hidden /> Confirm
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Requested (invited, awaiting response) */}
            {invitedPending.length > 0 && (
              <>
                <SectionHeader label="Invited — awaiting reply" count={invitedPending.length} />
                <div className="flex flex-col gap-2">
                  {invitedPending.map((inv: ShiftInvite) => (
                    <div key={inv.id} className="bg-white border border-[#E5E7EB] rounded-[12px] px-3.5 py-3 flex items-center gap-3">
                      <Avatar url={inv.worker_photo} name={inv.worker_username} />
                      <p className="flex-1 min-w-0 text-[#111827] font-semibold text-[14px] truncate">
                        {inv.worker_username ? `@${inv.worker_username}` : 'Worker'}
                      </p>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border bg-[#FAFAFA] border-[#DBDBDB] text-[#737373] flex items-center gap-1">
                        <AlarmClock size={11} aria-hidden /> Invited
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {confirmed.length === 0 && pending.length === 0 && invitedPending.length === 0 && standby.length === 0 && (
              <div className="text-center py-10">
                <p className="text-[#6B7280] text-[13px]">No one on the roster yet. Tap “Request All Workers” to invite people.</p>
              </div>
            )}
          </>
        )}
      </div>

      {reviewing && (
        <ReviewSheet w={reviewing} payRate={shift?.payRate ?? 0} busy={busyId === reviewing.id}
          onApprove={(brk) => void handleApprove(reviewing, brk)}
          onClose={() => setReviewing(null)} />
      )}
    </div>
  );
}
