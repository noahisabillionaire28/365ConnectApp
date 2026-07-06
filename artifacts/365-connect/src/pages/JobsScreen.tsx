import { Map, Marker, useMap } from '@vis.gl/react-google-maps';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { motion, useMotionValue, animate, type PanInfo } from 'framer-motion';
import { Search, SlidersHorizontal, Heart, MapPin, Clock, Users, Sparkles } from 'lucide-react';
import { BottomTabNav } from '@/components/BottomTabNav';
import { MOCK_SHIFTS, type MockShift } from '@/data/mockFeed';
import { useFeedStore, toggleSaved } from '@/store/feedStore';
import { DARK_MAP_STYLES, goldPinUrl } from '@/lib/mapStyles';

/* ─── Map fly-to controller ──────────────────────────────────────────────── */
function MapController({ shift }: { shift: MockShift | null }) {
  const map = useMap();
  useEffect(() => {
    if (map && shift) {
      map.panTo({ lat: shift.lat, lng: shift.lng });
      map.setZoom(14);
    }
  }, [map, shift]);
  return null;
}

/* ─── Filter pill definitions ────────────────────────────────────────────── */
type FilterKey = 'all' | 'pay30' | 'near3' | 'tonight' | 'vip';

const FILTER_PILLS: { key: FilterKey; label: string }[] = [
  { key: 'all',     label: 'All Jobs' },
  { key: 'pay30',   label: '$30+/hr' },
  { key: 'near3',   label: '< 3 mi' },
  { key: 'tonight', label: 'Tonight' },
  { key: 'vip',     label: 'VIP / Fine Dining' },
];

function applyFilter(shifts: MockShift[], f: FilterKey): MockShift[] {
  switch (f) {
    case 'pay30':   return shifts.filter((s) => s.payRate >= 30);
    case 'near3':   return shifts.filter((s) => s.distanceMiles < 3);
    case 'tonight': return shifts.filter((s) => s.date === 'Tonight');
    case 'vip':     return shifts.filter((s) =>
      ['VIP Server', 'Catering Lead', 'Cocktail Server'].includes(s.jobType));
    default:        return shifts;
  }
}

