import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { useParams, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  Heart,
  Sparkles,
  Calendar,
  Clock,
  Timer,
  MapPin,
  Phone,
  Users,
  Shirt,
  CheckCircle2,
  AlarmClock,
} from 'lucide-react';
import { MOCK_SHIFTS } from '@/data/mockFeed';
import { useFeedStore, toggleSaved, markApplied, markAccepted, markClockedIn } from '@/store/feedStore';

/* ─── Leaflet overrides ──────────────────────────────────────────────────── */
const MAP_STYLE = `
  .leaflet-container { background: #000 !important; font-family: 'Space Grotesk', sans-serif; }
  .leaflet-control-zoom, .leaflet-control-attribution { display: none !important; }
  .leaflet-tile { filter: brightness(0.9) saturate(0.8); }
  .leaflet-grab, .leaflet-dragging { cursor: default !important; }
`;

function makeDetailPin(): L.DivIcon {
  const svg = `
    <svg width="38" height="50" viewBox="0 0 38 50" xmlns="http://www.w3.org/2000/svg"
         style="filter:drop-shadow(0 4px 12px rgba(255,215,0,0.7))">
      <path d="M19 0C8.507 0 0 8.507 0 19c0 12.666 19 31 19 31S38 31.666 38 19C38 8.507 29.493 0 19 0z"
            fill="#FFD700" stroke="#000" stroke-width="2"/>
      <circle cx="19" cy="19" r="7" fill="#000"/>
      <circle cx="19" cy="19" r="3.5" fill="#FFD700"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize:   [38, 50],
    iconAnchor: [19, 50],
  });
}

/* ─── Duration helper ────────────────────────────────────────────────────── */
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

/* ─── Section heading ────────────────────────────────────────────────────── */
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-white font-bold text-[17px] mb-3 tracking-tight">{children}</h2>
  );
}

/* ─── Client logo (initials) ─────────────────────────────────────────────── */
function ClientLogo({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <div
      aria-hidden="true"
      className="w-[52px] h-[52px] rounded-[14px] bg-[#111] border border-[#2A2A2A] flex items-center justify-center flex-shrink-0"
    >
      <span className="text-primary font-bold text-[17px] tracking-tight">{initials}</span>
    </div>
  );
}

/* ─── Stat tile ──────────────────────────────────────────────────────────── */
function StatTile({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="flex-1 bg-[#0E0E0E] border border-[#1E1E1E] rounded-[14px] px-3 py-3.5 flex flex-col gap-1.5">
      <div className="w-7 h-7 rounded-[8px] bg-[#161616] flex items-center justify-center">
        {icon}
      </div>
      <p className="text-[#555] text-[10px] font-semibold uppercase tracking-wider">{label}</p>
      <p className={`font-bold text-[15px] leading-tight ${accent ? 'text-primary' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-[#555] text-[11px]">{sub}</p>}
    </div>
  );
}

/* ─── ShiftDetailScreen ──────────────────────────────────────────────────── */
export function ShiftDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const store = useFeedStore();

  const shift = MOCK_SHIFTS.find((s) => s.id === id);

  if (!shift) {
    return (
      <div className="min-h-[100dvh] bg-black flex items-center justify-center">
        <p className="text-[#666] text-[15px]">Shift not found.</p>
      </div>
    );
  }

  // Hoist id so closures always see a non-nullable string
  const shiftId    = shift.id;
  const saved      = store.isSaved(shiftId);
  const applied    = store.isApplied(shiftId);
  const accepted   = store.isAccepted(shiftId);
  const clockedIn  = store.isClockedIn(shiftId);
  const spotsLow   = shift.spotsAvailable < 3;
  const duration   = calcDuration(shift.startTime, shift.endTime);
  const spotsFilled = shift.spotsTotal - shift.spotsAvailable;
  const fillPct    = Math.round((spotsFilled / shift.spotsTotal) * 100);

  /* CTA state */
  type CtaState = 'apply' | 'pending' | 'clock-in' | 'clocked-in';
  const ctaState: CtaState = clockedIn
    ? 'clocked-in'
    : accepted
    ? 'clock-in'
    : applied
    ? 'pending'
    : 'apply';

  function handleCta() {
    if (ctaState === 'apply')     markApplied(shiftId);
    if (ctaState === 'clock-in')  markClockedIn(shiftId);
  }

  return (
    <div className="min-h-[100dvh] bg-black flex flex-col">
      <style>{MAP_STYLE}</style>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto pb-[104px]">

        {/* ── HERO PHOTO ── */}
        <div className="relative w-full h-[300px] flex-shrink-0 overflow-hidden">
          <img
            src={shift.coverImage}
            alt={`${shift.jobType} at ${shift.companyName}`}
            loading="eager"
            decoding="async"
            className="w-full h-full object-cover"
          />
          {/* Gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/10 to-black" />

          {/* Back */}
          <button
            type="button"
            aria-label="Go back"
            onClick={() => navigate(-1 as never)}
            className="absolute top-5 left-4 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center"
          >
            <ChevronLeft size={20} aria-hidden className="text-white" />
          </button>

          {/* Save */}
          <button
            type="button"
            aria-label={saved ? 'Remove from saved' : 'Save this shift'}
            aria-pressed={saved}
            onClick={() => toggleSaved(shiftId)}
            className="absolute top-5 right-4 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center"
          >
            <AnimatePresence mode="wait">
              <motion.span
                key={saved ? 'on' : 'off'}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.14 }}
              >
                <Heart size={18} aria-hidden className={saved ? 'text-primary fill-primary' : 'text-white'} />
              </motion.span>
            </AnimatePresence>
          </button>
        </div>

        {/* ── JOB TYPE + PAY ── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#111]">
          <span className="bg-primary text-black text-[12px] font-bold px-4 py-1.5 rounded-full uppercase tracking-wide">
            {shift.jobType}
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-primary font-bold text-[26px]">${shift.payRate}</span>
            <span className="text-[#555] text-[14px] font-medium">/{shift.payPeriod}</span>
          </div>
        </div>

        {/* ── CLIENT ── */}
        <div className="flex items-center gap-4 px-5 py-4 border-b border-[#111]">
          <ClientLogo name={shift.companyName} />
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-[17px] leading-tight truncate">{shift.companyName}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <MapPin size={12} aria-hidden className="text-[#555] flex-shrink-0" />
              <p className="text-[#666] text-[13px] truncate">{shift.location} · {shift.distanceMiles} mi away</p>
            </div>
          </div>
        </div>

        {/* ── DATE / TIME / DURATION tiles ── */}
        <div className="flex gap-3 px-5 pt-4 pb-5" role="group" aria-label="Shift schedule">
          <StatTile
            icon={<Calendar size={14} aria-hidden className="text-primary" />}
            label="Date"
            value={shift.date}
          />
          <StatTile
            icon={<Clock size={14} aria-hidden className="text-primary" />}
            label="Time"
            value={shift.startTime}
            sub={`Ends ${shift.endTime}`}
          />
          <StatTile
            icon={<Timer size={14} aria-hidden className="text-primary" />}
            label="Duration"
            value={duration}
            accent
          />
        </div>

        {/* ── DRESS CODE ── */}
        <div className="px-5 pb-6">
          <SectionHeading>
            <span className="flex items-center gap-2">
              <Shirt size={16} aria-hidden className="text-primary" />
              Dress Code
            </span>
          </SectionHeading>
          <div
            className="border border-[#323232] rounded-[16px] p-4"
            role="list"
            aria-label="Dress code items"
          >
            <div className="flex flex-wrap gap-2">
              {shift.dressCodeItems.map((item) => (
                <div
                  key={item}
                  role="listitem"
                  className="bg-[#141414] border border-[#252525] rounded-full px-3.5 py-1.5"
                >
                  <span className="text-white text-[13px] font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── DESCRIPTION ── */}
        <div className="px-5 pb-6">
          <SectionHeading>About this Shift</SectionHeading>
          <p className="text-[#888] text-[14px] leading-[1.7]">{shift.description}</p>
        </div>

        {/* ── REQUIREMENTS ── */}
        <div className="px-5 pb-6">
          <SectionHeading>Requirements</SectionHeading>
          <ul className="flex flex-col gap-2.5" aria-label="Shift requirements">
            {shift.requirements.map((req) => (
              <li key={req} className="flex items-center gap-3">
                <CheckCircle2 size={15} aria-hidden className="text-primary flex-shrink-0" />
                <span className="text-[#888] text-[14px]">{req}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ── POINT OF CONTACT ── */}
        <div className="px-5 pb-6">
          <SectionHeading>Point of Contact</SectionHeading>
          <div className="bg-[#0E0E0E] border border-[#1E1E1E] rounded-[16px] px-4 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#161616] border border-[#2A2A2A] flex items-center justify-center flex-shrink-0">
              <span className="text-primary font-bold text-[14px]">
                {shift.pointOfContact.split(' ').map((n) => n[0]).join('')}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-[14px]">{shift.pointOfContact}</p>
              <p className="text-[#666] text-[12px] mt-0.5">{shift.contactPhone}</p>
            </div>
            <a
              href={`tel:${shift.contactPhone}`}
              aria-label={`Call ${shift.pointOfContact}`}
              className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0"
            >
              <Phone size={15} aria-hidden className="text-primary" />
            </a>
          </div>
        </div>

        {/* ── MINI MAP ── */}
        <div className="px-5 pb-6">
          <SectionHeading>Location</SectionHeading>
          <div className="rounded-[16px] overflow-hidden border border-[#1E1E1E]" style={{ height: 180 }}>
            <MapContainer
              center={[shift.lat, shift.lng]}
              zoom={15}
              zoomControl={false}
              attributionControl={false}
              dragging={false}
              scrollWheelZoom={false}
              touchZoom={false}
              doubleClickZoom={false}
              keyboard={false}
              style={{ height: '100%', width: '100%', background: '#000' }}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                subdomains="abcd"
                maxZoom={19}
              />
              <Marker position={[shift.lat, shift.lng]} icon={makeDetailPin()} />
            </MapContainer>
          </div>
          <div className="flex items-center gap-2 mt-2.5">
            <MapPin size={13} aria-hidden className="text-primary flex-shrink-0" />
            <p className="text-[#666] text-[13px]">{shift.location} · {shift.distanceMiles} mi from your location</p>
          </div>
        </div>

        {/* ── AI MATCH SCORE ── */}
        <div className="px-5 pb-6">
          <div className="bg-[#0D0D00] border border-primary/25 rounded-[16px] px-5 py-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0">
              <Sparkles size={20} aria-hidden className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-primary font-bold text-[22px]">{shift.aiMatchPct}%</span>
                <span className="bg-primary/15 text-primary text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide border border-primary/20">
                  Match
                </span>
              </div>
              <p className="text-[#888] text-[13px] leading-snug">
                {shift.aiMatchPct >= 90
                  ? 'Your skills align perfectly with this shift'
                  : shift.aiMatchPct >= 80
                  ? 'Strong match — you meet most requirements'
                  : 'Good match — a few areas to strengthen'}
              </p>
            </div>
          </div>
        </div>

        {/* ── SPOTS REMAINING ── */}
        <div className="px-5 pb-6">
          <div className="flex items-center justify-between mb-3">
            <SectionHeading>Spots Remaining</SectionHeading>
            <div className="flex items-center gap-1.5">
              <Users size={13} aria-hidden className={spotsLow ? 'text-red-400' : 'text-[#555]'} />
              <span className={`text-[13px] font-semibold ${spotsLow ? 'text-red-400' : 'text-[#666]'}`}>
                {shift.spotsAvailable} of {shift.spotsTotal} left
                {spotsLow && ' · Filling fast'}
              </span>
            </div>
          </div>
          {/* Progress bar — shows spots FILLED */}
          <div
            className="h-2 bg-[#1A1A1A] rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={fillPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${fillPct}% of spots filled`}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${fillPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
              className={`h-full rounded-full ${spotsLow ? 'bg-red-500' : 'bg-primary'}`}
            />
          </div>
          {/* Worker avatars row */}
          <div className="flex items-center gap-2 mt-3">
            <div className="flex -space-x-2">
              {Array.from({ length: Math.min(spotsFilled, 4) }).map((_, i) => (
                <img
                  key={i}
                  src={`https://i.pravatar.cc/32?img=${10 + i}`}
                  alt=""
                  aria-hidden
                  loading="lazy"
                  decoding="async"
                  className="w-7 h-7 rounded-full border-2 border-black object-cover"
                />
              ))}
            </div>
            {spotsFilled > 0 && (
              <p className="text-[#555] text-[12px]">
                {spotsFilled} worker{spotsFilled !== 1 ? 's' : ''} already booked
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── FIXED CTA ── */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] px-5 pb-9 pt-4 bg-gradient-to-t from-black via-black/98 to-transparent z-30">

        {/* Pending sub-label */}
        <AnimatePresence>
          {ctaState === 'pending' && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center text-[#555] text-[12px] mb-2"
            >
              Application submitted · Awaiting client review
            </motion.p>
          )}
        </AnimatePresence>

        {ctaState === 'apply' && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={handleCta}
            aria-label={`Apply to ${shift.companyName}`}
            className="w-full h-[54px] rounded-[14px] bg-primary text-black font-bold text-[16px] tracking-wide"
          >
            Apply Now
          </motion.button>
        )}

        {ctaState === 'pending' && (
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-full h-[54px] rounded-[14px] bg-[#141414] border border-[#252525] flex items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[#666] font-semibold text-[15px]">Application Sent</span>
            </div>
            {/* Demo tap — simulates client acceptance so Clock In is reachable */}
            <button
              type="button"
              onClick={() => markAccepted(shiftId)}
              className="text-[#444] text-[11px] underline underline-offset-2"
            >
              Demo: simulate client acceptance →
            </button>
          </div>
        )}

        {ctaState === 'clock-in' && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={handleCta}
            aria-label="Clock in to your shift"
            className="w-full h-[54px] rounded-[14px] bg-primary text-black font-bold text-[16px] tracking-wide flex items-center justify-center gap-2.5"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1.6 }}
            >
              <AlarmClock size={20} aria-hidden />
            </motion.div>
            Clock In
          </motion.button>
        )}

        {ctaState === 'clocked-in' && (
          <div className="w-full h-[54px] rounded-[14px] bg-[#141414] border border-primary/20 flex items-center justify-center gap-2.5">
            <CheckCircle2 size={18} aria-hidden className="text-primary" />
            <span className="text-primary font-bold text-[15px]">Clocked In</span>
          </div>
        )}
      </div>
    </div>
  );
}
