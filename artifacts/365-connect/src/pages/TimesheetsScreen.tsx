/**
 * Live timesheets — /shift/:id/timesheets (shift owner only).
 *
 * During the shift: a real-time board of every booked worker — scheduled
 * start, when they actually clocked in (on time / late), whether they are
 * working or on break, hours ticking, and when they clocked out. The board
 * refreshes the moment anything changes (Realtime ping) and polls as a
 * fallback.
 *
 * After clock-out: the poster signs off every timesheet — one tap to
 * approve as recorded, "Review" to adjust the break / time, or "Approve all"
 * for every clean timesheet at once. Disputed hours and missing clock-outs
 * always go through the review sheet.
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, Clock3, Coffee, LogIn, LogOut, CheckCircle2, AlertTriangle, MessageCircle, UserX, Hourglass,
} from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { TimesheetReviewSheet } from '@/components/TimesheetReviewSheet';
import { LoadError } from '@/components/StateView';
import { useAcceptedWorkers, type AcceptedWorker } from '@/hooks/useAcceptedWorkers';
import { useShiftLivePings, PENDING_APPROVALS_KEY } from '@/hooks/useLiveTimesheets';
import { useShiftById } from '@/hooks/useShifts';
import { getOrCreateDirectConversation } from '@/hooks/useConversations';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiClient } from '@/lib/api';
import { personName } from '@/lib/person';
import { formatTime, shiftHeadline } from '@/lib/supabase';
import { dayParts, timeRange } from '@/lib/jobFormat';

const LATE_GRACE_MS = 5 * 60_000;

function isHourly(payPeriod: string | null | undefined): boolean {
  const p = (payPeriod ?? 'hr').trim().toLowerCase();
  return p === 'hr' || p === 'hour' || p === 'hourly' || p === 'h';
}

/** Pay for `hours` — same rule as the server: 8h regular, then 1.5×; flat rates are flat. */
function payFor(hours: number, rate: number, period: string | null | undefined): number {
  if (!(rate > 0)) return 0;
  if (!isHourly(period)) return rate;
  return Math.min(hours, 8) * rate + Math.max(0, hours - 8) * rate * 1.5;
}

const usd = (n: number) => `$${n.toFixed(2)}`;

function hm(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / 60_000));
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}

