import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
  ChevronLeft, Check, X, Star, Send, UserPlus, Users, AlarmClock,
  CheckCircle2, Flag, DollarSign, Clock3, MessageCircle, MessagesSquare,
} from 'lucide-react';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { useShiftRanking } from '@/hooks/useMatch';
import { getOrCreateDirectConversation, openShiftGroupChat } from '@/hooks/useConversations';
import { useShiftApplicants } from '@/hooks/useShiftApplicants';
import { useAcceptedWorkers, type AcceptedWorker, type Attendance, type DayOfStatus } from '@/hooks/useAcceptedWorkers';
import { isToday } from '@/hooks/useArrivalStatus';
import { useShiftInvites, type ShiftInvite } from '@/hooks/useShiftInvites';
import { useShiftById } from '@/hooks/useShifts';
import { broadcastShiftRequest } from '@/hooks/useShiftRequests';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/contexts/RoleContext';
import { useToast } from '@/contexts/ToastContext';
import { useProfile } from '@/hooks/useProfile';
import { apiClient } from '@/lib/api';
import { startShiftPayment } from '@/lib/checkout';
import { formatTime } from '@/lib/supabase';
import { utcToZonedParts, zonedTimeToUtc, zoneAbbrev, DEFAULT_SHIFT_TZ } from '@/lib/timezone';

/** Hourly pay periods; anything else is a flat total. Mirrors the server's computePay. */
function isHourly(payPeriod: string | null | undefined): boolean {
  const p = (payPeriod ?? 'hr').trim().toLowerCase();
  return p === 'hr' || p === 'hour' || p === 'hourly' || p === 'h';
}

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

/** The worker's own day-of report (or "Clocked in" once a time entry exists). */
const DAY_OF: Record<NonNullable<DayOfStatus>, { label: string; cls: string }> = {
  on_my_way:    { label: 'On the way',   cls: 'bg-blue-50 border-blue-200 text-blue-600' },
  running_late: { label: 'Running late', cls: 'bg-amber-50 border-amber-200 text-amber-700' },
  arrived:      { label: 'Arrived',      cls: 'bg-emerald-50 border-emerald-200 text-emerald-600' },
  clocked_in:   { label: 'Clocked in',   cls: 'bg-emerald-50 border-emerald-200 text-emerald-600' },
};

