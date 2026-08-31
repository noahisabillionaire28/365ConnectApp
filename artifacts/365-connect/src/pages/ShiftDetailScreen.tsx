import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Heart, Sparkles, Calendar, Clock, Timer,
  MapPin, Phone, Users, Shirt, CheckCircle2, AlarmClock, Pencil, Star, UserPlus,
  Edit3, Trash2, DollarSign, Navigation, X, Zap,
} from 'lucide-react';
import { useFeedStore, toggleSaved } from '@/store/feedStore';
import { useApplications } from '@/hooks/useApplications';
import { useToast } from '@/contexts/ToastContext';
import { useApplicationStatus } from '@/hooks/useApplicationStatus';
import { LeafletMap } from '@/components/LeafletMap';
import { geocodeAddress, type Coords } from '@/lib/geocode';
import { useShiftById } from '@/hooks/useShifts';
import { useProfile } from '@/hooks/useProfile';
import { useMyLocation } from '@/hooks/useMyLocation';
import { computeMatchScore } from '@/lib/matchScore';
import { haversineMiles } from '@/lib/supabase';
import { apiClient } from '@/lib/api';
import { resetDraft, setDraft, setEditShiftId } from '@/store/postShiftStore';
import { useAuth } from '@/contexts/AuthContext';
import { hasCompletedTimeEntry } from '@/hooks/useTimeEntry';
import { useShiftApplicants } from '@/hooks/useShiftApplicants';
import { useAcceptedWorkers } from '@/hooks/useAcceptedWorkers';
import { startShiftPayment } from '@/lib/checkout';

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
const ATT_META: Record<'applied' | 'booked' | 'on_site' | 'done' | 'no_show', { label: string; cls: string }> = {
  applied: { label: 'Applied', cls: 'bg-slate-50    border-[#DBDBDB]    text-[#737373]'  },
  booked:  { label: 'Booked',  cls: 'bg-blue-50     border-blue-200     text-blue-700'   },
  on_site: { label: 'On-site', cls: 'bg-emerald-50  border-emerald-200  text-emerald-700' },
  done:    { label: 'Done',    cls: 'bg-[#0A1628]/5 border-[#0A1628]/20 text-[#0A1628]'  },
  no_show: { label: 'No-show', cls: 'bg-red-50      border-red-200      text-red-600'    },
};

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
  const { status: applicationStatus }     = useApplicationStatus(id);
  const profile                           = useProfile();
  const { coords: myCoords }              = useMyLocation();
  // Distance (and therefore the AI Match Score's distance component) is
  // computed against the real viewer location, not a hardcoded fallback.
  const { data: shift, isLoading, error } = useShiftById(id, myCoords);
  const [dressCodeDraft, setDressCodeDraft] = useState<string | null>(null);
  const [savingDressCode, setSavingDressCode] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  const isOwnerForHooks = !!user?.id && !!shift && user.id === shift.clientId;
  const { applicants: pendingApplicants } = useShiftApplicants(isOwnerForHooks ? id : undefined);
  const { workers: acceptedWorkers } = useAcceptedWorkers(
    isOwnerForHooks ? id : undefined,
    isOwnerForHooks ? user?.id : undefined,
  );
  const { showToast } = useToast();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  // Coordinates resolved from the shift's ADDRESS TEXT — used so the map, pin,
  // distance, and directions match the address even when the stored lat/lng are
  // wrong (older shifts saved with the poster's own location).
  const [venueCoords, setVenueCoords] = useState<Coords | null>(null);
  // ── No more hooks below this line ────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    if (!shift || !user?.id) return;
    void hasCompletedTimeEntry(shift.id, user.id).then((done) => { if (!cancelled) setHasCompleted(done); });
    return () => { cancelled = true; };
  }, [shift?.id, user?.id]);

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
  const saved       = store.isSaved(shiftId);
  const spotsLow    = shift.spotsAvailable < 3;
  const duration    = calcDuration(shift.startTime, shift.endTime);
  const spotsFilled = shift.spotsTotal - shift.spotsAvailable;
  const fillPct     = Math.round((spotsFilled / Math.max(shift.spotsTotal, 1)) * 100);
  const isOwner     = !!user?.id && user.id === shift.clientId;
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

  // Real CTA states, per applications.status + time_entries completion:
  //   no row → apply | pending → Pending Approval | declined → Not Selected
  //   accepted+not clocked out → Clock In (gold, 1mi gate) | accepted+clocked out → Completed
  // Completion is tracked per-worker via time_entries.clock_out rather than
  // shifts.status, since RLS only lets the shift's client owner update shifts.
  const canClaim = shift.instantClaim && shift.spotsAvailable > 0;
  type CtaState = 'apply' | 'claim' | 'pending' | 'declined' | 'clock-in' | 'completed';
  const ctaState: CtaState =
    applicationStatus === 'accepted'
      ? (hasCompleted ? 'completed' : 'clock-in')
      : applicationStatus === 'pending'
      ? 'pending'
      : applicationStatus === 'declined'
      ? 'declined'
      : canClaim
      ? 'claim'
      : 'apply';

  async function handleClaim() {
    if (!user?.id || claiming) return;
    setClaiming(true);
    try {
      await apiClient(user.id).post('/applications/claim', { shift_id: shiftId });
      showToast("You're booked! Shift claimed.");
      navigate('/home');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not claim — it may already be full.');
    } finally {
      setClaiming(false);
    }
  }

  function handleCta() {
    if (ctaState === 'apply') {
      void submitApplication(shiftId, matchScore ?? undefined, () => {
        showToast('Applied! The client will review your application.');
      });
    }
    if (ctaState === 'claim') void handleClaim();
    if (ctaState === 'clock-in' && withinClockInRange) navigate(`/clock/${shiftId}`);
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

  async function handleEditShift() {
    if (!user?.id || editLoading) return;
    setEditLoading(true);
    try {
      const raw = await apiClient(user.id).get<Record<string, unknown>>(`/shifts/${shiftId}`);
      if (!raw || raw.client_id !== user.id) return;
      const startISO   = raw.start_time as string;
      const endISO     = raw.end_time   as string;
      const date       = startISO.split('T')[0] ?? '';
      const start_time = startISO.split('T')[1]?.slice(0, 5) ?? '18:00';
      const end_time   = endISO.split('T')[1]?.slice(0, 5)   ?? '23:00';
      resetDraft();
      setDraft({
        job_type:        (raw.job_type        as string)           ?? '',
        title:           (raw.title           as string)           ?? '',
        location:        (raw.location        as string | null)    ?? '',
        lat:             (raw.lat             as number | null)    ?? 25.7825,
        lng:             (raw.lng             as number | null)    ?? -80.1298,
        unit_info:       (raw.unit_info       as string | null)    ?? '',
        date,
        start_time,
        end_time,
        spots_available: (raw.spots_available as number)           ?? 1,
        pay_rate:        (raw.pay_rate        as number | null)    ?? 0,
        description:     (raw.description     as string | null)    ?? '',
        requirements:    (raw.requirements    as string[] | null)  ?? [],
      });
      setEditShiftId(shiftId);
      navigate('/post-shift/event');
    } catch (e) {
      console.error('[ShiftDetail] edit prefill failed:', e);
    } finally {
      setEditLoading(false);
    }
  }

  async function handlePayWorker(workerId: string, actualPay?: number | null) {
    if (!user?.id || payingId || !shift) return;
    // Prefer the worker's ACTUAL clocked pay; fall back to the scheduled estimate
    // only if a clocked total isn't available yet.
    const amount = actualPay != null && actualPay > 0
      ? Math.round(actualPay * 100) / 100
      : Math.round(shift.payRate * calcDurationHours(shift.startTime, shift.endTime) * 100) / 100;
    if (amount <= 0) { showToast('No hours to pay yet.'); return; }
    setPayingId(workerId);
    try {
      // Redirects to Stripe Checkout; returns to /earnings on success.
      await startShiftPayment(user.id, { shift_id: shiftId, worker_id: workerId, amount });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not start payment.');
      setPayingId(null);
    }
  }

  async function handleCancelShift() {
    if (!user?.id || cancelling) return;
    setCancelling(true);
    try {
      await apiClient(user.id).patch(`/shifts/${shiftId}`, { status: 'cancelled' });
      setShowCancelConfirm(false);
      showToast('Shift cancelled.');
      navigate('/home');
    } catch (e) {
      console.error('[ShiftDetail] cancel failed:', e);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <>
    {/* Cancel confirm overlay */}
    {showCancelConfirm && (
      <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm px-4 pb-8"
        role="dialog" aria-modal="true" aria-label="Confirm shift cancellation">
        <div className="w-full max-w-[390px] bg-white rounded-[20px] p-5 shadow-xl">
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

      <div className="flex-1 overflow-y-auto pb-[104px]">

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

        {/* Map */}
        <div className="px-5 pb-6">
          <SectionHeading>Location</SectionHeading>
          <button type="button" onClick={() => setDirectionsOpen(true)}
            aria-label="Get directions to this shift" className="block w-full text-left">
            <div className="rounded-[12px] overflow-hidden border border-[#DBDBDB] relative" style={{ height: 180 }}>
              <LeafletMap
                center={shiftCoords}
                zoom={15}
                interactive={false}
                recenter
                ariaLabel="Shift location map"
                markers={[{ id: shift.id, lat: shiftCoords.lat, lng: shiftCoords.lng, selected: true }]}
              />
              {/* Transparent tap layer so a tap anywhere on the map opens directions */}
              <div aria-hidden className="absolute inset-0" />
            </div>
            <div className="flex items-center gap-2 mt-2.5">
              <MapPin size={13} aria-hidden className="text-[#737373] flex-shrink-0" />
              <p className="text-[#737373] text-[13px]">{shift.location} · {distanceMilesLabel} mi from your location</p>
            </div>
          </button>
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
                  className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] z-[61] bg-white rounded-t-[20px] px-5 pt-4 pb-9 shadow-2xl">
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

        {/* AI match score — worker-only, computed 40 job-type + 30 availability + 20 rating + 10 distance */}
        {isWorker && matchScore !== null && (
          <div className="px-5 pb-6">
            <div className="bg-[#F0F7FF] border border-[#DBDBDB] rounded-[12px] px-5 py-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#0095F6]/10 border border-[#0095F6]/20 flex items-center justify-center flex-shrink-0">
                <Sparkles size={20} aria-hidden className="text-[#0095F6]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[#0095F6] font-bold text-[22px]">{matchScore}%</span>
                  <span className="bg-[#0095F6]/10 text-[#0095F6] text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide border border-[#0095F6]/20">
                    AI Match
                  </span>
                </div>
                <p className="text-[#737373] text-[13px] leading-snug">
                  {matchScore >= 90
                    ? 'Your skills align perfectly with this shift'
                    : matchScore >= 80
                    ? 'Strong match — you meet most requirements'
                    : matchScore >= 60
                    ? 'Good match — a few areas to strengthen'
                    : 'Partial match — check job type and availability'}
                </p>
              </div>
            </div>
          </div>
        )}

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
        {isOwner && shift.payRate > 0 && (
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

        {/* Accepted workers — owner-only, rate once each worker has clocked out */}
        {isOwner && acceptedWorkers.length > 0 && (
          <div className="px-5 pb-6">
            <SectionHeading>Accepted Workers</SectionHeading>
            <div className="flex flex-col gap-2.5">
              {acceptedWorkers.map((w) => (
                <div key={w.workerId} className="flex items-center gap-3 bg-[#FAFAFA] border border-[#DBDBDB] rounded-[12px] px-4 py-3">
                  <div className="w-10 h-10 rounded-full bg-white border border-[#DBDBDB] flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {w.photoUrl
                      ? <img src={w.photoUrl} alt={w.username ?? 'Worker'} className="w-full h-full object-cover" />
                      : <span className="text-black font-bold text-[13px]">{(w.username ?? 'W').slice(0, 2).toUpperCase()}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-black font-semibold text-[14px] truncate">{w.username ? `@${w.username}` : 'Worker'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${ATT_META[w.attendance].cls}`}>
                        {ATT_META[w.attendance].label}
                      </span>
                      {w.completed && w.totalHours != null && (
                        <span className="text-[#737373] text-[11px]">
                          {w.totalHours}h · {usd(w.totalPay ?? 0)}
                        </span>
                      )}
                    </div>
                  </div>
                  {w.completed && (
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      {w.paid ? (
                        <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[12px] font-semibold px-3.5 py-2 rounded-[8px] flex items-center gap-1.5">
                          <CheckCircle2 size={13} aria-hidden />
                          Paid
                        </span>
                      ) : (
                        <motion.button type="button" whileTap={{ scale: 0.95 }}
                          disabled={payingId === w.workerId}
                          onClick={() => void handlePayWorker(w.workerId, w.totalPay)}
                          aria-label={`Pay ${w.username ?? 'this worker'}`}
                          className="bg-emerald-600 text-white text-[12px] font-semibold px-3.5 py-2 rounded-[8px] flex items-center gap-1.5 disabled:opacity-60">
                          <DollarSign size={13} aria-hidden />
                          {payingId === w.workerId ? 'Opening…' : 'Pay'}
                        </motion.button>
                      )}
                      {!w.alreadyReviewed ? (
                        <motion.button type="button" whileTap={{ scale: 0.95 }}
                          onClick={() => navigate(`/review/${shiftId}/${w.workerId}`)}
                          aria-label={`Rate ${w.username ?? 'this worker'}`}
                          className="bg-[#0A1628] text-white text-[12px] font-semibold px-3.5 py-2 rounded-[8px] flex items-center gap-1.5">
                          <Star size={13} aria-hidden className="fill-white" />
                          Rate
                        </motion.button>
                      ) : (
                        <span className="text-emerald-600 text-[12px] font-semibold flex items-center gap-1">
                          <CheckCircle2 size={13} aria-hidden />
                          Rated
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fixed CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] px-5 pb-9 pt-4 bg-gradient-to-t from-white via-white/98 to-transparent z-30 border-t border-[#DBDBDB]">
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
              <span className="text-[#737373] font-semibold text-[15px]">Applied</span>
            </button>
          </div>
        )}

        {ctaState === 'declined' && (
          <div className="w-full h-[52px] rounded-[8px] bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center gap-2.5">
            <span className="text-[#737373] font-semibold text-[15px]">Not Selected for This Shift</span>
          </div>
        )}

        {ctaState === 'clock-in' && (
          <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={handleCta}
            disabled={!withinClockInRange}
            aria-label={withinClockInRange ? 'Clock in to your shift' : 'Clock in unavailable — you must be within 1 mile'}
            className={`w-full h-[52px] rounded-[8px] font-bold text-[16px] tracking-wide flex items-center justify-center gap-2.5 ${
              withinClockInRange ? 'bg-[#FFD700] text-black' : 'bg-[#F0F0F0] text-[#AAAAAA] cursor-not-allowed'
            }`}>
            <motion.div animate={withinClockInRange ? { scale: [1, 1.2, 1] } : {}} transition={{ repeat: Infinity, duration: 1.6 }}>
              <AlarmClock size={20} aria-hidden />
            </motion.div>
            {withinClockInRange ? 'Clock In' : 'Get within 1 mi to Clock In'}
          </motion.button>
        )}

        {ctaState === 'completed' && (
          <div className="w-full h-[52px] rounded-[8px] bg-[#FAFAFA] border border-emerald-200 flex items-center justify-center gap-2.5">
            <CheckCircle2 size={18} aria-hidden className="text-emerald-500" />
            <span className="text-emerald-600 font-bold text-[15px]">Completed</span>
          </div>
        )}

        {isOwner && profile.role === 'staffer' && (
          <motion.button type="button" whileTap={{ scale: 0.97 }}
            onClick={() => navigate(`/shift/${shiftId}/assign`)}
            aria-label="Assign workers from your roster"
            className="w-full h-[46px] mb-2 rounded-[8px] border border-[#0A1628] text-[#0A1628] font-bold text-[14px] tracking-wide flex items-center justify-center gap-2">
            <UserPlus size={16} aria-hidden />
            Assign Workers
          </motion.button>
        )}

        {isOwner && (
          <motion.button type="button" whileTap={{ scale: 0.97 }}
            onClick={() => navigate(`/shift/${shiftId}/applicants`)}
            aria-label={`View applicants${pendingApplicants.length > 0 ? `, ${pendingApplicants.length} pending` : ''}`}
            className="w-full h-[52px] rounded-[8px] bg-[#0A1628] text-white font-bold text-[16px] tracking-wide flex items-center justify-center gap-2.5">
            <Users size={18} aria-hidden />
            View Applicants
            {pendingApplicants.length > 0 && (
              <span className="bg-white/20 text-white text-[12px] font-bold px-2 py-0.5 rounded-full">
                {pendingApplicants.length}
              </span>
            )}
          </motion.button>
        )}

        {isOwner && (shift.status === 'open' || shift.status === 'filled') && (
          <div className="flex gap-2 mt-2">
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
      </div>
    </div>
    </>
  );
}