function clockFace(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function minsLabel(ms: number): string {
  const m = Math.round(Math.abs(ms) / 60_000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
}

type Phase = 'not_in' | 'late' | 'working' | 'break' | 'out' | 'no_show' | 'missing_out';

type Row = {
  w: AcceptedWorker;
  phase: Phase;
  /** worked time so far (minus breaks), ms */
  workedMs: number;
  /** break so far incl. an open break, ms */
  breakMs: number;
  /** clock-in vs scheduled start (+ late, − early), ms */
  inDelta: number | null;
  estPay: number;
  needsApproval: boolean;
  /** approvable in one tap: clocked out, not disputed, not approved */
  clean: boolean;
};

const PHASE: Record<Phase, { label: string; cls: string; dot?: string }> = {
  not_in:      { label: 'Not in yet',    cls: 'bg-[#F3F4F6] border-[#E5E7EB] text-[#4B5563]' },
  late:        { label: 'Late · not in', cls: 'bg-red-50 border-red-200 text-red-700' },
  working:     { label: 'Working',       cls: 'bg-emerald-50 border-emerald-200 text-emerald-700', dot: 'bg-emerald-500' },
  break:       { label: 'On break',      cls: 'bg-amber-50 border-amber-200 text-amber-800', dot: 'bg-amber-500' },
  out:         { label: 'Clocked out',   cls: 'bg-blue-50 border-blue-200 text-blue-700' },
  no_show:     { label: 'No-show',       cls: 'bg-red-50 border-red-200 text-red-700' },
  missing_out: { label: 'Forgot to clock out', cls: 'bg-amber-50 border-amber-200 text-amber-800' },
};

export function TimesheetsScreen() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const qc = useQueryClient();
  const { data: shift, isLoading: shiftLoading } = useShiftById(id);
  const { workers, isLoading, isError, refetch } = useAcceptedWorkers(id, undefined, 15_000);
  const [reviewing, setReviewing] = useState<AcceptedWorker | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);

  useShiftLivePings(id, () => { void refetch(); });

  const startMs = shift?.startTimeISO ? Date.parse(shift.startTimeISO) : NaN;
  const endMs = shift?.endTimeISO ? Date.parse(shift.endTimeISO) : NaN;
  const tz = shift?.timezone ?? null;
  const rate = shift?.payRate ?? 0;
  const period = shift?.payPeriod ?? 'hr';

  const booked = workers;
  const anyOnClock = booked.some((w) => w.clock_in && !w.clock_out);

  // Tick every second while someone is on the clock, else once a minute (late flags).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), anyOnClock ? 1000 : 60_000);
    return () => clearInterval(t);
  }, [anyOnClock]);

  const ended = Number.isFinite(endMs) && now > endMs;
  const live = Number.isFinite(startMs) && now >= startMs - 10 * 60_000 && !ended;

  const rows: Row[] = useMemo(() => booked.map((w) => {
    const inMs = w.clock_in ? Date.parse(w.clock_in) : NaN;
    const outMs = w.clock_out ? Date.parse(w.clock_out) : NaN;
    const openBreak = !w.clock_out && w.breakStartedAt ? Math.max(0, now - Date.parse(w.breakStartedAt)) : 0;
    const breakMs = (w.breakMinutes ?? 0) * 60_000 + openBreak;
    const until = Number.isFinite(outMs) ? outMs : now;
    const workedMs = Number.isFinite(inMs) ? Math.max(0, until - inMs - breakMs) : 0;
    let phase: Phase;
    if (w.clock_out) phase = 'out';
    else if (w.clock_in) phase = ended ? 'missing_out' : w.breakStartedAt ? 'break' : 'working';
    else if (ended) phase = 'no_show';
    else if (Number.isFinite(startMs) && now > startMs + LATE_GRACE_MS) phase = 'late';
    else phase = 'not_in';
    const disputed = w.workerAck === 'disputed';
    const needsApproval = !w.paid && ((phase === 'out' && !w.approved) || (w.approved && disputed) || phase === 'missing_out');
    return {
      w, phase, workedMs, breakMs,
      inDelta: Number.isFinite(inMs) && Number.isFinite(startMs) ? inMs - startMs : null,
      estPay: w.approved && w.approvedPay != null ? w.approvedPay
        : w.clock_out && w.totalPay != null ? w.totalPay
        : payFor(workedMs / 3_600_000, rate, period),
      needsApproval,
      clean: phase === 'out' && !w.approved && !disputed && !w.paid,
    };
  }), [booked, now, ended, startMs, rate, period]);

  // Needs you first, then on the clock, then not in, then settled.
  const order: Record<Phase, number> = { missing_out: 0, out: 1, working: 3, break: 3, late: 4, not_in: 5, no_show: 6 };
  const sorted = [...rows].sort((a, b) => {
    const ka = a.needsApproval ? 0 : order[a.phase] + (a.w.approved ? 10 : 0);
    const kb = b.needsApproval ? 0 : order[b.phase] + (b.w.approved ? 10 : 0);
    return ka - kb || personName(a.w, '').localeCompare(personName(b.w, ''));
  });

  const count = (p: Phase[]) => rows.filter((r) => p.includes(r.phase)).length;
  const toApprove = rows.filter((r) => r.needsApproval);
  const clean = rows.filter((r) => r.clean);
  const approvedCount = rows.filter((r) => r.w.approved && r.w.workerAck !== 'disputed').length;
  const totalWorked = rows.reduce((s, r) => s + r.workedMs, 0);
  const totalCost = rows.reduce((s, r) => s + (r.w.clock_in ? r.estPay : 0), 0);

  function afterChange() {
    void refetch();
    void qc.invalidateQueries({ queryKey: PENDING_APPROVALS_KEY });
  }

  async function approve(w: AcceptedWorker, breakMinutes: number, clockOutISO?: string, totalHours?: number) {
    if (!user?.id || !id) return false;
    await apiClient(user.id).post('/time-entries/approve', {
      shift_id: id, worker_id: w.workerId, break_minutes: breakMinutes,
      ...(clockOutISO ? { clock_out: clockOutISO } : {}),
      ...(totalHours != null ? { total_hours: totalHours } : {}),
    });
    return true;
  }

  async function quickApprove(w: AcceptedWorker) {
    setBusyId(w.id);
    try {
      await approve(w, Math.round(w.breakMinutes ?? 0));
      showToast(`${personName(w, 'Timesheet')} approved.`);
      afterChange();
    } catch (e) { showToast(e instanceof Error ? e.message : 'Could not approve.', 'error'); }
    finally { setBusyId(null); }
  }

  async function approveAll() {
    setApprovingAll(true);
    let ok = 0; let failed = 0;
    for (const r of clean) {
      try { await approve(r.w, Math.round(r.w.breakMinutes ?? 0)); ok++; } catch { failed++; }
    }
    setApprovingAll(false);
    setConfirmAll(false);
    showToast(failed ? `Approved ${ok}; ${failed} could not be approved. Try those one by one.` : `Approved ${ok} timesheet${ok === 1 ? '' : 's'}.`, failed ? 'error' : 'success');
    afterChange();
  }

  async function message(w: AcceptedWorker) {
    if (!user?.id || !id) return;
    const cid = await getOrCreateDirectConversation(user.id, w.workerId, id);
    if (cid) navigate(`/messages/${cid}`);
    else showToast('Could not open a chat with this worker.', 'error');
  }

  const day = shift?.startTimeISO ? dayParts(shift.startTimeISO, tz) : null;

  return (
    <div className="min-h-[100dvh] bg-[#F7F8FA] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-[#E5E7EB] px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Back" data-testid="btn-timesheets-back"
            onClick={() => { if (window.history.length > 1) window.history.back(); else navigate(`/shift/${id}`); }}
            className="w-10 h-10 rounded-full bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-center flex-shrink-0">
            <ChevronLeft size={18} aria-hidden className="text-[#0A1628]" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-[#111827] font-bold text-[18px] leading-tight">Timesheets</h1>
              {live && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5" data-testid="live-pill">
                  <span className="relative flex w-2 h-2"><span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-60" /><span className="relative w-2 h-2 rounded-full bg-emerald-500" /></span>
                  Live
                </span>
              )}
              {ended && <span className="text-[11px] font-bold uppercase tracking-wider text-[#4B5563] bg-[#F3F4F6] border border-[#E5E7EB] rounded-full px-2 py-0.5">Ended</span>}
            </div>
            <p className="text-[#4B5563] text-[13px] truncate">
              {shift ? shiftHeadline(shift) : shiftLoading ? 'Loading…' : ''}
            </p>
            {shift && (
              <p className="text-[#6B7280] text-[12px] truncate">
                {day ? `${day.rel}, ${day.date} · ` : ''}{timeRange(shift.startTimeISO, shift.endTimeISO, tz)}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+32px)] flex flex-col gap-3 max-w-app w-full mx-auto">
        {isError && !workers.length ? (
          <LoadError what="the timesheets" onRetry={() => void refetch()} />
        ) : (
          <>
            {/* Live head-count */}
            <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-4" data-testid="timesheets-summary">
              <div className="grid grid-cols-4 gap-2 text-center">
                {([
                  ['Working', count(['working']), 'text-emerald-700'],
                  ['On break', count(['break']), 'text-amber-700'],
                  ['Not in', count(['not_in', 'late', 'no_show']), count(['late', 'no_show']) ? 'text-red-600' : 'text-[#111827]'],
                  ['Out', count(['out', 'missing_out']), 'text-blue-700'],
                ] as const).map(([label, n, cls]) => (
                  <div key={label}>
                    <p className={`text-[22px] font-bold leading-none ${cls}`}>{n}</p>
                    <p className="text-[11px] text-[#4B5563] font-semibold mt-1.5">{label}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-[#F3F4F6] mt-4 pt-3 flex items-center justify-between text-[13px]">
                <span className="text-[#4B5563]">Hours worked <b className="text-[#111827]">{hm(totalWorked)}</b></span>
                <span className="text-[#4B5563]">Est. labor <b className="text-[#111827]">{usd(totalCost)}</b></span>
              </div>
              {booked.length > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-[12px] text-[#4B5563] mb-1.5">
                    <span>Timesheets approved</span><span className="font-semibold text-[#111827]">{approvedCount} of {booked.length}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#F3F4F6] overflow-hidden">
                    <div className="h-full rounded-full bg-[#059669] transition-all duration-500" style={{ width: `${(approvedCount / booked.length) * 100}%` }} />
                  </div>
                </div>
              )}
            </div>

            {/* What needs you */}
            {toApprove.length > 0 && (
              <div className="rounded-[14px] bg-[#0A1628] text-white px-4 py-3.5 flex items-center gap-3" data-testid="approve-banner">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[15px]">{toApprove.length} timesheet{toApprove.length === 1 ? '' : 's'} to approve</p>
                  <p className="text-white/75 text-[12px] mt-0.5">Check the times, then approve so your crew gets paid.</p>
                </div>
                {clean.length > 1 && (
                  <button type="button" onClick={() => setConfirmAll(true)} data-testid="btn-approve-all"
                    className="h-10 px-3.5 rounded-[10px] bg-white text-[#0A1628] text-[13px] font-bold flex-shrink-0">
                    Approve all ({clean.length})
                  </button>
                )}
              </div>
            )}

            {(isLoading && !workers.length) ? (
              <div className="flex flex-col gap-3" aria-label="Loading timesheets">
                {[0, 1, 2].map((i) => <div key={i} className="h-[150px] rounded-[14px] bg-white border border-[#E5E7EB] animate-pulse" />)}
              </div>
            ) : booked.length === 0 ? (
              <div className="bg-white border border-[#E5E7EB] rounded-[14px] px-5 py-10 text-center">
                <p className="text-[#111827] font-bold text-[15px]">No one is booked yet</p>
                <p className="text-[#6B7280] text-[13px] mt-1">Once workers are confirmed, their clock-ins show up here live.</p>
                <button type="button" onClick={() => navigate(`/shift/${id}/applicants`)}
                  className="mt-4 h-10 px-4 rounded-[10px] bg-[#0A1628] text-white text-[13px] font-bold">Go to crew</button>
              </div>
            ) : (
              sorted.map((r) => (
                <WorkerCard key={r.w.id} r={r} tz={tz} startISO={shift?.startTimeISO ?? null} endISO={shift?.endTimeISO ?? null}
                  busy={busyId === r.w.id || approvingAll}
                  onApprove={() => void quickApprove(r.w)} onReview={() => setReviewing(r.w)} onMessage={() => void message(r.w)} />
              ))
            )}

            {booked.some((w) => w.approved && !w.paid) && (
              <button type="button" onClick={() => navigate(`/shift/${id}/applicants`)}
                className="text-[#2563EB] text-[13px] font-semibold py-2">
                Pay approved workers on the Crew screen →
              </button>
            )}
          </>
        )}
      </div>

      {reviewing && (
        <TimesheetReviewSheet w={reviewing} payRate={rate} payPeriod={period}
          timezone={tz} shiftEndISO={shift?.endTimeISO ?? null} busy={busyId === reviewing.id}
          onApprove={async (brk, out, total) => {
            setBusyId(reviewing.id);
            try {
              await approve(reviewing, brk, out, total);
              showToast(`${personName(reviewing, 'Timesheet')} approved.`);
              setReviewing(null);
              afterChange();
            } catch (e) { showToast(e instanceof Error ? e.message : 'Could not approve.', 'error'); }
            finally { setBusyId(null); }
          }}
          onClose={() => setReviewing(null)} />
      )}

      <ConfirmSheet open={confirmAll} title={`Approve ${clean.length} timesheets?`}
        body={<span>Each worker is approved for the hours they clocked, minus their recorded breaks. Disputed hours and missing clock-outs aren't included; review those one by one.</span>}
        confirmLabel={approvingAll ? 'Approving…' : `Approve ${clean.length}`} busy={approvingAll}
        onConfirm={() => void approveAll()} onCancel={() => setConfirmAll(false)} />
    </div>
  );
}

function WorkerCard({ r, tz, startISO, endISO, busy, onApprove, onReview, onMessage }: {
  r: Row; tz: string | null; startISO: string | null; endISO: string | null; busy: boolean;
  onApprove: () => void; onReview: () => void; onMessage: () => void;
}) {
  const { w, phase } = r;
  const chip = w.paid ? { label: 'Paid', cls: 'bg-emerald-50 border-emerald-200 text-emerald-700' }
    : w.approved && w.workerAck !== 'disputed' ? { label: 'Approved', cls: 'bg-emerald-50 border-emerald-200 text-emerald-700' }
    : PHASE[phase];
  const onClock = phase === 'working' || phase === 'break';
  const disputed = w.workerAck === 'disputed';
  const inNote = r.inDelta == null ? null
    : r.inDelta > LATE_GRACE_MS ? { text: `${minsLabel(r.inDelta)} late`, cls: 'text-red-600' }
    : r.inDelta < -60_000 ? { text: `${minsLabel(r.inDelta)} early`, cls: 'text-[#4B5563]' }
    : { text: 'On time', cls: 'text-emerald-700' };

  return (
    <div className={`bg-white rounded-[14px] border p-4 ${r.needsApproval ? 'border-[#0A1628]/30 shadow-[0_0_0_1px_rgba(10,22,40,0.06)]' : 'border-[#E5E7EB]'}`}
      data-testid={`timesheet-row-${w.workerId}`}>
      <div className="flex items-center gap-3">
        <Avatar src={w.photoUrl} name={personName(w, '')} size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-[#111827] font-bold text-[15px] truncate">{personName(w, 'Worker')}</p>
          <span className={`mt-1 inline-flex items-center gap-1.5 text-[11px] font-bold rounded-full border px-2 py-0.5 ${chip.cls}`} data-testid="timesheet-status">
            {'dot' in chip && chip.dot && <span className={`w-1.5 h-1.5 rounded-full ${chip.dot} ${onClock ? 'animate-pulse' : ''}`} />}
            {chip.label}
          </span>
        </div>
        <button type="button" aria-label={`Message ${personName(w, 'worker')}`} onClick={onMessage}
          className="w-9 h-9 rounded-full border border-[#E5E7EB] flex items-center justify-center flex-shrink-0">
          <MessageCircle size={16} aria-hidden className="text-[#374151]" />
        </button>
      </div>

      {/* Scheduled vs actual */}
      <div className="grid grid-cols-3 gap-2 mt-3.5">
        <Cell icon={<Clock3 size={13} aria-hidden />} label="Scheduled"
          value={startISO ? formatTime(startISO, tz) : '—'} note={endISO ? `to ${formatTime(endISO, tz)}` : undefined} />
        <Cell icon={<LogIn size={13} aria-hidden />} label="Clocked in"
          value={w.clock_in ? formatTime(w.clock_in, tz) : '—'}
          note={inNote?.text ?? (phase === 'late' ? 'Not here yet' : phase === 'no_show' ? 'Never clocked in' : undefined)}
          noteCls={inNote?.cls ?? (phase === 'late' || phase === 'no_show' ? 'text-red-600' : undefined)} />
        <Cell icon={<LogOut size={13} aria-hidden />} label="Clocked out"
          value={w.clock_out ? formatTime(w.clock_out, tz) : '—'}
          note={phase === 'missing_out' ? 'Still clocked in' : onClock ? 'On the clock' : undefined}
          noteCls={phase === 'missing_out' ? 'text-amber-700' : 'text-emerald-700'} />
      </div>

      {/* Hours */}
      {w.clock_in && (
        <div className="mt-3 rounded-[10px] bg-[#F9FAFB] border border-[#F3F4F6] px-3 py-2.5 flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] text-[#4B5563] font-semibold">{onClock ? 'Worked so far' : 'Hours worked'}</p>
            <p className="text-[#111827] font-bold text-[17px] tabular-nums" data-testid="timesheet-worked">
              {onClock ? clockFace(r.workedMs) : hm(r.workedMs)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[11px] text-[#4B5563] font-semibold flex items-center gap-1 justify-center"><Coffee size={11} aria-hidden /> Break</p>
            <p className={`font-bold text-[15px] tabular-nums ${phase === 'break' ? 'text-amber-700' : 'text-[#111827]'}`}>{Math.round(r.breakMs / 60_000)} min</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-[#4B5563] font-semibold">{w.approved ? 'Approved pay' : 'Est. pay'}</p>
            <p className="text-[#111827] font-bold text-[15px] tabular-nums">{usd(r.estPay)}</p>
          </div>
        </div>
      )}

      {/* Worker's own sign-off */}
      {(w.workerAck || phase === 'out') && !w.paid && (
        <div className="mt-2.5">
          {w.workerAck === 'accepted' && <p className="text-[12px] font-semibold text-emerald-700 flex items-center gap-1.5"><CheckCircle2 size={13} aria-hidden /> Worker confirmed these hours</p>}
          {disputed && (
            <div className="rounded-[10px] bg-amber-50 border border-amber-200 px-3 py-2">
              <p className="text-[12px] font-bold text-amber-800 flex items-center gap-1.5"><AlertTriangle size={13} aria-hidden /> Worker disputes these hours</p>
              {w.dispute_note && <p className="text-[13px] text-amber-900 mt-0.5">“{w.dispute_note}”</p>}
            </div>
          )}
          {!w.workerAck && phase === 'out' && <p className="text-[12px] font-semibold text-[#4B5563] flex items-center gap-1.5"><Hourglass size={13} aria-hidden /> Waiting for the worker to confirm</p>}
        </div>
      )}

      {/* Actions */}
      {r.needsApproval && (
        <div className="flex gap-2 mt-3">
          {r.clean ? (
            <>
              <button type="button" disabled={busy} onClick={onApprove} data-testid="btn-timesheet-approve"
                className="flex-1 h-10 rounded-[10px] bg-[#0A1628] text-white text-[14px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-60">
                <CheckCircle2 size={15} aria-hidden /> {busy ? 'Approving…' : 'Approve'}
              </button>
              <button type="button" disabled={busy} onClick={onReview} data-testid="btn-timesheet-review"
                className="h-10 px-4 rounded-[10px] border border-[#D1D5DB] bg-white text-[#111827] text-[14px] font-semibold disabled:opacity-60">
                Adjust
              </button>
            </>
          ) : (
            <button type="button" disabled={busy} onClick={onReview} data-testid="btn-timesheet-review"
              className="flex-1 h-10 rounded-[10px] bg-[#0A1628] text-white text-[14px] font-bold disabled:opacity-60">
              {phase === 'missing_out' ? 'Set clock-out & approve' : disputed ? 'Review dispute' : 'Review & approve'}
            </button>
          )}
        </div>
      )}
      {phase === 'no_show' && (
        <p className="mt-3 text-[12px] text-[#4B5563] flex items-center gap-1.5"><UserX size={13} aria-hidden /> Nothing to approve. Report a no-show from the Crew screen.</p>
      )}
    </div>
  );
}

function Cell({ icon, label, value, note, noteCls }: { icon: React.ReactNode; label: string; value: string; note?: string; noteCls?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-[#4B5563] font-semibold flex items-center gap-1">{icon}{label}</p>
      <p className="text-[#111827] font-bold text-[15px] mt-0.5 tabular-nums">{value}</p>
      {note && <p className={`text-[11px] font-semibold mt-0.5 ${noteCls ?? 'text-[#4B5563]'}`}>{note}</p>}
    </div>
  );
}
