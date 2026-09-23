import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Heart, Sparkles, Calendar, Clock, Timer,
  MapPin, Phone, Users, Shirt, CheckCircle2, AlarmClock, Pencil, UserPlus,
  Edit3, Trash2, Navigation, X, Zap, Send, MessageSquareText, MessagesSquare, Repeat2, DollarSign, Star,
} from 'lucide-react';
import { useFeedStore, toggleSaved } from '@/store/feedStore';
import { useApplications } from '@/hooks/useApplications';
import { useToast } from '@/contexts/ToastContext';
import { useApplicationStatus } from '@/hooks/useApplicationStatus';
import { VenueMap } from '@/components/VenueMap';
import { geocodeAddress, type Coords } from '@/lib/geocode';
import { useShiftById } from '@/hooks/useShifts';
import { useProfile } from '@/hooks/useProfile';
import { useMyLocation } from '@/hooks/useMyLocation';
import { computeMatchScore } from '@/lib/matchScore';
import { haversineMiles, formatTime } from '@/lib/supabase';
import { apiClient } from '@/lib/api';
import { resetDraft, setDraft, setEditShiftId } from '@/store/postShiftStore';
import { utcToZonedParts, DEFAULT_SHIFT_TZ } from '@/lib/timezone';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { useMyMatch } from '@/hooks/useMatch';
import { useAuth } from '@/contexts/AuthContext';
import { useMyTimeEntry, useAckHours, formatHoursMinutes } from '@/hooks/useTimeEntry';
import { useExistingReview } from '@/hooks/useReviews';
import { useShiftApplicants } from '@/hooks/useShiftApplicants';
import { useAcceptedWorkers } from '@/hooks/useAcceptedWorkers';
import { useEventPositions } from '@/hooks/useEventPositions';
import { broadcastShiftRequest } from '@/hooks/useShiftRequests';
import { openShiftGroupChat } from '@/hooks/useConversations';
import { ArrivalPills } from '@/components/ArrivalPills';
import { CallOutSheet } from '@/components/CallOutSheet';
import { useArrivalStatus, isDayOfWindow } from '@/hooks/useArrivalStatus';