/* ─── Compact sheet card ─────────────────────────────────────────────────── */
function SheetCard({
  shift,
  selected,
  onTap,
}: {
  shift: MockShift;
  selected: boolean;
  onTap: () => void;
}) {
  const store = useFeedStore();
  const saved = store.isSaved(shift.id);
  const spotsLow = shift.spotsAvailable < 3;

  function handleSave(e: React.MouseEvent) {
    e.stopPropagation();
    toggleSaved(shift.id);
  }

  return (
    <div
      role="article"
      tabIndex={0}
      aria-label={`${shift.jobType} at ${shift.companyName}, $${shift.payRate}/${shift.payPeriod}`}
      onClick={onTap}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onTap()}
      className={`
        w-[264px] flex-shrink-0 rounded-[16px] overflow-hidden bg-[#0E0E0E] cursor-pointer
        transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary
        ${selected
          ? 'border-2 border-primary shadow-[0_0_16px_rgba(255,215,0,0.35)]'
          : 'border border-[#2A2A2A]'}
      `}
    >
      {/* Cover photo */}
      <div className="relative h-[120px] overflow-hidden">
        <img
          src={shift.coverImage}
          alt={`${shift.jobType} at ${shift.companyName}`}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-black/20" />

        {/* Job type pill */}
        <div className="absolute top-2.5 left-2.5">
          <span className="bg-primary text-black text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
            {shift.jobType}
          </span>
        </div>

        {/* Save */}
        <button
          type="button"
          aria-label={saved ? 'Remove from saved' : 'Save shift'}
          aria-pressed={saved}
          onClick={handleSave}
          className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center"
        >
          <Heart size={12} aria-hidden className={saved ? 'text-primary fill-primary' : 'text-white fill-transparent'} />
        </button>

        {/* Company name */}
        <div className="absolute bottom-2 left-2.5 right-8">
          <p className="text-white font-bold text-[13px] leading-tight truncate drop-shadow-md">
            {shift.companyName}
          </p>
        </div>

        {/* AI match */}
        <div className="absolute bottom-2 right-2.5" aria-label={`${shift.aiMatchPct}% AI match`}>
          <div className="flex items-center gap-1 bg-black/70 backdrop-blur-sm border border-primary/40 rounded-full px-2 py-0.5">
            <Sparkles size={9} aria-hidden className="text-primary" />
            <span className="text-primary text-[10px] font-bold">{shift.aiMatchPct}%</span>
          </div>
        </div>
      </div>

      {/* Card body */}
      <div className="px-3 pt-2.5 pb-3 flex flex-col gap-2">
        {/* Pay */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-0.5">
            <span className="text-primary font-bold text-[18px]">${shift.payRate}</span>
            <span className="text-[#555] text-[11px]">/{shift.payPeriod}</span>
          </div>
          <div className="flex items-center gap-1 bg-[#161616] border border-[#2A2A2A] rounded-full px-2 py-1">
            <Clock size={10} aria-hidden className="text-[#555]" />
            <span className="text-[#888] text-[10px]">{shift.startTime}</span>
          </div>
        </div>

        {/* Chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1 bg-[#161616] border border-[#2A2A2A] rounded-full px-2 py-0.5">
            <span className="text-[#888] text-[10px]">{shift.date}</span>
          </div>
          <div className="flex items-center gap-1 bg-[#161616] border border-[#2A2A2A] rounded-full px-2 py-0.5">
            <MapPin size={9} aria-hidden className="text-[#555]" />
            <span className="text-[#888] text-[10px]">{shift.distanceMiles} mi</span>
          </div>
          <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 border ${
            spotsLow ? 'bg-red-500/10 border-red-500/30' : 'bg-[#161616] border-[#2A2A2A]'}`}>
            <Users size={9} aria-hidden className={spotsLow ? 'text-red-400' : 'text-[#555]'} />
            <span className={`text-[10px] ${spotsLow ? 'text-red-400' : 'text-[#888]'}`}>
              {shift.spotsAvailable} left
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Bottom sheet ───────────────────────────────────────────────────────── */
const SHEET_H   = 428;
const COLLAPSED = 216; // visible height when collapsed
const SNAP_COLL = SHEET_H - COLLAPSED; // translateY for collapsed state
const SNAP_EXP  = 0;                   // translateY for expanded state

function BottomSheet({
  shifts,
  selectedId,
  onSelectShift,
}: {
  shifts: MockShift[];
  selectedId: string | null;
  onSelectShift: (shift: MockShift) => void;
}) {
  const y = useMotionValue(SNAP_COLL);
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Scroll selected card into view
  useEffect(() => {
    if (!selectedId || !scrollRef.current) return;
    const el = cardRefs.current[selectedId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [selectedId]);

  function snapTo(target: number, isExpanded: boolean) {
    animate(y, target, { type: 'spring', stiffness: 380, damping: 38, restDelta: 0.5 });
    setExpanded(isExpanded);
  }

  function handleDragEnd(_: unknown, info: PanInfo) {
    const cur = y.get();
    const mid = (SNAP_EXP + SNAP_COLL) / 2;
    if (info.velocity.y < -300) {
      snapTo(SNAP_EXP, true);
    } else if (info.velocity.y > 300) {
      snapTo(SNAP_COLL, false);
    } else {
      const target = cur <= mid ? SNAP_EXP : SNAP_COLL;
      snapTo(target, target === SNAP_EXP);
    }
  }

  return (
    /* Outer div owns fixed positioning + centering so Framer Motion's y-transform
       doesn't clobber the -translate-x-1/2 centering transform */
    <div
      className="fixed left-1/2 -translate-x-1/2 w-full max-w-[390px] z-30"
      style={{ bottom: 72 }}
    >
    <motion.div
      drag="y"
      dragConstraints={{ top: SNAP_EXP, bottom: SNAP_COLL }}
      dragElastic={{ top: 0.08, bottom: 0.08 }}
      onDragEnd={handleDragEnd}
      style={{ y, touchAction: 'none' }}
    >
      <div
        className="bg-[#0A0A0A]/95 backdrop-blur-md border-t border-[#242424] rounded-t-[22px] overflow-hidden"
        style={{ height: SHEET_H }}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing"
          aria-hidden="true"
        >
          <div className="w-10 h-[4px] rounded-full bg-[#333]" />
        </div>

        {/* Sheet header */}
        <div className="flex items-center justify-between px-4 py-2">
          <div>
            <p className="text-white font-bold text-[15px]">
              {shifts.length} shift{shifts.length !== 1 ? 's' : ''} near you
            </p>
            <p className="text-[#555] text-[11px] mt-[1px]">Tap a pin or card to view details</p>
          </div>
          <button
            type="button"
            aria-label={expanded ? 'Collapse sheet' : 'Expand sheet'}
            onClick={() => expanded ? snapTo(SNAP_COLL, false) : snapTo(SNAP_EXP, true)}
            className="text-[#555] text-[11px] font-medium underline underline-offset-2"
          >
            {expanded ? 'Collapse' : 'See all'}
          </button>
        </div>

        {/* Horizontal card scroll */}
        <div
          ref={scrollRef}
          className="flex gap-3 px-4 pb-4 overflow-x-auto scrollbar-none pt-1"
          role="list"
          aria-label="Available shifts"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {shifts.map((shift) => (
            <div
              key={shift.id}
              role="listitem"
              ref={(el) => { cardRefs.current[shift.id] = el; }}
            >
              <SheetCard
                shift={shift}
                selected={selectedId === shift.id}
                onTap={() => onSelectShift(shift)}
              />
            </div>
          ))}

          {shifts.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center py-8 text-center px-4">
              <p className="text-[#444] text-[14px]">No shifts match this filter.</p>
              <p className="text-[#333] text-[12px] mt-1">Try a different category.</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
    </div>
  );
}

/* ─── JobsScreen ─────────────────────────────────────────────────────────── */
export function JobsScreen() {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filter chain: text search → pill filter
  const textFiltered = MOCK_SHIFTS.filter((s) =>
    !query || [s.jobType, s.companyName, s.location].some((f) =>
      f.toLowerCase().includes(query.toLowerCase())
    )
  );
  const visibleShifts = applyFilter(textFiltered, activeFilter);
  const selectedShift = visibleShifts.find((s) => s.id === selectedId) ?? null;

  function handleSelectShift(shift: MockShift) {
    setSelectedId(shift.id);
    navigate(`/shift/${shift.id}`);
  }

  function handlePinClick(shift: MockShift) {
    setSelectedId(shift.id);
  }

  return (
    <div className="relative h-[100dvh] bg-black overflow-hidden">

      {/* ── Map layer ──────────────────────────────────────────────────── */}
      <div className="absolute inset-0 z-0">
        <Map
          defaultCenter={{ lat: 25.7913, lng: -80.1450 }}
          defaultZoom={12}
          styles={DARK_MAP_STYLES}
          disableDefaultUI
          gestureHandling="greedy"
          backgroundColor="#000000"
          style={{ width: '100%', height: '100%' }}
        >
          {/* Fly to selected shift */}
          <MapController shift={selectedShift} />

          {/* Gold pins */}
          {visibleShifts.map((shift) => (
            <Marker
              key={shift.id}
              position={{ lat: shift.lat, lng: shift.lng }}
              icon={goldPinUrl(selectedId === shift.id)}
              onClick={() => handlePinClick(shift)}
            />
          ))}
        </Map>
      </div>

      {/* ── Top overlay: search + filters ──────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-40 pointer-events-none">
        <div className="pointer-events-auto">
          {/* Search bar */}
          <div className="px-4 pt-5 pb-3 bg-gradient-to-b from-black/90 via-black/70 to-transparent">
            <div className="flex items-center gap-2 bg-[#0E0E0E] border border-[#323232] rounded-[14px] px-3.5 h-[46px]">
              <Search size={16} aria-hidden className="text-[#555] flex-shrink-0" />
              <input
                type="search"
                placeholder="Search shifts, job types, locations…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search shifts"
                className="flex-1 bg-transparent text-white text-[14px] placeholder:text-[#444] outline-none font-medium"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setQuery('')}
                  className="text-[#555] text-[12px]"
                >
                  ✕
                </button>
              )}
              <div className="w-px h-4 bg-[#2A2A2A]" aria-hidden />
              <button type="button" aria-label="Open filters" className="flex-shrink-0">
                <SlidersHorizontal size={15} aria-hidden className="text-[#888]" />
              </button>
            </div>
          </div>

          {/* Filter pills */}
          <div
            className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-none"
            role="radiogroup"
            aria-label="Filter shifts"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {FILTER_PILLS.map((pill) => {
              const active = activeFilter === pill.key;
              return (
                <button
                  key={pill.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setActiveFilter(pill.key);
                    setSelectedId(null);
                  }}
                  className={`
                    flex-shrink-0 h-[34px] px-4 rounded-full text-[12px] font-semibold
                    transition-all duration-150 whitespace-nowrap
                    ${active
                      ? 'bg-primary text-black border-2 border-primary'
                      : 'bg-[#0E0E0E]/80 text-[#888] border border-[#323232] backdrop-blur-sm'}
                  `}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Screen-reader accessible shift list (map alternative) ─────── */}
      <div className="sr-only" aria-label="Shifts on map — use the card list below to select">
        {visibleShifts.map((shift) => (
          <button
            key={shift.id}
            type="button"
            aria-label={`Select ${shift.jobType} at ${shift.companyName}, ${shift.payRate}/${shift.payPeriod}, ${shift.distanceMiles} miles away`}
            onClick={() => handlePinClick(shift)}
          />
        ))}
      </div>

      {/* ── Bottom sheet ───────────────────────────────────────────────── */}
      <BottomSheet
        shifts={visibleShifts}
        selectedId={selectedId}
        onSelectShift={handleSelectShift}
      />

      {/* ── Tab nav ────────────────────────────────────────────────────── */}
      <BottomTabNav />
    </div>
  );
}