function DayOfChip({ s }: { s: DayOfStatus }) {
  if (!s) return null;
  const m = DAY_OF[s];
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${m.cls}`}>{m.label}</span>;
}

/** "3 on the way · 1 late · 2 arrived" for the day of the shift. */
function dayOfSummary(workers: AcceptedWorker[]): string {
  const n = (s: DayOfStatus) => workers.filter((w) => w.dayOfStatus === s).length;
  const parts: string[] = [];
  if (n('on_my_way'))    parts.push(`${n('on_my_way')} on the way`);
  if (n('running_late')) parts.push(`${n('running_late')} late`);
  if (n('arrived'))      parts.push(`${n('arrived')} arrived`);
  if (n('clocked_in'))   parts.push(`${n('clocked_in')} clocked in`);
  return parts.length ? parts.join(' · ') : 'No day-of updates from workers yet.';
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
function ConfirmedRow({ w, late, closed, timezone, onApprove, onPay, onNoShow, onRemove, onReview, onMessage, busy }: {
  w: AcceptedWorker; late: boolean;
  /** The shift has ended — a worker still "on site" forgot to clock out. */
  closed: boolean;
  /** The venue's zone: clock times are shown in it, like every other time in the app. */
  timezone: string | null;
  onApprove: () => void; onPay: () => void; onNoShow: () => void; onRemove: () => void; onReview: () => void;
  onMessage: () => void;
  busy: boolean;
}) {
  const forgotClockOut = w.attendance === 'on_site' && closed;
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[12px] px-3.5 py-3 flex flex-col gap-2.5">
      <div className="flex items-center gap-3">
        <Avatar url={w.photoUrl} name={w.username} />
        <button type="button" aria-label={`Message ${w.username ? `@${w.username}` : 'worker'}`} onClick={onMessage}
          className="order-last w-9 h-9 rounded-full border border-[#E5E7EB] flex items-center justify-center flex-shrink-0 text-[#0A1628]">
          <MessageCircle size={15} aria-hidden />
        </button>
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
                {formatTime(w.clock_in, timezone)}
                {w.clock_out && ` – ${formatTime(w.clock_out, timezone)}`}
              </span>
            )}
            {(w.overtimeHours ?? 0) > 0 && (
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">
                {w.overtimeHours}h OT
              </span>
            )}
            {w.approved && w.workerAck === 'accepted' && (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5">
                Accepted by worker
              </span>
            )}
            {w.approved && w.workerAck === 'disputed' && (
              <span className="text-[10px] font-bold text-red-500 bg-red-50 border border-red-200 rounded-full px-1.5 py-0.5"
                title={w.dispute_note ?? undefined}>
                Disputed
              </span>
            )}
            {!w.clock_out && <DayOfChip s={w.dayOfStatus} />}
          </div>
        </div>
        {late
          ? <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border bg-red-50 border-red-200 text-red-500">Late</span>
          : <AttendanceChip a={w.attendance} />}
      </div>

      <div className="flex gap-2">
        {/* Approve once; after a dispute the manager can adjust and approve again. */}
        {(w.attendance === 'done' || forgotClockOut) && (!w.approved || w.workerAck === 'disputed') && (
          <button type="button" disabled={busy} onClick={onApprove}
            className="flex-1 h-9 rounded-[8px] bg-[#0A1628] text-white text-[12px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-60">
            <Clock3 size={13} aria-hidden />
            {forgotClockOut ? 'Set clock-out & approve' : w.workerAck === 'disputed' ? 'Adjust & re-approve' : 'Review & Approve'}
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
        {/* Rating: once the worker is done (or the shift is over), one tap
            opens the review flow; afterwards the stars they gave stay visible. */}
        {(w.attendance === 'done' || closed) && w.attendance !== 'no_show' && !w.alreadyReviewed && (
          <button type="button" onClick={onReview}
            className="flex-1 h-9 rounded-[8px] border border-[#E5E7EB] text-[#111827] text-[12px] font-bold flex items-center justify-center gap-1.5">
            <Star size={13} aria-hidden /> Rate
          </button>
        )}
        {w.alreadyReviewed && (
          <span className="flex-1 h-9 rounded-[8px] bg-[#FAFAFA] border border-[#E5E7EB] text-[#6B7280] text-[12px] font-bold flex items-center justify-center gap-1"
            aria-label={`You rated this worker ${w.myReviewRating ?? ''} stars`}>
            Rated <Star size={12} aria-hidden className="text-[#FFD700] fill-[#FFD700]" />{w.myReviewRating ?? ''}
          </span>
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
function ReviewSheet({ w, payRate, payPeriod, timezone, shiftEndISO, busy, onApprove, onClose }: {
  w: AcceptedWorker; payRate: number; payPeriod: string | null; timezone: string | null;
  shiftEndISO: string | null; busy: boolean;
  onApprove: (breakMinutes: number, clockOutISO?: string) => void; onClose: () => void;
}) {
  const tz = timezone || DEFAULT_SHIFT_TZ;
  const hourly = isHourly(payPeriod);
  // Forgot to clock out: the manager sets the clock-out (defaults to the
  // scheduled end) and the server records it before approving. The picker
  // works in the venue's wall clock, not the manager's device zone.
  const needsClockOut = !!w.clock_in && !w.clock_out;
  const toVenueInput = (iso: string) => {
    const p = utcToZonedParts(iso, tz);
    return p.date && p.time ? `${p.date}T${p.time}` : '';
  };
  const fromVenueInput = (local: string): string | null => {
    const [date, time] = local.split('T');
    return date && time ? zonedTimeToUtc(date, time, tz) : null;
  };
  const [clockOutLocal, setClockOutLocal] = useState<string>(() =>
    needsClockOut ? toVenueInput(shiftEndISO && Date.parse(shiftEndISO) > Date.parse(w.clock_in!) ? shiftEndISO : new Date().toISOString()) : '');
  const clockOutISO = needsClockOut && clockOutLocal ? fromVenueInput(clockOutLocal) : (w.clock_out ?? null);
  const grossH = w.clock_in && clockOutISO
    ? Math.max(0, (Date.parse(clockOutISO) - Date.parse(w.clock_in)) / 3_600_000) : 0;
  const [breakMin, setBreakMin] = useState<number>(Math.round(w.breakMinutes ?? 0));
  const billable = Math.max(0, grossH - breakMin / 60);
  // Same rule as the server: hourly pays regular up to 8h then 1.5× beyond;
  // a day / event rate is a flat amount whatever the hours.
  const regular = hourly ? Math.min(billable, 8) : billable;
  const overtime = hourly ? Math.max(0, billable - 8) : 0;
  const pay = hourly ? regular * payRate + overtime * payRate * 1.5 : (payRate > 0 ? payRate : 0);
  const fmt = (h: number) => `${h.toFixed(2)}h`;
  const zoneLabel = w.clock_in ? zoneAbbrev(w.clock_in, tz) : '';

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-app max-h-[85dvh] overflow-y-auto bg-white rounded-t-[20px] px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+32px)]">
        <div className="w-10 h-1 rounded-full bg-[#DBDBDB] mx-auto mb-4" />
        <p className="text-[#111827] font-bold text-[17px] mb-1">Review timesheet</p>
        <p className="text-[#6B7280] text-[13px] mb-4">
          {w.username ? `@${w.username}` : 'Worker'} · {payRate ? (hourly ? `$${payRate}/hr` : `$${payRate} flat per ${payPeriod}`) : ''}
        </p>

        <div className="bg-[#FAFAFA] border border-[#E5E7EB] rounded-[12px] px-4 py-3 mb-4 flex flex-col gap-2.5">
          {needsClockOut && (
            <div className="flex flex-col gap-1 pb-1 border-b border-[#E5E7EB]">
              <p className="text-[12px] text-amber-700 font-semibold">
                This worker never clocked out. Set when they finished{zoneLabel ? ` (${zoneLabel}, venue time)` : ''}:
              </p>
              <input type="datetime-local" value={clockOutLocal} min={w.clock_in ? toVenueInput(w.clock_in) : undefined}
                onChange={(e) => setClockOutLocal(e.target.value)} aria-label="Clock-out time"
                className="h-10 rounded-[8px] border border-[#E5E7EB] bg-white px-2.5 text-[14px] text-[#111827] outline-none focus:border-[#0A1628]" />
            </div>
          )}
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
          <div className="flex justify-between text-[14px]"><span className="text-[#6B7280]">{hourly ? 'Regular hours' : 'Billable hours'}</span><span className="text-[#111827] font-semibold">{fmt(regular)}</span></div>
          {overtime > 0 && (
            <div className="flex justify-between text-[14px]"><span className="text-amber-600">Overtime (1.5×)</span><span className="text-amber-600 font-semibold">{fmt(overtime)}</span></div>
          )}
          {!hourly && (
            <p className="text-[11px] text-[#9CA3AF]">Flat {payPeriod} rate — the hours are recorded but do not change the pay.</p>
          )}
          <div className="flex justify-between text-[15px] pt-1"><span className="text-[#111827] font-bold">Approved pay</span><span className="text-[#111827] font-bold">${pay.toFixed(2)}</span></div>
        </div>

        <button type="button" disabled={busy || (needsClockOut && grossH <= 0)}
          onClick={() => onApprove(breakMin, needsClockOut && clockOutISO ? clockOutISO : undefined)}
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
  const { isAdmin } = useRole();
  const { data: shift, isLoading: shiftLoading, error: shiftError, refetch: refetchShift } = useShiftById(id);
  // Only the poster (or an admin) manages a roster; anyone else gets a plain
  // "not yours" state instead of a management screen whose calls all 403.
  const canManage = !shift || !user?.id || isAdmin || shift.clientId === user.id;
  const { applicants, isLoading: appsLoading, approve, decline, refetch: refetchApps } = useShiftApplicants(id);
  const { workers: confirmed, isLoading: confLoading, refetch: refetchConfirmed } = useAcceptedWorkers(id);
  const { invites, refetch: refetchInvites } = useShiftInvites(id);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);

  /** Open the shift's group chat (everyone confirmed + the manager). */
  async function handleShiftChat() {
    if (!user?.id || !id || openingChat) return;
    setOpeningChat(true);
    const r = await openShiftGroupChat(user.id, id);
    setOpeningChat(false);
    if (r.id) navigate(`/messages/${r.id}`);
    else showToast(r.error ?? 'Could not open the shift chat.', 'error');
  }

  /** One-tap DM with a worker, pinned to this shift. */
  async function handleMessageWorker(workerId: string) {
    if (!user?.id || !id) return;
    const cid = await getOrCreateDirectConversation(user.id, workerId, id);
    if (cid) navigate(`/messages/${cid}`);
    else showToast('Could not open a chat with this worker.', 'error');
  }
  const [reviewing, setReviewing] = useState<AcceptedWorker | null>(null);
  const [confirmBroadcast, setConfirmBroadcast] = useState(false);

  const loading = shiftLoading || appsLoading || confLoading;
  const pending = applicants.filter((a) => a.status === 'pending');
  // Best candidates first, using the server's insight (history + AI) when available.
  const ranking = useShiftRanking(id, pending.length > 0 || applicants.some((a) => a.status === 'standby'));
  const rankedPending = [...pending].sort((x, y) =>
    (ranking.byWorker.get(y.worker_id)?.score ?? y.matchScore ?? 0) - (ranking.byWorker.get(x.worker_id)?.score ?? x.matchScore ?? 0));
  const standby = applicants.filter((a) => a.status === 'standby');
  const invitedPending = invites.filter(
    (i) => i.status === 'pending' && !confirmed.some((c) => c.workerId === i.worker_id),
  );
  const invitedDeclined = invites.filter((i) => i.status === 'declined');
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
  // Day of the shift (or in progress): show the workers' own status roll-up.
  const dayOf = !closed && confirmed.length > 0 && (started || isToday(shift?.startTimeISO));
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
      // The server charges the approved pay on the timesheet; no amount is sent.
      await startShiftPayment(user.id, { shift_id: id, worker_id: w.workerId });
    } catch (e) { showToast(e instanceof Error ? e.message : 'Could not start payment.', 'error'); refetchAll(); }
    finally { setBusyId(null); }
  }

  /** Approve / decline a pending or standby application, one request at a time per row. */
  async function handleDecide(applicationId: string, action: 'approve' | 'decline', successMsg: string) {
    if (busyId) return;
    if (action === 'approve' && isFull) { showToast('Shift is full — remove someone first.', 'error'); return; }
    setBusyId(applicationId);
    try {
      const err = action === 'approve' ? await approve(applicationId) : await decline(applicationId);
      showToast(err ?? successMsg, err ? 'error' : 'success');
      refetchAll();
    } finally { setBusyId(null); }
  }

  async function handleApprove(w: AcceptedWorker, breakMinutes: number, clockOutISO?: string) {
    if (!user?.id || !id) return;
    setBusyId(w.id);
    try {
      await apiClient(user.id).post('/time-entries/approve', {
        shift_id: id, worker_id: w.workerId, break_minutes: breakMinutes,
        // Manager override for a worker who forgot to clock out.
        ...(clockOutISO ? { clock_out: clockOutISO } : {}),
      });
      showToast('Timesheet approved. You can pay this worker now.');
      setReviewing(null);
      refetchAll();
    } catch (e) { showToast(e instanceof Error ? e.message : 'Could not approve.', 'error'); }
    finally { setBusyId(null); }
  }

  if (!canManage) {
    return (
      <div className="min-h-[100dvh] bg-white flex flex-col items-center justify-center px-8 gap-3 text-center">
        <div className="w-16 h-16 rounded-full bg-[#FAFAFA] border border-[#E5E7EB] flex items-center justify-center">
          <Users size={26} aria-hidden className="text-[#9CA3AF]" />
        </div>
        <p className="text-[#111827] font-bold text-[17px]">You don't manage this shift</p>
        <p className="text-[#6B7280] text-[13px] max-w-[260px]">
          Only the poster can see applicants and the roster for {[shift?.jobType, shift?.companyName].filter(Boolean).join(' at ') || 'this shift'}.
        </p>
        <button type="button" onClick={() => navigate(`/shift/${id ?? ''}`)}
          className="mt-2 h-[40px] px-5 rounded-full bg-[#0A1628] text-white text-[13px] font-bold">
          View the shift
        </button>
      </div>
    );
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
        {/* Shift chat — one thread with the manager and everyone confirmed */}
        <button type="button" onClick={() => void handleShiftChat()} disabled={openingChat}
          className="w-full h-[46px] mb-2 rounded-[8px] bg-[#0A1628] text-white font-bold text-[13px] flex items-center justify-center gap-2 disabled:opacity-60">
          <MessagesSquare size={15} aria-hidden />
          {openingChat ? 'Opening…' : `Shift chat${confirmed.length ? ` · ${confirmed.length + 1} people` : ''}`}
        </button>
        {!closed && (
        <div className="flex gap-2 mb-2">
          <button type="button" onClick={() => setConfirmBroadcast(true)} disabled={inviting}
            className="flex-1 h-[46px] rounded-[8px] bg-[#0095F6] text-white font-bold text-[13px] flex items-center justify-center gap-2 disabled:opacity-60">
            <Send size={15} aria-hidden />
            {inviting ? 'Sending…' : 'Request All Workers'}
          </button>
          <ConfirmSheet
            open={confirmBroadcast}
            title="Invite matching workers?"
            body={<>Every available worker{shift?.rosterOnly ? ' on your roster' : ''} whose roles match <b>{shift?.jobTypes?.join(', ') || shift?.jobType || 'this shift'}</b> gets a notification and an offer to accept a spot. Workers who already applied or were invited are skipped.</>}
            confirmLabel="Send invites"
            busy={inviting}
            onConfirm={() => { setConfirmBroadcast(false); void handleBroadcast(); }}
            onCancel={() => setConfirmBroadcast(false)}
          />
          {(role === 'staffer' || role === 'client') && (
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
        ) : shiftError && !shift ? (
          <div className="rounded-[12px] bg-[#FAFAFA] border border-[#DBDBDB] px-5 py-8 text-center">
            <p className="text-[#111827] font-semibold text-[14px]">Couldn't load this roster.</p>
            <p className="text-[#737373] text-[12px] mt-1">Check your connection and try again.</p>
            <button type="button" onClick={() => { void refetchShift(); refetchAll(); }}
              className="mt-4 h-[40px] px-5 rounded-full bg-[#0A1628] text-white text-[13px] font-bold">
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Confirmed */}
            <SectionHeader label="Confirmed" count={confirmed.length} />
            {dayOf && (
              <p className="text-[#374151] text-[12px] font-semibold mb-2 px-1" role="status">
                Today · {dayOfSummary(confirmed)}
              </p>
            )}
            {confirmed.length === 0 ? (
              <p className="text-[#9CA3AF] text-[13px] px-1">No one confirmed yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {confirmed.map((w) => (
                  <ConfirmedRow key={w.id} w={w} late={isLate(w)} closed={closed} busy={busyId === w.id}
                    timezone={shift?.timezone ?? null}
                    onApprove={() => setReviewing(w)}
                    onPay={() => void handlePay(w)}
                    onNoShow={() => void handleNoShow(w)}
                    onRemove={() => void handleRemove(w)}
                    onReview={() => navigate(`/review/${id}/${w.workerId}`)}
                    onMessage={() => void handleMessageWorker(w.workerId)} />
                ))}
              </div>
            )}

            {/* Pending applications */}
            {pending.length > 0 && (
              <>
                <SectionHeader label="Applied — needs review" count={pending.length} />
                <div className="flex flex-col gap-2">
                  {rankedPending.map((a) => {
                    const m = ranking.byWorker.get(a.worker_id);
                    const score = m?.score ?? a.matchScore;
                    return (
                    <div key={a.applicationId} className="bg-white border border-[#E5E7EB] rounded-[12px] px-3.5 py-3 flex items-center gap-3">
                      <Avatar url={a.photoUrl} name={a.username} />
                      <button type="button" aria-label={`Message ${a.username ? `@${a.username}` : 'applicant'}`}
                        onClick={() => void handleMessageWorker(a.worker_id)}
                        className="w-9 h-9 rounded-full border border-[#E5E7EB] flex items-center justify-center flex-shrink-0 text-[#0A1628]">
                        <MessageCircle size={15} aria-hidden />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-[#111827] font-semibold text-[14px] truncate">
                          {a.username ? `@${a.username}` : 'Applicant'}
                          {score != null && (
                            <span className={`ml-2 text-[11px] font-bold ${score >= 75 ? 'text-emerald-600' : score >= 50 ? 'text-[#0095F6]' : 'text-amber-600'}`}>
                              {score} match
                            </span>
                          )}
                        </p>
                        {m?.reason && (
                          <p className="text-[#6B7280] text-[12px] leading-snug mt-0.5 line-clamp-2">{m.reason}</p>
                        )}
                      </div>
                      <button type="button" aria-label="Decline" disabled={!!busyId}
                        onClick={() => void handleDecide(a.applicationId, 'decline', 'Declined.')}
                        className="w-9 h-9 rounded-full border border-[#E5E7EB] flex items-center justify-center disabled:opacity-40">
                        <X size={16} aria-hidden className="text-[#6B7280]" />
                      </button>
                      <button type="button" aria-label="Approve" disabled={!!busyId}
                        onClick={() => void handleDecide(a.applicationId, 'approve', 'Worker confirmed!')}
                        className="w-9 h-9 rounded-full bg-[#10B981] flex items-center justify-center disabled:opacity-40">
                        {busyId === a.applicationId
                          ? <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden />
                          : <Check size={17} aria-hidden className="text-white" />}
                      </button>
                    </div>
                  );})}
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
                <p className="text-[#9CA3AF] text-[12px] px-1 -mt-1 mb-2">
                  Accepted while the shift was full. Confirm one when a spot opens up.
                </p>
                <div className="flex flex-col gap-2">
                  {standby.map((a) => (
                    <div key={a.applicationId} className="bg-white border border-amber-200 rounded-[12px] px-3.5 py-3 flex items-center gap-3">
                      <Avatar url={a.photoUrl} name={a.username} />
                      <button type="button" aria-label={`Message ${a.username ? `@${a.username}` : 'applicant'}`}
                        onClick={() => void handleMessageWorker(a.worker_id)}
                        className="w-9 h-9 rounded-full border border-[#E5E7EB] flex items-center justify-center flex-shrink-0 text-[#0A1628]">
                        <MessageCircle size={15} aria-hidden />
                      </button>
                      <p className="flex-1 min-w-0 text-[#111827] font-semibold text-[14px] truncate">
                        {a.username ? `@${a.username}` : 'Worker'}
                      </p>
                      <button type="button" aria-label="Remove from waitlist" disabled={!!busyId}
                        onClick={() => void handleDecide(a.applicationId, 'decline', 'Removed from waitlist.')}
                        className="w-9 h-9 rounded-full border border-[#E5E7EB] flex items-center justify-center disabled:opacity-40">
                        <X size={16} aria-hidden className="text-[#6B7280]" />
                      </button>
                      <button type="button"
                        disabled={isFull || !!busyId}
                        aria-label={isFull ? 'Shift is full — remove someone to confirm a standby worker' : `Confirm ${a.username ? `@${a.username}` : 'worker'}`}
                        onClick={() => void handleDecide(a.applicationId, 'approve', 'Worker confirmed!')}
                        className="h-9 px-3 rounded-full bg-[#10B981] text-white text-[12px] font-bold flex items-center gap-1 disabled:opacity-40">
                        <Check size={14} aria-hidden /> {busyId === a.applicationId ? 'Confirming…' : 'Confirm'}
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

            {/* Declined invites — muted, so managers know who already said no */}
            {invitedDeclined.length > 0 && (
              <>
                <SectionHeader label="Declined invite" count={invitedDeclined.length} />
                <div className="flex flex-col gap-2 opacity-70">
                  {invitedDeclined.map((inv: ShiftInvite) => (
                    <div key={inv.id} className="bg-[#FAFAFA] border border-[#EFEFEF] rounded-[12px] px-3.5 py-3 flex items-center gap-3">
                      <Avatar url={inv.worker_photo} name={inv.worker_username} />
                      <p className="flex-1 min-w-0 text-[#6B7280] font-semibold text-[14px] truncate">
                        {inv.worker_username ? `@${inv.worker_username}` : 'Worker'}
                      </p>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border bg-white border-[#E5E7EB] text-[#9CA3AF]">
                        Declined
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
        <ReviewSheet w={reviewing} payRate={shift?.payRate ?? 0} payPeriod={shift?.payPeriod ?? null}
          timezone={shift?.timezone ?? null} shiftEndISO={shift?.endTimeISO ?? null} busy={busyId === reviewing.id}
          onApprove={(brk, clockOut) => void handleApprove(reviewing, brk, clockOut)}
          onClose={() => setReviewing(null)} />
      )}
    </div>
  );
}
