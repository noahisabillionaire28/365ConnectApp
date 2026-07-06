import { Map, Marker } from '@vis.gl/react-google-maps';
import { useParams, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Heart, Sparkles, Calendar, Clock, Timer,
  MapPin, Phone, Users, Shirt, CheckCircle2, AlarmClock,
} from 'lucide-react';
import { useFeedStore, toggleSaved, markAccepted } from '@/store/feedStore';
import { useApplications } from '@/hooks/useApplications';
import { DARK_MAP_STYLES, goldPinUrl } from '@/lib/mapStyles';
import { useShiftById } from '@/hooks/useShifts';

function calcDuration(start: string, end: string): string {
  const parse = (t: string) => {
    const [time, mer] = t.split(' ');
    let [h, m] = time.split(':').map(Number);
    if (mer === 'PM' && h !== 12) h += 12;
    if (mer === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  };
  let s = parse(start), e = parse(end);
  if (e <= s) e += 24 * 60;
  const diff = e - s;
  const hrs  = Math.floor(diff / 60);
  const mins = diff % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

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
  const { id }     = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const store      = useFeedStore();
  const { appliedShiftIds, submitApplication } = useApplications();
  const { data: shift, isLoading, error } = useShiftById(id);

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
  // applied comes from the live DB query + optimistic update in useApplications
  const applied     = appliedShiftIds.has(shiftId);
  const accepted    = store.isAccepted(shiftId);
  const clockedIn   = store.isClockedIn(shiftId);
  const spotsLow    = shift.spotsAvailable < 3;
  const duration    = calcDuration(shift.startTime, shift.endTime);
  const spotsFilled = shift.spotsTotal - shift.spotsAvailable;
  const fillPct     = Math.round((spotsFilled / Math.max(shift.spotsTotal, 1)) * 100);

  type CtaState = 'apply' | 'pending' | 'clock-in' | 'clocked-in';
  const ctaState: CtaState = clockedIn
    ? 'clocked-in' : accepted ? 'clock-in' : applied ? 'pending' : 'apply';

  function handleCta() {
    if (ctaState === 'apply')    void submitApplication(shiftId);
    if (ctaState === 'clock-in') navigate(`/clock/${shiftId}`);
  }

  return (
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
            aria-pressed={saved} onClick={() => toggleSaved(shiftId)}
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
          <span className="bg-black text-white text-[12px] font-bold px-4 py-1.5 rounded-full uppercase tracking-wide">
            {shift.jobType}
          </span>
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
              <p className="text-[#737373] text-[13px] truncate">{shift.location} · {shift.distanceMiles} mi away</p>
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
          <SectionHeading>
            <span className="flex items-center gap-2">
              <Shirt size={16} aria-hidden className="text-[#737373]" />
              Dress Code
            </span>
          </SectionHeading>
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
          <div className="rounded-[12px] overflow-hidden border border-[#DBDBDB]" style={{ height: 180 }}>
            <Map defaultCenter={{ lat: shift.lat, lng: shift.lng }} defaultZoom={15}
              styles={DARK_MAP_STYLES} disableDefaultUI gestureHandling="none"
              backgroundColor="#000000" style={{ width: '100%', height: '100%' }}>
              <Marker position={{ lat: shift.lat, lng: shift.lng }} icon={goldPinUrl(true)} />
            </Map>
          </div>
          <div className="flex items-center gap-2 mt-2.5">
            <MapPin size={13} aria-hidden className="text-[#737373] flex-shrink-0" />
            <p className="text-[#737373] text-[13px]">{shift.location} · {shift.distanceMiles} mi from your location</p>
          </div>
        </div>

        {/* AI match score */}
        <div className="px-5 pb-6">
          <div className="bg-[#F0F7FF] border border-[#DBDBDB] rounded-[12px] px-5 py-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#0095F6]/10 border border-[#0095F6]/20 flex items-center justify-center flex-shrink-0">
              <Sparkles size={20} aria-hidden className="text-[#0095F6]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[#0095F6] font-bold text-[22px]">{shift.aiMatchPct}%</span>
                <span className="bg-[#0095F6]/10 text-[#0095F6] text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide border border-[#0095F6]/20">
                  Match
                </span>
              </div>
              <p className="text-[#737373] text-[13px] leading-snug">
                {shift.aiMatchPct >= 90
                  ? 'Your skills align perfectly with this shift'
                  : shift.aiMatchPct >= 80
                  ? 'Strong match — you meet most requirements'
                  : 'Good match — a few areas to strengthen'}
              </p>
            </div>
          </div>
        </div>

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
          <div className="flex items-center gap-2 mt-3">
            <div className="flex -space-x-2">
              {Array.from({ length: Math.min(spotsFilled, 4) }).map((_, i) => (
                <img key={i} src={`https://i.pravatar.cc/32?img=${10 + i}`} alt=""
                  aria-hidden loading="lazy" decoding="async"
                  className="w-7 h-7 rounded-full border-2 border-white object-cover" />
              ))}
            </div>
            {spotsFilled > 0 && (
              <p className="text-[#737373] text-[12px]">
                {spotsFilled} worker{spotsFilled !== 1 ? 's' : ''} already booked
              </p>
            )}
          </div>
        </div>
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

        {ctaState === 'apply' && (
          <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={handleCta}
            aria-label={`Apply to ${shift.companyName}`}
            className="w-full h-[52px] rounded-[8px] bg-black text-white font-bold text-[16px] tracking-wide">
            Apply Now
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
            <button type="button" onClick={() => markAccepted(shiftId)}
              className="text-[#737373] text-[11px] underline underline-offset-2">
              Demo: simulate client acceptance →
            </button>
          </div>
        )}

        {ctaState === 'clock-in' && (
          <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={handleCta}
            aria-label="Clock in to your shift"
            className="w-full h-[52px] rounded-[8px] bg-black text-white font-bold text-[16px] tracking-wide flex items-center justify-center gap-2.5">
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.6 }}>
              <AlarmClock size={20} aria-hidden />
            </motion.div>
            Clock In
          </motion.button>
        )}

        {ctaState === 'clocked-in' && (
          <div className="w-full h-[52px] rounded-[8px] bg-[#FAFAFA] border border-emerald-200 flex items-center justify-center gap-2.5">
            <CheckCircle2 size={18} aria-hidden className="text-emerald-500" />
            <span className="text-emerald-600 font-bold text-[15px]">Clocked In</span>
          </div>
        )}
      </div>
    </div>
  );
}