/** Deep links to open a destination in each navigation app. */
function directionsLinks(lat: number, lng: number, label: string) {
  const q = encodeURIComponent(label || `${lat},${lng}`);
  return {
    apple:  `https://maps.apple.com/?daddr=${lat},${lng}&q=${q}`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    waze:   `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
  };
}

function parseDisplayMinutes(t: string): number {
  const [time, mer] = t.split(' ');
  let [h, m] = time.split(':').map(Number);
  if (mer === 'PM' && h !== 12) h += 12;
  if (mer === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

function calcDuration(start: string, end: string): string {
  let s = parseDisplayMinutes(start), e = parseDisplayMinutes(end);
  if (e <= s) e += 24 * 60;
  const diff = e - s;
  const hrs  = Math.floor(diff / 60);
  const mins = diff % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

/** Returns decimal hours (e.g. 4.5 for 4h30m). Used for cost breakdown. */
function calcDurationHours(start: string, end: string): number {
  let s = parseDisplayMinutes(start), e = parseDisplayMinutes(end);
  if (e <= s) e += 24 * 60;
  return (e - s) / 60;
}

/** Format a number as USD currency, e.g. 123.5 → "$123.50". */
const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

/** Attendance status pill styling for the "who's coming" crew list. */
/* ─── Loading skeleton ───────────────────────────────────────────────────── */
function ShiftDetailSkeleton() {
  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <div className="w-full h-[300px] bg-[#EFEFEF] animate-pulse" />
      <div className="px-5 pt-5 flex flex-col gap-4">
        <div className="flex justify-between">
          <div className="w-28 h-8 rounded-full bg-[#EFEFEF] animate-pulse" />
          <div className="w-20 h-8 rounded-[8px] bg-[#EFEFEF] animate-pulse" />
        </div>
        <div className="flex gap-4 py-2">
          <div className="w-16 h-4 rounded bg-[#EFEFEF] animate-pulse" />
          <div className="w-20 h-4 rounded bg-[#EFEFEF] animate-pulse" />
        </div>
        <div className="flex gap-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex-1 h-20 rounded-[12px] bg-[#EFEFEF] animate-pulse" />
          ))}
        </div>
        <div className="h-px bg-[#DBDBDB]" />
        <div className="space-y-2">
          <div className="w-32 h-5 rounded bg-[#EFEFEF] animate-pulse" />
          <div className="h-20 rounded-[12px] bg-[#EFEFEF] animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="w-40 h-5 rounded bg-[#EFEFEF] animate-pulse" />
          <div className="h-16 rounded bg-[#EFEFEF] animate-pulse" />
          <div className="h-12 rounded bg-[#EFEFEF] animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-black font-bold text-[17px] mb-3 tracking-tight">{children}</h2>;
}

function ClientLogo({ name }: { name: string }) {
  const initials = name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
  return (
    <div aria-hidden
      className="w-[52px] h-[52px] rounded-[12px] bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center flex-shrink-0">
      <span className="text-black font-bold text-[17px] tracking-tight">{initials}</span>
    </div>
  );
}

function StatTile({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent?: boolean;
}) {
  return (
    <div className="flex-1 bg-[#FAFAFA] border border-[#DBDBDB] rounded-[12px] px-3 py-3.5 flex flex-col gap-1.5">
      <div className="w-7 h-7 rounded-[8px] bg-white border border-[#DBDBDB] flex items-center justify-center">{icon}</div>
      <p className="text-[#737373] text-[10px] font-semibold uppercase tracking-wider">{label}</p>
      <p className={`font-bold text-[15px] leading-tight ${accent ? 'text-[#0095F6]' : 'text-black'}`}>{value}</p>
      {sub && <p className="text-[#737373] text-[11px]">{sub}</p>}
    </div>
  );
}

export function ShiftDetailScreen() {
  // ── ALL hooks must be declared here, unconditionally, before any early return ──
  const { id }       = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user }      = useAuth();
  const store        = useFeedStore();
  // useApplications: 7 stable hooks (see hook/useApplications.ts inventory comment)
  const { submitApplication }             = useApplications();
  const {
    status: applicationStatus, applicationId, arrivalStatus, arrivalStatusAt,
    refetch: refetchApplicationStatus,
  } = useApplicationStatus(id);
  const { callOut, busy: callingOut } = useArrivalStatus();
  const profile                           = useProfile();
  const { coords: myCoords, isDefault: myLocationIsDefault } = useMyLocation();
  // Distance (and therefore the AI Match Score's distance component) is
  // computed against the real viewer location, not a hardcoded fallback.
  const { data: shift, isLoading, error } = useShiftById(id, myCoords);
  const [dressCodeDraft, setDressCodeDraft] = useState<string | null>(null);
  const [savingDressCode, setSavingDressCode] = useState(false);
  // The worker's own timesheet for this shift (null until they clock in).
  const { entry: myEntry } = useMyTimeEntry(id);
  const { ack: ackHours, busy: acking } = useAckHours();
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeNote, setDisputeNote] = useState('');
  // Has this worker already rated the poster for this shift?
  const isWorkerForHooks = profile.role === 'worker';
  const { existing: myReview } = useExistingReview(id, user?.id, isWorkerForHooks ? shift?.clientId : undefined);
  const isOwnerForHooks = !!user?.id && !!shift && user.id === shift.clientId;
  const { applicants: pendingApplicants } = useShiftApplicants(isOwnerForHooks ? id : undefined);
  const { workers: acceptedWorkers } = useAcceptedWorkers(
    isOwnerForHooks ? id : undefined,
    isOwnerForHooks ? user?.id : undefined,
  );
  const { positions: eventPositions } = useEventPositions(shift?.eventId ?? undefined);
  // Server-side insight (real history + Claude when configured). Declared here,
  // before the loading/error returns, so the hook order never changes.
  const myMatch = useMyMatch(shift?.id, profile.role === 'worker');
  const { showToast } = useToast();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [inviting, setInviting] = useState(false);

  async function handleBroadcast() {
    if (!user?.id || !id || inviting) return;
    setInviting(true);
    const r = await broadcastShiftRequest(user.id, id);
    setInviting(false);
    if (r.ok) showToast(`Invited ${r.invited ?? 0} worker${r.invited === 1 ? '' : 's'}! They can accept to claim a spot.`);
    else showToast(r.message ?? 'Could not send invites.', 'error');
  }
  // Coordinates resolved from the shift's ADDRESS TEXT — used so the map, pin,
  // distance, and directions match the address even when the stored lat/lng are
  // wrong (older shifts saved with the poster's own location).
  const [venueCoords, setVenueCoords] = useState<Coords | null>(null);
  const [dropping, setDropping] = useState(false);
  const [confirmDrop, setConfirmDrop] = useState(false);
  const [confirmCallOut, setConfirmCallOut] = useState(false);
  const [confirmBroadcast, setConfirmBroadcast] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);
  const qc = useQueryClient();
  // ── No more hooks below this line ────────────────────────────────────────────

  async function handleShiftChat() {
    if (!user?.id || !id || openingChat) return;
    setOpeningChat(true);
    const r = await openShiftGroupChat(user.id, id);
    setOpeningChat(false);
    if (r.id) navigate(`/messages/${r.id}`);
    else showToast(r.error ?? 'Could not open the shift chat.', 'error');
  }

  useEffect(() => {
    let cancelled = false;
    setVenueCoords(null);
    const addr = shift?.location?.trim();
    if (!addr) return;
    void geocodeAddress(addr).then((c) => { if (!cancelled && c) setVenueCoords(c); });
    return () => { cancelled = true; };
  }, [shift?.location]);

  if (isLoading) return <ShiftDetailSkeleton />;

  if (error) {
    return (
      <div className="min-h-[100dvh] bg-white flex flex-col items-center justify-center px-6 gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center mb-2">
          <span className="text-[#737373] text-[24px]">⚠</span>
        </div>
        <p className="text-[#737373] text-[15px] font-medium">Couldn't load this shift</p>
        <p className="text-[#AAAAAA] text-[12px]">Check your connection and try again.</p>
        <button type="button" onClick={() => window.location.reload()}
          className="mt-2 text-[#0095F6] font-semibold text-[14px]">Retry</button>
        <button type="button"
          onClick={() => { if (window.history.length > 1) window.history.back(); else navigate('/jobs'); }}
          className="text-[#737373] text-[13px]">← Go back</button>
      </div>
    );
  }

  if (!shift) {
    return (
      <div className="min-h-[100dvh] bg-white flex flex-col items-center justify-center px-6 gap-4 text-center">
        <p className="text-[#737373] text-[15px]">This shift is no longer available.</p>
        <button type="button"
          onClick={() => { if (window.history.length > 1) window.history.back(); else navigate('/jobs'); }}
          className="text-[#0095F6] font-semibold text-[14px]">← Browse shifts</button>
      </div>
    );
  }

  const shiftId     = shift.id;
  // Completion is tracked per-worker via time_entries.clock_out.
  const hasCompleted = !!myEntry?.clock_out;
  const saved       = store.isSaved(shiftId);
  const spotsLow    = shift.spotsAvailable < 3;
  const duration    = calcDuration(shift.startTime, shift.endTime);
  const spotsFilled = shift.spotsTotal - shift.spotsAvailable;
  const fillPct     = Math.round((spotsFilled / Math.max(shift.spotsTotal, 1)) * 100);
  const isOwner     = !!user?.id && user.id === shift.clientId;
  // Only clients/staffers may manage a shift. A worker (incl. an admin viewing
  // the app as a worker) never sees owner controls, even on a shift they own.
  const canManage   = isOwner && (profile.role === 'client' || profile.role === 'staffer');
  const isWorker    = profile.role === 'worker';

  const matchScore = isWorker
    ? computeMatchScore(shift, {
        primaryJobType: profile.primaryJobType,
        secondaryJobTypes: profile.secondaryJobTypes,
        availability: profile.availability,
        rating: profile.rating,
      })
    : null;

  // Prefer coordinates resolved from the address text; fall back to stored.
  const shiftCoords = venueCoords ?? { lat: shift.lat, lng: shift.lng };
  const distanceFromShift = haversineMiles(myCoords.lat, myCoords.lng, shiftCoords.lat, shiftCoords.lng);
  const distanceMilesLabel = Math.round(distanceFromShift * 10) / 10;
  const withinClockInRange = distanceFromShift <= 1;
  // Clock-in time window: opens 1 hour before the shift's start (call time), so
  // workers can't clock in days early. Nowsta-style.
  const startMs      = shift.startTimeISO ? Date.parse(shift.startTimeISO) : NaN;
  const clockOpensMs = Number.isFinite(startMs) ? startMs - 60 * 60 * 1000 : NaN;
  const clockOpen    = !Number.isFinite(clockOpensMs) || Date.now() >= clockOpensMs;
  const clockOpensLabel = Number.isFinite(clockOpensMs)
    ? new Date(clockOpensMs).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : '';
  // The button is gated by TIME only. Distance is checked with live GPS on the
  // clock-in screen itself — the stored profile location used here can be
  // miles away from the venue and would otherwise lock the button forever.
  const canClockIn   = clockOpen;
  // Lifecycle: Upcoming → In progress → Ended (uses start/end timestamps).
  const endMs = shift.endTimeISO ? Date.parse(shift.endTimeISO) : NaN;
  const lifecycle: 'upcoming' | 'in_progress' | 'ended' =
    Number.isFinite(endMs) && Date.now() > endMs ? 'ended'
    : Number.isFinite(startMs) && Date.now() >= startMs ? 'in_progress'
    : 'upcoming';

  // Real CTA states, per applications.status + time_entries completion:
  //   no row → apply | pending → Pending Approval | declined → Not Selected
  //   accepted+not clocked out → Clock In (gold, 1mi gate) | accepted+clocked out → Completed
  // Completion is tracked per-worker via time_entries.clock_out rather than
  // shifts.status, since RLS only lets the shift's client owner update shifts.
  const canClaim = shift.instantClaim && shift.spotsAvailable > 0;
  type CtaState =
    | 'apply' | 'claim' | 'pending' | 'declined' | 'withdrawn' | 'clock-in' | 'completed'
    | 'standby' | 'cancelled' | 'past' | 'full';
  // Order matters: a booked worker still sees clock-in/completed on a past shift,
  // but an unbooked worker must never be offered Apply on a cancelled/ended/full one.
  const ctaState: CtaState =
    shift.status === 'cancelled'
      ? 'cancelled'
      : applicationStatus === 'accepted'
      // Booked: clock in while the shift is live; once it has ended there is
      // nothing left to do, so never dangle a dead "Clock In" button.
      ? (hasCompleted ? 'completed' : lifecycle === 'ended' ? 'past' : 'clock-in')
      : applicationStatus === 'standby'
      ? 'standby'
      : applicationStatus === 'pending'
      ? (lifecycle === 'ended' ? 'past' : 'pending')
      : applicationStatus === 'declined' || applicationStatus === 'rejected'
      ? 'declined'
      // A dropped application isn't final: while the shift is still open the
      // worker may apply again (the server flips the row back to pending).
      : applicationStatus === 'withdrawn'
      ? (lifecycle === 'ended' ? 'past' : shift.spotsAvailable <= 0 ? 'withdrawn' : canClaim ? 'claim' : 'apply')
      : lifecycle === 'ended'
      ? 'past'
      : shift.spotsAvailable <= 0
      ? 'full'
      : canClaim
      ? 'claim'
      : 'apply';

  // Day-of pills ("On my way" / "Running late") for a booked worker once the
  // shift is within 12 hours or in progress.
  const showArrivalPills = ctaState === 'clock-in' && !!applicationId
    && isDayOfWindow(shift.startTimeISO, shift.endTimeISO);

  /** Refresh every cache that reflects this shift's booking state. */
  function invalidateShiftCaches() {
    void qc.invalidateQueries({ queryKey: ['worker-home-shifts'] });
    void qc.invalidateQueries({ queryKey: ['shifts'] });
    void qc.invalidateQueries({ queryKey: ['shift', shiftId] });
    void qc.invalidateQueries({ queryKey: ['application-status'] });
    void qc.invalidateQueries({ queryKey: ['my-applications'] });
    void qc.invalidateQueries({ queryKey: ['my-shift-ids'] });
  }

  /** Runs after the worker confirms in the drop sheet. */
  async function handleDrop() {
    if (!user?.id || dropping) return;
    setDropping(true);
    try {
      await apiClient(user.id).post('/applications/withdraw', { shift_id: shiftId });
      invalidateShiftCaches();
      setConfirmDrop(false);
      if (applicationStatus === 'pending') {
        // Stay on the shift — they may change their mind and apply again.
        showToast('Application withdrawn.');
        void refetchApplicationStatus();
        return;
      }
      showToast(applicationStatus === 'standby' ? 'You left the waitlist.' : 'You dropped this shift.');
      navigate('/home');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not drop the shift.', 'error');
    } finally { setDropping(false); }
  }

  /** "Looks right" / "Dispute" on approved hours the poster changed. */
  async function handleAck(action: 'accept' | 'dispute') {
    if (!myEntry) return;
    const err = await ackHours(myEntry.id, action, action === 'dispute' ? disputeNote : undefined);
    if (err) { showToast(err, 'error'); return; }
    setDisputeOpen(false);
    setDisputeNote('');
    showToast(action === 'accept' ? 'Thanks — your hours are confirmed.' : 'The poster has been told. Our team will review it.');
  }

  /** Runs after the worker picks a reason in the call-out sheet. */
  async function handleCallOut(reason: string) {
    if (!applicationId) return;
    const err = await callOut(applicationId, reason);
    if (err) { showToast(err, 'error'); return; }
    invalidateShiftCaches();
    setConfirmCallOut(false);
    showToast('The poster has been told. Your spot was released.');
    navigate('/home');
  }

  async function handleClaim() {
    if (!user?.id || claiming) return;
    setClaiming(true);
    try {
      await apiClient(user.id).post('/applications/claim', { shift_id: shiftId });
      invalidateShiftCaches();
      showToast("You're booked! Shift claimed.");
      navigate('/home');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not claim — it may already be full.', 'error');
    } finally {
      setClaiming(false);
    }
  }

  function handleCta() {
    if (ctaState === 'apply') {
      void submitApplication(
        shiftId,
        matchScore ?? undefined,
        () => { showToast('Applied! The client will review your application.'); void refetchApplicationStatus(); },
        (msg) => showToast(msg, 'error'),
      );
    }
    if (ctaState === 'claim') void handleClaim();
    if (ctaState === 'clock-in' && canClockIn) navigate(`/clock/${shiftId}`);
  }

  async function handleSaveDressCode() {
    if (dressCodeDraft === null || !user?.id) return;
    setSavingDressCode(true);
    try {
      await apiClient(user.id).patch(`/shifts/${shiftId}`, { dress_code: dressCodeDraft });
      setDressCodeDraft(null);
    } catch (e) {
      console.error('[ShiftDetail] dress code save failed:', e);
    } finally {
      setSavingDressCode(false);
    }
  }

  /**
   * Load this shift into the post-shift draft. `edit` updates the shift in
   * place; `clone` ("Post again") starts a new shift with the same details
   * and a blank date.
   */
  async function handleEditShift(mode: 'edit' | 'clone' = 'edit') {
    if (!user?.id || editLoading) return;
    setEditLoading(true);
    try {
      const raw = await apiClient(user.id).get<Record<string, unknown>>(`/shifts/${shiftId}`);
      if (!raw || raw.client_id !== user.id) return;
      // Times are instants; edit them as the venue's wall clock.
      const tz    = (raw.timezone as string | null) || DEFAULT_SHIFT_TZ;
      const start = utcToZonedParts(raw.start_time as string, tz);
      const end   = utcToZonedParts(raw.end_time as string, tz);
      const date       = start.date;
      const start_time = start.time || '18:00';
      const end_time   = end.time   || '23:00';
      const jobTypes   = Array.isArray(raw.job_types) ? (raw.job_types as string[]) : [];
      resetDraft();
      setDraft({
        event_type:      (raw.event_type      as string | null)    ?? '',
        job_type:        (raw.job_type        as string)           ?? '',
        job_types:       jobTypes.length ? jobTypes : ((raw.job_type as string) ? [raw.job_type as string] : []),
        instant_claim:   !!raw.instant_claim,
        visibility:      raw.visibility === 'roster' ? 'roster' : 'public',
        title:           (raw.title           as string)           ?? '',
        location:        (raw.location        as string | null)    ?? '',
        lat:             (raw.lat             as number | null)    ?? 25.7825,
        lng:             (raw.lng             as number | null)    ?? -80.1298,
        unit_info:       (raw.unit_info       as string | null)    ?? '',
        // A re-post keeps everything but needs a fresh date.
        date:            mode === 'edit' ? date : '',
        start_time,
        end_time,
        spots_available: (raw.spots_available as number)           ?? 1,
        pay_rate:        (raw.pay_rate        as number | null)    ?? 0,
        description:     (raw.description     as string | null)    ?? '',
        requirements:    (raw.requirements    as string[] | null)  ?? [],
      });
      setEditShiftId(mode === 'edit' ? shiftId : null);
      // keep=1 stops the name step from wiping the draft we just built.
      navigate('/post-shift/name?keep=1');
    } catch (e) {
      console.error('[ShiftDetail] edit prefill failed:', e);
    } finally {
      setEditLoading(false);
    }
  }

  async function handleCancelShift() {
    if (!user?.id || cancelling) return;
    setCancelling(true);
    try {
      await apiClient(user.id).patch(`/shifts/${shiftId}`, { status: 'cancelled' });
      invalidateShiftCaches();
      void qc.invalidateQueries({ queryKey: ['client-shifts'] });
      void qc.invalidateQueries({ queryKey: ['my-posted-shifts'] });
      setShowCancelConfirm(false);
      showToast('Shift cancelled.');
      navigate('/home');
    } catch (e) {
      console.error('[ShiftDetail] cancel failed:', e);
      showToast(e instanceof Error ? e.message : 'Could not cancel the shift.', 'error');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <>
    <ConfirmSheet
      open={confirmBroadcast}
      title="Invite matching workers?"
      body={<>Every available worker whose roles match <b>{shift.jobTypes.join(', ')}</b> gets a notification and an offer to accept a spot. Workers who already applied or were invited are skipped.</>}
      confirmLabel="Send invites"
      busy={inviting}
      onConfirm={() => { setConfirmBroadcast(false); void handleBroadcast(); }}
      onCancel={() => setConfirmBroadcast(false)}
    />
    {/* Dispute approved hours — optional note, then the poster is told */}
    <ConfirmSheet
      open={disputeOpen}
      title="Dispute these hours?"
      confirmLabel="Send dispute"
      cancelLabel="Never mind"
      tone="danger"
      busy={acking}
      onConfirm={() => void handleAck('dispute')}
      onCancel={() => { if (!acking) { setDisputeOpen(false); setDisputeNote(''); } }}
      body={
        <div className="flex flex-col gap-3">
          <p>
            The poster approved <b>{formatHoursMinutes(myEntry?.total_hours)}</b> but you clocked{' '}
            <b>{formatHoursMinutes(myEntry?.clocked_hours)}</b>. Tell them what happened and our team will take a look.
          </p>
          <textarea value={disputeNote} onChange={(e) => setDisputeNote(e.target.value.slice(0, 500))} rows={3} disabled={acking}
            placeholder="What should the hours be, and why? (optional)" aria-label="Dispute note"
            className="w-full border border-[#E5E7EB] rounded-[12px] px-3 py-2.5 text-[14px] text-[#111827] resize-none outline-none focus:border-[#0A1628] placeholder:text-[#9CA3AF]" />
        </div>
      }
    />
    {/* Cancel confirm overlay */}
    {showCancelConfirm && (
      <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm px-4 pb-8"
        role="dialog" aria-modal="true" aria-label="Confirm shift cancellation">
        <div className="w-full max-w-app bg-white rounded-[20px] p-5 shadow-xl">
          <h2 className="text-[#111827] font-bold text-[18px] mb-2">Cancel this shift?</h2>
          <p className="text-[#6B7280] text-[14px] leading-relaxed mb-5">
            Workers who applied will be notified. This cannot be undone.
          </p>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => void handleCancelShift()}
              disabled={cancelling}
              className="w-full h-[50px] bg-[#EF4444] text-white font-bold text-[15px] rounded-[12px] disabled:opacity-60">
              {cancelling ? 'Cancelling…' : 'Yes, Cancel Shift'}
            </button>
            <button type="button" onClick={() => setShowCancelConfirm(false)}
              className="w-full h-[50px] border border-[#E5E7EB] text-[#6B7280] font-semibold text-[15px] rounded-[12px]">
              Keep Shift
            </button>
          </div>
        </div>
      </div>
    )}
    <div className="min-h-[100dvh] bg-white flex flex-col">

      {/* Reserve room for the fixed worker CTA bar only when it renders (it can be
          up to ~160px tall in the clock-in / standby states); owners get none. */}
      <div className={`flex-1 overflow-y-auto ${profile.role === 'worker' && !isOwner ? (showArrivalPills ? 'pb-[200px]' : 'pb-[150px]') : 'pb-8'}`}>

        {/* Hero photo */}
        <div className="relative w-full h-[300px] flex-shrink-0 overflow-hidden">
          <img src={shift.coverImage} alt={`${shift.jobType} at ${shift.companyName}`}
            loading="eager" decoding="async" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/10 to-black/80" />

          <button type="button" aria-label="Go back"
            onClick={() => { if (window.history.length > 1) window.history.back(); else navigate('/jobs'); }}
            className="absolute top-5 left-4 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center">
            <ChevronLeft size={20} aria-hidden className="text-white" />
          </button>

          <button type="button" aria-label={saved ? 'Remove from saved' : 'Save this shift'}
            aria-pressed={saved} onClick={() => { if (!saved) showToast('Shift saved to your list.'); toggleSaved(shiftId); }}
            className="absolute top-5 right-4 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.span key={saved ? 'on' : 'off'}
                initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.14 }}>
                <Heart size={18} aria-hidden className={saved ? 'text-white fill-white' : 'text-white'} />
              </motion.span>
            </AnimatePresence>
          </button>
        </div>

        {/* Ended / cancelled notice — past shifts stay viewable, but nobody
            should mistake them for something they can still act on. */}
        {(lifecycle === 'ended' || shift.status === 'cancelled') && (
          <div className={`mx-5 mt-4 rounded-[12px] px-4 py-3 border flex items-start gap-3 ${
            shift.status === 'cancelled' ? 'bg-red-50 border-red-200' : 'bg-[#FAFAFA] border-[#DBDBDB]'}`}
            role="status">
            <Clock size={16} aria-hidden className={`flex-shrink-0 mt-0.5 ${shift.status === 'cancelled' ? 'text-red-500' : 'text-[#737373]'}`} />
            <div className="min-w-0">
              <p className={`font-bold text-[14px] ${shift.status === 'cancelled' ? 'text-red-600' : 'text-[#111827]'}`}>
                {shift.status === 'cancelled' ? 'This shift was cancelled' : 'This shift has ended'}
              </p>
              <p className="text-[#6B7280] text-[12px] mt-0.5 leading-relaxed">
                {shift.status === 'cancelled'
                  ? 'It is kept here for your records only.'
                  : canManage
                  ? 'You can still review the roster and approve timesheets, but it no longer accepts workers.'
                  : applicationStatus === 'pending'
                  ? 'It ended before your application was reviewed. It is kept here for your records.'
                  : applicationStatus === 'accepted'
                  ? 'Your record of this shift is kept here.'
                  : 'It is no longer taking applications.'}
              </p>
            </div>
          </div>
        )}

        {/* Job type + pay */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#DBDBDB]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-black text-white text-[12px] font-bold px-4 py-1.5 rounded-full uppercase tracking-wide">
              {shift.jobType}
            </span>
            {shift.eventType && (
              <span className="bg-[#F3F4F6] text-[#0A1628] text-[12px] font-bold px-3 py-1.5 rounded-full border border-[#E5E7EB]">
                {shift.eventType}
              </span>
            )}
            {lifecycle === 'in_progress' && (
              <span className="bg-blue-50 text-blue-600 text-[12px] font-bold px-3 py-1.5 rounded-full border border-blue-200">
                In progress
              </span>
            )}
            {lifecycle === 'ended' && shift.status !== 'cancelled' && (
              <span className="bg-[#FAFAFA] text-[#737373] text-[12px] font-bold px-3 py-1.5 rounded-full border border-[#DBDBDB]">
                Ended
              </span>
            )}
            {shift.status === 'cancelled' && (
              <span className="bg-red-50 text-red-500 text-[12px] font-bold px-3 py-1.5 rounded-full border border-red-200">
                Cancelled
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-black font-bold text-[26px]">${shift.payRate}</span>
            <span className="text-[#737373] text-[14px] font-medium">/{shift.payPeriod}</span>
          </div>
        </div>

        {/* Client */}
        <div className="flex items-center gap-4 px-5 py-4 border-b border-[#DBDBDB]">
          <ClientLogo name={shift.companyName} />
          <div className="flex-1 min-w-0">
            <p className="text-black font-bold text-[17px] leading-tight truncate">{shift.companyName}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <MapPin size={12} aria-hidden className="text-[#737373] flex-shrink-0" />
              <p className="text-[#737373] text-[13px] truncate">{shift.location} · {distanceMilesLabel} mi away</p>
            </div>
          </div>
        </div>

        {/* Schedule tiles */}
        <div className="flex gap-3 px-5 pt-4 pb-5" role="group" aria-label="Shift schedule">
          <StatTile icon={<Calendar size={14} aria-hidden className="text-[#737373]" />} label="Date" value={shift.date} />
          <StatTile icon={<Clock size={14} aria-hidden className="text-[#737373]" />} label="Time" value={shift.startTime} sub={`Ends ${shift.endTime}`} />
          <StatTile icon={<Timer size={14} aria-hidden className="text-[#0095F6]" />} label="Duration" value={duration} accent />
        </div>

        {/* Dress code */}
        <div className="px-5 pb-6">
          <div className="flex items-center justify-between mb-3">
            <SectionHeading>
              <span className="flex items-center gap-2 mb-0">
                <Shirt size={16} aria-hidden className="text-[#737373]" />
                Dress Code
              </span>
            </SectionHeading>
            {isOwner && dressCodeDraft === null && (
              <button type="button" aria-label="Edit dress code"
                onClick={() => setDressCodeDraft(shift.dressCode ?? '')}
                className="w-7 h-7 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center">
                <Pencil size={12} aria-hidden className="text-[#737373]" />
              </button>
            )}
          </div>
          {dressCodeDraft !== null ? (
            <div className="flex flex-col gap-2">
              <textarea value={dressCodeDraft} onChange={(e) => setDressCodeDraft(e.target.value)}
                rows={3} aria-label="Edit dress code"
                className="border border-[#DBDBDB] rounded-[12px] p-3 text-[14px] text-black resize-none outline-none focus:border-black" />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setDressCodeDraft(null)}
                  className="text-[#737373] text-[13px] font-medium px-3 h-8">Cancel</button>
                <button type="button" onClick={handleSaveDressCode} disabled={savingDressCode}
                  className="bg-black text-white text-[13px] font-semibold px-4 h-8 rounded-[8px] disabled:opacity-60">
                  {savingDressCode ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div className="border border-[#DBDBDB] rounded-[12px] p-4" role="list" aria-label="Dress code items">
              {shift.dressCodeItems.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {shift.dressCodeItems.map((item) => (
                    <div key={item} role="listitem" className="bg-[#FAFAFA] border border-[#DBDBDB] rounded-full px-3.5 py-1.5">
                      <span className="text-black text-[13px] font-medium">{item}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[#737373] text-[14px] leading-relaxed">{shift.dressCode || 'See shift details for dress code requirements.'}</p>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        {shift.description && (
          <div className="px-5 pb-6">
            <SectionHeading>About this Shift</SectionHeading>
            <p className="text-[#737373] text-[14px] leading-[1.7]">{shift.description}</p>
          </div>
        )}

        {/* Requirements */}
        {shift.requirements.length > 0 && (
          <div className="px-5 pb-6">
            <SectionHeading>Requirements</SectionHeading>
            <ul className="flex flex-col gap-2.5" aria-label="Shift requirements">
              {shift.requirements.map((req) => (
                <li key={req} className="flex items-center gap-3">
                  <CheckCircle2 size={15} aria-hidden className="text-emerald-500 flex-shrink-0" />
                  <span className="text-[#737373] text-[14px]">{req}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Point of contact */}
        {shift.pointOfContact && (
          <div className="px-5 pb-6">
            <SectionHeading>Point of Contact</SectionHeading>
            <div className="bg-[#FAFAFA] border border-[#DBDBDB] rounded-[12px] px-4 py-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-white border border-[#DBDBDB] flex items-center justify-center flex-shrink-0">
                <span className="text-black font-bold text-[14px]">
                  {shift.pointOfContact.split(' ').map((n) => n[0]).join('')}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-black font-semibold text-[14px]">{shift.pointOfContact}</p>
                <p className="text-[#737373] text-[12px] mt-0.5">{shift.contactPhone}</p>
              </div>
              {shift.contactPhone && (
                <a href={`tel:${shift.contactPhone}`} aria-label={`Call ${shift.pointOfContact}`}
                  className="w-9 h-9 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center flex-shrink-0">
                  <Phone size={15} aria-hidden className="text-black" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Map — Apple Maps style block: address bar, dark map, Hide Map, distance footer */}
        <div className="px-5 pb-6">
          <SectionHeading>Location</SectionHeading>
          <VenueMap
            address={shift.location}
            coords={shiftCoords}
            userCoords={myLocationIsDefault ? null : myCoords}
            markerId={shift.id}
            distanceMiles={myLocationIsDefault ? null : distanceFromShift}
            status={lifecycle === 'in_progress' ? 'Happening now' : lifecycle === 'ended' ? 'Ended' : shift.date}
            detail={shift.startTime}
            onOpenDirections={() => setDirectionsOpen(true)}
          />
          <button type="button" onClick={() => setDirectionsOpen(true)}
            className="mt-3 w-full h-[44px] rounded-[10px] bg-[#0A1628] text-white font-semibold text-[14px] flex items-center justify-center gap-2 active:scale-[0.99] transition-transform">
            <Navigation size={15} aria-hidden />
            Get Directions
          </button>
        </div>

        {/* Directions chooser */}
        <AnimatePresence>
          {directionsOpen && (() => {
            const links = directionsLinks(shiftCoords.lat, shiftCoords.lng, shift.location);
            const opts = [
              { label: 'Apple Maps',  href: links.apple  },
              { label: 'Google Maps', href: links.google },
              { label: 'Waze',        href: links.waze   },
            ];
            return (
              <>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onClick={() => setDirectionsOpen(false)}
                  className="fixed inset-0 bg-black/40 z-[60]" />
                <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 38 }}
                  className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-app z-[61] bg-white rounded-t-[20px] px-5 pt-4 pb-9 shadow-2xl">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-bold text-[16px] text-[#111827]">Get directions</p>
                    <button type="button" onClick={() => setDirectionsOpen(false)} aria-label="Close">
                      <X size={18} className="text-[#737373]" />
                    </button>
                  </div>
                  <p className="text-[#737373] text-[13px] mb-4 truncate">{shift.location}</p>
                  {opts.map((o) => (
                    <a key={o.label} href={o.href} target="_blank" rel="noreferrer"
                      onClick={() => setDirectionsOpen(false)}
                      className="flex items-center gap-3 h-[52px] px-4 rounded-[12px] border border-[#E5E7EB] mb-2.5 active:bg-[#FAFAFA]">
                      <Navigation size={16} className="text-[#0A1628] flex-shrink-0" />
                      <span className="font-semibold text-[15px] text-[#111827]">{o.label}</span>
                    </a>
                  ))}
                </motion.div>
              </>
            );
          })()}
        </AnimatePresence>

        {/* Your hours — the real timesheet once the worker has clocked out:
            what was recorded, what the poster approved, and (if they changed
            it) a chance to agree or dispute. Replaces the estimate below. */}
        {isWorker && myEntry?.clock_out && (() => {
          const e = myEntry;
          const tz = shift.timezone;
          const approved = !!e.approved;
          const changed = approved && e.hoursChanged;
          const hours = e.total_hours ?? 0;
          const pay = approved ? (e.approvedPay ?? e.total_pay ?? 0) : (e.total_pay ?? 0);
          const needsAnswer = changed && !e.workerAck;
          const statusLabel = !approved ? 'Pending approval'
            : e.workerAck === 'disputed' ? 'Disputed · under review'
            : changed ? (e.workerAck === 'accepted' ? 'Updated by the poster · accepted' : 'Updated by the poster')
            : 'Approved';
          const statusCls = !approved ? 'bg-[#FAFAFA] border-[#DBDBDB] text-[#737373]'
            : e.workerAck === 'disputed' ? 'bg-red-50 border-red-200 text-red-600'
            : needsAnswer ? 'bg-amber-50 border-amber-200 text-amber-700'
            : 'bg-emerald-50 border-emerald-200 text-emerald-700';
          return (
            <div className="px-5 pb-4">
              <div className="rounded-[12px] border border-[#DBDBDB] bg-white px-4 py-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="text-[#111827] font-bold text-[15px]">Your hours</p>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${statusCls}`}>{statusLabel}</span>
                </div>
                <div className="flex flex-col gap-2 text-[14px]">
                  <div className="flex justify-between"><span className="text-[#6B7280]">Clocked in</span><span className="text-[#111827] font-semibold">{formatTime(e.clock_in, tz)}</span></div>
                  <div className="flex justify-between"><span className="text-[#6B7280]">Clocked out</span><span className="text-[#111827] font-semibold">{formatTime(e.clock_out ?? e.clock_in, tz)}</span></div>
                  {(e.breakMinutes ?? 0) > 0 && (
                    <div className="flex justify-between"><span className="text-[#6B7280]">Unpaid break</span><span className="text-[#111827] font-semibold">{e.breakMinutes} min</span></div>
                  )}
                  <div className="border-t border-[#EFEFEF] my-0.5" />
                  <div className="flex justify-between">
                    <span className="text-[#6B7280]">Total hours</span>
                    <span className="text-[#111827] font-semibold">
                      {changed
                        ? <><span className="line-through text-[#9CA3AF] font-normal mr-1.5">{formatHoursMinutes(e.clocked_hours)}</span>{formatHoursMinutes(hours)}</>
                        : formatHoursMinutes(hours)}
                      {(e.overtime_hours ?? 0) > 0 && <span className="ml-1.5 text-[11px] text-amber-600 font-bold">{formatHoursMinutes(e.overtime_hours)} OT</span>}
                    </span>
                  </div>
                  <div className="flex justify-between text-[15px]">
                    <span className="text-[#111827] font-bold">{approved ? 'Approved pay' : 'Estimated pay'}</span>
                    <span className="text-[#111827] font-bold">{usd(Number(pay) || 0)}</span>
                  </div>
                </div>
                {!approved && (
                  <p className="text-[#9CA3AF] text-[11px] mt-3 leading-relaxed">
                    The poster reviews your timesheet before paying. You will be told if anything changes.
                  </p>
                )}
                {needsAnswer && (
                  <div className="mt-3.5 flex flex-col gap-2">
                    <p className="text-amber-700 text-[12px] leading-relaxed">
                      The poster changed your hours from {formatHoursMinutes(e.clocked_hours)} to {formatHoursMinutes(hours)}. Does that look right?
                    </p>
                    <div className="flex gap-2">
                      <button type="button" disabled={acking} onClick={() => void handleAck('accept')}
                        className="flex-1 h-10 rounded-[8px] bg-[#0A1628] text-white text-[13px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-60">
                        <CheckCircle2 size={14} aria-hidden /> Looks right
                      </button>
                      <button type="button" disabled={acking} onClick={() => setDisputeOpen(true)}
                        className="flex-1 h-10 rounded-[8px] border border-red-200 bg-red-50 text-red-600 text-[13px] font-bold disabled:opacity-60">
                        Dispute
                      </button>
                    </div>
                  </div>
                )}
                {e.workerAck === 'disputed' && e.dispute_note && (
                  <p className="text-[#6B7280] text-[12px] mt-3 leading-relaxed">Your note: “{e.dispute_note}”</p>
                )}
              </div>
            </div>
          );
        })()}

        {/* Rate the client — once the shift is over, one tap to the review flow */}
        {isWorker && applicationStatus === 'accepted' && lifecycle === 'ended' && shift.status !== 'cancelled' && (
          <div className="px-5 pb-4">
            {myReview ? (
              <div className="w-full h-[44px] rounded-[10px] bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center gap-1.5 text-[#6B7280] font-semibold text-[14px]"
                aria-label={`You rated this client ${myReview.rating} stars`}>
                You rated <Star size={14} aria-hidden className="text-[#FFD700] fill-[#FFD700]" />{myReview.rating}
              </div>
            ) : (
              <button type="button" onClick={() => navigate(`/review/${shiftId}/${shift.clientId}`)}
                className="w-full h-[44px] rounded-[10px] border border-[#0A1628] text-[#0A1628] font-bold text-[14px] flex items-center justify-center gap-2 active:scale-[0.99] transition-transform">
                <Star size={15} aria-hidden />
                Rate this client
              </button>
            )}
          </div>
        )}

        {/* What this shift pays in total — the number a worker actually decides on */}
        {isWorker && shift.payRate > 0 && !myEntry?.clock_out && (() => {
          const hrs = calcDurationHours(shift.startTime, shift.endTime);
          const total = shift.payPeriod === 'hr' ? shift.payRate * hrs : shift.payRate;
          if (!(total > 0)) return null;
          return (
            <div className="px-5 pb-4">
              <div className="rounded-[12px] border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-emerald-800 font-bold text-[15px]">≈ ${total.toFixed(0)} for this shift</p>
                  <p className="text-emerald-700 text-[12px] mt-0.5">
                    {shift.payPeriod === 'hr' ? `$${shift.payRate}/hr × ${duration}` : 'Flat rate for the whole shift'} · before any breaks
                  </p>
                </div>
                <DollarSign size={20} aria-hidden className="text-emerald-600 flex-shrink-0" />
              </div>
            </div>
          );
        })()}

        {/* Match — server-computed from real history (role, reliability, past
            shifts with this poster, distance) and, when configured, explained
            by Claude. The local formula only fills the gap while it loads. */}
        {isWorker && matchScore !== null && (() => {
          const score = myMatch.insight?.score ?? matchScore;
          const reason = myMatch.insight?.reason
            ?? (matchScore >= 80 ? 'Strong fit for this role and day.'
              : matchScore >= 60 ? 'Good fit — check the role and your availability.'
              : 'Partial fit — the role or day may not line up.');
          const tone = score >= 75 ? '#059669' : score >= 50 ? '#0095F6' : '#B45309';
          return (
            <div className="px-5 pb-6">
              <div className="bg-[#F0F7FF] border border-[#DBDBDB] rounded-[12px] px-5 py-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-white border flex items-center justify-center flex-shrink-0" style={{ borderColor: tone }}>
                  <span className="font-bold text-[15px]" style={{ color: tone }}>{score}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[#111827] font-bold text-[14px]">
                      {score >= 75 ? 'Strong match' : score >= 50 ? 'Good match' : 'Partial match'}
                    </span>
                    {myMatch.insight?.source === 'claude' && (
                      <span className="inline-flex items-center gap-1 bg-[#0095F6]/10 text-[#0095F6] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide border border-[#0095F6]/20">
                        <Sparkles size={10} aria-hidden /> AI
                      </span>
                    )}
                  </div>
                  <p className="text-[#737373] text-[13px] leading-snug">{reason}</p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Spots remaining */}
        <div className="px-5 pb-6">
          <div className="flex items-center justify-between mb-3">
            <SectionHeading>Spots Remaining</SectionHeading>
            <div className="flex items-center gap-1.5">
              <Users size={13} aria-hidden className={spotsLow ? 'text-red-500' : 'text-[#737373]'} />
              <span className={`text-[13px] font-semibold ${spotsLow ? 'text-red-500' : 'text-[#737373]'}`}>
                {shift.spotsAvailable} of {shift.spotsTotal} left{spotsLow && ' · Filling fast'}
              </span>
            </div>
          </div>
          <div className="h-2 bg-[#EFEFEF] rounded-full overflow-hidden"
            role="progressbar" aria-valuenow={fillPct} aria-valuemin={0} aria-valuemax={100}
            aria-label={`${fillPct}% of spots filled`}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${fillPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
              className={`h-full rounded-full ${spotsLow ? 'bg-red-500' : 'bg-black'}`} />
          </div>
          {spotsFilled > 0 && (
            <p className="text-[#737373] text-[12px] mt-3">
              {spotsFilled} worker{spotsFilled !== 1 ? 's' : ''} already booked
            </p>
          )}
        </div>

        {/* Cost breakdown — owner-only, shows gross / 8% fee / total estimate */}
        {canManage && shift.payRate > 0 && (
          <div className="px-5 pb-6">
            <SectionHeading>Cost Estimate</SectionHeading>
            {(() => {
              const durHrs  = calcDurationHours(shift.startTime, shift.endTime);
              const gross   = shift.payRate * shift.spotsTotal * durHrs;
              const total   = gross;
              const fmtUsd  = (n: number) =>
                n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
              return (
                <div className="bg-[#FAFAFA] border border-[#DBDBDB] rounded-[12px] px-4 py-4">
                  <div className="flex justify-between items-center py-2 border-b border-[#EFEFEF]">
                    <p className="text-[#737373] text-[13px]">
                      {shift.spotsTotal} worker{shift.spotsTotal !== 1 ? 's' : ''} × {durHrs.toFixed(1)}h × ${shift.payRate}/hr
                    </p>
                    <p className="text-black font-semibold text-[14px]">{fmtUsd(gross)}</p>
                  </div>
                  <div className="flex justify-between items-center pt-2.5">
                    <p className="text-black font-bold text-[14px]">Total Estimate</p>
                    <p className="text-black font-bold text-[18px]">{fmtUsd(total)}</p>
                  </div>
                  <p className="text-[#AAAAAA] text-[11px] mt-3 leading-relaxed">
                    Estimated total based on listed hours and all spots filled. Final cost depends on actual clock-out times.
                  </p>
                </div>
              );
            })()}
          </div>
        )}

        {/* Roster summary — all worker management lives on the Roster screen */}
        {canManage && acceptedWorkers.length > 0 && (
          <div className="px-5 pb-6">
            <button type="button" onClick={() => navigate(`/shift/${shiftId}/applicants`)}
              aria-label="Open the roster"
              className="w-full flex items-center justify-between bg-[#FAFAFA] border border-[#DBDBDB] rounded-[12px] px-4 py-3.5 text-left">
              <div className="min-w-0">
                <p className="text-black font-semibold text-[14px]">
                  {acceptedWorkers.length} confirmed worker{acceptedWorkers.length === 1 ? '' : 's'}
                </p>
                <p className="text-[#737373] text-[12px]">
                  {acceptedWorkers.filter((w) => w.attendance === 'on_site').length} on-site ·{' '}
                  {acceptedWorkers.filter((w) => w.attendance === 'done').length} done
                </p>
              </div>
              <span className="text-[#0A1628] font-bold text-[13px] flex-shrink-0">Manage Roster →</span>
            </button>
          </div>
        )}
        {/* Event positions — other roles in this multi-position event */}
        {eventPositions.length > 1 && (
          <div className="px-5 pt-2 pb-4">
            <p className="text-[13px] font-semibold text-[#737373] uppercase tracking-widest mb-2">
              Event positions ({eventPositions.length})
            </p>
            <div className="flex flex-col gap-2">
              {eventPositions.map((p) => {
                const isThis = p.id === shiftId;
                const left = Math.max(0, (p.spots_available ?? 1) - (p.spots_filled ?? 0));
                return (
                  <button key={p.id} type="button" disabled={isThis}
                    onClick={() => navigate(`/shift/${p.id}`)}
                    className={`w-full flex items-center justify-between rounded-[10px] border px-3.5 py-2.5 text-left ${
                      isThis ? 'border-[#0A1628] bg-[#0A1628]/5' : 'border-[#E5E7EB] bg-white'
                    }`}>
                    <div className="min-w-0">
                      <p className="text-[#111827] font-semibold text-[14px] truncate">
                        {p.job_type ?? 'Position'}{isThis && ' · this one'}
                      </p>
                      <p className="text-[#6B7280] text-[12px]">
                        ${p.pay_rate}/{p.pay_period ?? 'hr'} · {left === 0 ? 'Full' : `${left} spot${left === 1 ? '' : 's'} left`}
                      </p>
                    </div>
                    {!isThis && <span className="text-[#9CA3AF] text-[16px] flex-shrink-0">→</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Shift chat + Updates — owner and booked workers */}
        {(canManage || applicationStatus === 'accepted') && (
          <div className="px-5 pt-2">
            <button type="button" onClick={() => void handleShiftChat()} disabled={openingChat}
              className="w-full h-[46px] rounded-[8px] bg-[#0A1628] text-white font-bold text-[14px] flex items-center justify-center gap-2 disabled:opacity-60">
              <MessagesSquare size={16} aria-hidden />
              {openingChat ? 'Opening…' : 'Shift chat'}
            </button>
          </div>
        )}
        {(canManage || applicationStatus === 'accepted' || applicationStatus === 'standby') && (
          <div className="px-5 pt-2">
            <button type="button" onClick={() => navigate(`/shift/${shiftId}/updates`)}
              className="w-full h-[46px] rounded-[8px] border border-[#E5E7EB] text-[#0A1628] font-bold text-[14px] flex items-center justify-center gap-2">
              <MessageSquareText size={16} aria-hidden />
              Updates &amp; Announcements
            </button>
          </div>
        )}

        {/* Owner management — inline, scrolls with content (never overlaps) */}
        {canManage && (
          <div className="px-5 pt-2 pb-8 flex flex-col gap-2 border-t border-[#DBDBDB] mt-2">
            {profile.role === 'staffer' && lifecycle !== 'ended' && shift.status !== 'cancelled' && (
              <motion.button type="button" whileTap={{ scale: 0.97 }}
                onClick={() => navigate(`/shift/${shiftId}/assign`)}
                aria-label="Assign workers from your roster"
                className="w-full h-[46px] rounded-[8px] border border-[#0A1628] text-[#0A1628] font-bold text-[14px] tracking-wide flex items-center justify-center gap-2">
                <UserPlus size={16} aria-hidden />
                Assign Workers
              </motion.button>
            )}
            {(shift.status === 'open' || shift.status === 'filled') && lifecycle !== 'ended' && (
              <motion.button type="button" whileTap={{ scale: 0.97 }}
                onClick={() => setConfirmBroadcast(true)} disabled={inviting}
                aria-label="Request all workers for this shift"
                className="w-full h-[46px] rounded-[8px] bg-[#0095F6] text-white font-bold text-[14px] tracking-wide flex items-center justify-center gap-2 disabled:opacity-60">
                <Send size={16} aria-hidden />
                {inviting ? 'Sending invites…' : 'Request All Workers'}
              </motion.button>
            )}
            <motion.button type="button" whileTap={{ scale: 0.97 }}
              onClick={() => navigate(`/shift/${shiftId}/applicants`)}
              aria-label={`View applicants${pendingApplicants.length > 0 ? `, ${pendingApplicants.length} pending` : ''}`}
              className="w-full h-[52px] rounded-[8px] bg-[#0A1628] text-white font-bold text-[16px] tracking-wide flex items-center justify-center gap-2.5">
              <Users size={18} aria-hidden />
              Manage Roster
              {pendingApplicants.length > 0 && (
                <span className="bg-white/20 text-white text-[12px] font-bold px-2 py-0.5 rounded-full">
                  {pendingApplicants.length}
                </span>
              )}
            </motion.button>
            {(shift.status === 'open' || shift.status === 'filled') && lifecycle !== 'ended' && (
              <div className="flex gap-2">
                <motion.button type="button" whileTap={{ scale: 0.97 }}
                  onClick={() => void handleEditShift()}
                  disabled={editLoading}
                  aria-label="Edit this shift"
                  className="flex-1 h-[44px] rounded-[8px] border border-[#0A1628] text-[#0A1628] font-bold text-[14px] flex items-center justify-center gap-2 disabled:opacity-60">
                  {editLoading
                    ? <span className="text-[13px]">Loading…</span>
                    : <><Edit3 size={15} aria-hidden />Edit</>
                  }
                </motion.button>
                <motion.button type="button" whileTap={{ scale: 0.97 }}
                  onClick={() => setShowCancelConfirm(true)}
                  aria-label="Cancel this shift"
                  className="flex-1 h-[44px] rounded-[8px] border border-[#EF4444] text-[#EF4444] font-bold text-[14px] flex items-center justify-center gap-2">
                  <Trash2 size={15} aria-hidden />
                  Cancel
                </motion.button>
              </div>
            )}
            {/* Over or cancelled: the fastest way to rebook is a copy with a new date */}
            {(lifecycle === 'ended' || shift.status === 'cancelled' || shift.status === 'completed') && (
              <motion.button type="button" whileTap={{ scale: 0.97 }}
                onClick={() => void handleEditShift('clone')}
                disabled={editLoading}
                aria-label="Post this shift again with a new date"
                className="w-full h-[46px] rounded-[8px] border border-[#0A1628] text-[#0A1628] font-bold text-[14px] flex items-center justify-center gap-2 disabled:opacity-60">
                <Repeat2 size={16} aria-hidden />
                {editLoading ? 'Loading…' : 'Post again'}
              </motion.button>
            )}
          </div>
        )}
      </div>

      {/* Fixed CTA — worker actions only (apply/claim/clock-in). Clients and
          staffers never apply or clock in; owners manage via the inline block. */}
      {profile.role === 'worker' && !isOwner && (
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-app px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+14px)] bg-white z-30 border-t border-[#EFEFEF] shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
        <AnimatePresence>
          {ctaState === 'pending' && (
            <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="text-center text-[#737373] text-[12px] mb-2">
              Application submitted · Awaiting client review
            </motion.p>
          )}
        </AnimatePresence>

        {ctaState === 'apply' && !isOwner && (
          <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={handleCta}
            aria-label={`Apply to ${shift.companyName}`}
            className="w-full h-[52px] rounded-[8px] bg-[#0A1628] text-white font-bold text-[16px] tracking-wide">
            Apply Now
          </motion.button>
        )}

        {ctaState === 'claim' && !isOwner && (
          <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={handleCta}
            disabled={claiming}
            aria-label={`Claim this shift at ${shift.companyName} — instant confirmation`}
            className="w-full h-[52px] rounded-[8px] bg-emerald-600 text-white font-bold text-[16px] tracking-wide flex items-center justify-center gap-2 disabled:opacity-70">
            {claiming
              ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Zap size={18} aria-hidden className="fill-white" />}
            {claiming ? 'Claiming…' : 'Claim This Shift'}
          </motion.button>
        )}

        {ctaState === 'pending' && (
          <div className="flex flex-col items-center gap-1.5">
            {/* Disabled gray "Applied" button — spec requirement */}
            <button
              type="button" disabled aria-disabled="true" aria-label="Application already submitted"
              className="w-full h-[52px] rounded-[8px] bg-[#F0F0F0] border border-[#DBDBDB] flex items-center justify-center gap-2 cursor-not-allowed"
            >
              <CheckCircle2 size={18} aria-hidden className="text-emerald-500" />
              <span className="text-[#737373] font-semibold text-[15px]">Applied · awaiting approval</span>
            </button>
            <button type="button" onClick={() => setConfirmDrop(true)} disabled={dropping}
              className="w-full h-9 text-[#6B7280] font-semibold text-[13px] disabled:opacity-50">
              {dropping ? 'Withdrawing…' : 'Withdraw application'}
            </button>
          </div>
        )}

        {ctaState === 'declined' && (
          <div className="w-full h-[52px] rounded-[8px] bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center gap-2.5">
            <span className="text-[#737373] font-semibold text-[15px]">Not Selected for This Shift</span>
          </div>
        )}

        {ctaState === 'withdrawn' && (
          <div className="w-full h-[52px] rounded-[8px] bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center gap-2.5">
            <span className="text-[#737373] font-semibold text-[15px]">You dropped this shift · now full</span>
          </div>
        )}

        {ctaState === 'cancelled' && (
          <div className="w-full h-[52px] rounded-[8px] bg-red-50 border border-red-200 flex items-center justify-center gap-2.5">
            <span className="text-red-500 font-semibold text-[15px]">This shift was cancelled</span>
          </div>
        )}

        {ctaState === 'past' && (
          <div className="w-full h-[52px] rounded-[8px] bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center gap-2.5">
            <span className="text-[#737373] font-semibold text-[15px]">This shift has ended</span>
          </div>
        )}

        {ctaState === 'full' && (
          <div className="w-full h-[52px] rounded-[8px] bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center gap-2.5">
            <span className="text-[#737373] font-semibold text-[15px]">This shift is full</span>
          </div>
        )}

        {showArrivalPills && applicationId && (
          <ArrivalPills applicationId={applicationId} status={arrivalStatus} statusAt={arrivalStatusAt}
            className="mb-2.5 justify-center" />
        )}

        {ctaState === 'clock-in' && (
          <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={handleCta}
            disabled={!canClockIn}
            aria-label={canClockIn ? 'Clock in to your shift'
              : !clockOpen ? `Clock in opens at ${clockOpensLabel}` : 'Clock in unavailable — you must be within 1 mile'}
            className={`w-full h-[52px] rounded-[8px] font-bold text-[16px] tracking-wide flex items-center justify-center gap-2.5 ${
              canClockIn ? 'bg-[#FFD700] text-black' : 'bg-[#F0F0F0] text-[#AAAAAA] cursor-not-allowed'
            }`}>
            <motion.div animate={canClockIn ? { scale: [1, 1.2, 1] } : {}} transition={{ repeat: Infinity, duration: 1.6 }}>
              <AlarmClock size={20} aria-hidden />
            </motion.div>
            {!clockOpen ? `Clock in opens at ${clockOpensLabel}`
              : withinClockInRange ? 'Clock In' : 'Get within 1 mi to Clock In'}
          </motion.button>
        )}

        {/* Before the start a booked worker calls out (spot released + standby
            auto-filled); once it's underway they talk to the poster instead. */}
        {ctaState === 'clock-in' && lifecycle === 'upcoming' && applicationId && (
          <button type="button" onClick={() => setConfirmCallOut(true)} disabled={callingOut}
            className="w-full h-9 mt-2 text-[#6B7280] font-semibold text-[13px] disabled:opacity-50">
            {callingOut ? 'Releasing your spot…' : "Can't make it?"}
          </button>
        )}
        {ctaState === 'clock-in' && lifecycle === 'in_progress' && (
          <p className="text-center text-[#9CA3AF] text-[12px] mt-2">
            Running into a problem? Message the poster in the shift chat.
          </p>
        )}

        {ctaState === 'standby' && (
          <div className="flex flex-col gap-2">
            <div className="w-full rounded-[8px] bg-amber-50 border border-amber-200 px-4 py-3 text-center">
              <p className="text-amber-700 font-bold text-[14px]">You're on standby</p>
              <p className="text-amber-600 text-[12px] mt-0.5">This shift is full — we'll notify you if a spot opens.</p>
            </div>
            <button type="button" onClick={() => setConfirmDrop(true)} disabled={dropping}
              className="w-full h-9 text-[#EF4444] font-semibold text-[13px] disabled:opacity-50">
              {dropping ? 'Leaving…' : 'Leave waitlist'}
            </button>
          </div>
        )}

        {ctaState === 'completed' && (
          <div className="w-full h-[52px] rounded-[8px] bg-[#FAFAFA] border border-emerald-200 flex items-center justify-center gap-2.5">
            <CheckCircle2 size={18} aria-hidden className="text-emerald-500" />
            <span className="text-emerald-600 font-bold text-[15px]">Completed</span>
          </div>
        )}
      </div>
      )}

      {/* Call-out sheet — booked worker, before the shift starts */}
      <CallOutSheet
        open={confirmCallOut}
        shiftLabel={`${shift.date} · ${shift.startTime}`}
        busy={callingOut}
        onConfirm={(reason) => void handleCallOut(reason)}
        onCancel={() => setConfirmCallOut(false)}
      />

      {/* Withdraw / leave-waitlist confirmation sheet (pending + standby) */}
      {confirmDrop && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40"
          role="dialog" aria-modal="true" aria-label="Confirm dropping this shift"
          onClick={() => { if (!dropping) setConfirmDrop(false); }}>
          <div className="w-full max-w-app bg-white rounded-t-[20px] px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
            onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full bg-[#E5E7EB] mx-auto mb-4" />
            <p className="text-[#111827] font-bold text-[17px]">
              {applicationStatus === 'standby' ? 'Leave the waitlist?'
                : applicationStatus === 'pending' ? 'Withdraw your application?'
                : 'Drop this shift?'}
            </p>
            <p className="text-[#6B7280] text-[13px] mt-1 leading-relaxed">
              {applicationStatus === 'standby'
                ? "You'll stop being considered if a spot opens up. You can apply again later."
                : applicationStatus === 'pending'
                ? "The client won't see your application anymore. You can apply again while the shift is open."
                : 'Your spot will reopen for someone else. Dropping close to the start time can affect your reliability.'}
            </p>
            <div className="flex flex-col gap-2 mt-5">
              <button type="button" onClick={() => void handleDrop()} disabled={dropping}
                className="w-full h-[50px] rounded-[10px] bg-[#EF4444] text-white font-bold text-[15px] disabled:opacity-60">
                {dropping ? 'Working…'
                  : applicationStatus === 'standby' ? 'Leave waitlist'
                  : applicationStatus === 'pending' ? 'Withdraw application'
                  : 'Yes, drop shift'}
              </button>
              <button type="button" onClick={() => setConfirmDrop(false)} disabled={dropping}
                className="w-full h-[50px] rounded-[10px] bg-white border border-[#DBDBDB] text-[#111827] font-semibold text-[15px] disabled:opacity-60">
                Keep my spot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
