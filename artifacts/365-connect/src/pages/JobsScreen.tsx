import { APIProvider, Map, Marker, useMap } from '@vis.gl/react-google-maps';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { motion, useMotionValue, animate, type PanInfo } from 'framer-motion';
import { Search, SlidersHorizontal, Heart, MapPin, Clock, Users, Sparkles, WifiOff, CheckCircle2 } from 'lucide-react';
import { BottomTabNav } from '@/components/BottomTabNav';
import { type MockShift } from '@/data/mockFeed';
import { useFeedStore, toggleSaved } from '@/store/feedStore';
import { LIGHT_MAP_STYLES, goldPinUrl } from '@/lib/mapStyles';
import { useShifts } from '@/hooks/useShifts';
import { useApplications } from '@/hooks/useApplications';

/* ── API key — resolved once at module load ─────────────────────────────── */
const API_KEY: string = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';

/* ── MapController — lives inside <Map> context ─────────────────────────── */
function MapController({ shift }: { shift: MockShift | null }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    // Belt-and-suspenders resize after the SDK mounts, in case the container
    // still reported 0 height at init time.
    const id = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    return () => window.clearTimeout(id);
  }, [map]);

  useEffect(() => {
    if (map && shift) {
      map.panTo({ lat: shift.lat, lng: shift.lng });
      map.setZoom(14);
    }
  }, [map, shift]);

  return null;
}

/* ── Filter logic ────────────────────────────────────────────────────────── */
type FilterKey = 'all' | 'pay30' | 'near3' | 'tonight' | 'vip';

const FILTER_PILLS: { key: FilterKey; label: string }[] = [
  { key: 'all',     label: 'All Jobs'         },
  { key: 'pay30',   label: '$30+/hr'          },
  { key: 'near3',   label: '< 3 mi'           },
  { key: 'tonight', label: 'Tonight'          },
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

/* ── Sheet card ──────────────────────────────────────────────────────────── */
function SheetCard({ shift, selected, onTap, applied }: {
  shift: MockShift; selected: boolean; onTap: () => void; applied?: boolean;
}) {
  const store    = useFeedStore();
  const saved    = store.isSaved(shift.id);
  const spotsLow = shift.spotsAvailable < 3;

  function handleSave(e: React.MouseEvent) { e.stopPropagation(); toggleSaved(shift.id); }

  return (
    <div role="article" tabIndex={0}
      aria-label={`${shift.jobType} at ${shift.companyName}, ${shift.payRate}/${shift.payPeriod}${applied ? ' — Applied' : ''}`}
      onClick={onTap} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onTap()}
      className={`w-[264px] flex-shrink-0 rounded-[12px] overflow-hidden bg-white cursor-pointer
        transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-black
        ${selected ? 'border-2 border-black shadow-lg' : 'border border-[#DBDBDB]'}`}>

      <div className="relative h-[120px] overflow-hidden">
        <img src={shift.coverImage} alt={`${shift.jobType} at ${shift.companyName}`}
          loading="lazy" decoding="async" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-black/20" />

        <div className="absolute top-2.5 left-2.5">
          <span className="bg-black text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
            {shift.jobType}
          </span>
        </div>

        {/* Applied badge — green circle, sits to the left of the heart when present */}
        {applied && (
          <div
            aria-label="Already applied"
            className="absolute top-2.5 right-[42px] w-7 h-7 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center shadow-sm"
          >
            <CheckCircle2 size={13} aria-hidden className="text-white" strokeWidth={2.5} />
          </div>
        )}

        <button type="button" aria-label={saved ? 'Remove from saved' : 'Save shift'} aria-pressed={saved}
          onClick={handleSave}
          className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center">
          <Heart size={12} aria-hidden className={saved ? 'text-white fill-white' : 'text-white fill-transparent'} />
        </button>

        <div className="absolute bottom-2 left-2.5 right-8">
          <p className="text-white font-bold text-[13px] leading-tight truncate drop-shadow-md">{shift.companyName}</p>
        </div>

        <div className="absolute bottom-2 right-2.5" aria-label={`${shift.aiMatchPct}% AI match`}>
          <div className="flex items-center gap-1 bg-black/70 backdrop-blur-sm border border-white/20 rounded-full px-2 py-0.5">
            <Sparkles size={9} aria-hidden className="text-white" />
            <span className="text-white text-[10px] font-bold">{shift.aiMatchPct}%</span>
          </div>
        </div>
      </div>

      <div className="px-3 pt-2.5 pb-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-0.5">
            <span className="text-black font-bold text-[18px]">${shift.payRate}</span>
            <span className="text-[#737373] text-[11px]">/{shift.payPeriod}</span>
          </div>
          <div className="flex items-center gap-1 bg-[#FAFAFA] border border-[#DBDBDB] rounded-full px-2 py-1">
            <Clock size={10} aria-hidden className="text-[#737373]" />
            <span className="text-[#737373] text-[10px]">{shift.startTime}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1 bg-[#FAFAFA] border border-[#DBDBDB] rounded-full px-2 py-0.5">
            <span className="text-[#737373] text-[10px]">{shift.date}</span>
          </div>
          <div className="flex items-center gap-1 bg-[#FAFAFA] border border-[#DBDBDB] rounded-full px-2 py-0.5">
            <MapPin size={9} aria-hidden className="text-[#737373]" />
            <span className="text-[#737373] text-[10px]">{shift.distanceMiles} mi</span>
          </div>
          <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 border ${
            spotsLow ? 'bg-red-50 border-red-200' : 'bg-[#FAFAFA] border-[#DBDBDB]'}`}>
            <Users size={9} aria-hidden className={spotsLow ? 'text-red-500' : 'text-[#737373]'} />
            <span className={`text-[10px] ${spotsLow ? 'text-red-500' : 'text-[#737373]'}`}>
              {shift.spotsAvailable} left
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sheet skeleton card ─────────────────────────────────────────────────── */
function SheetCardSkeleton() {
  return (
    <div className="w-[264px] flex-shrink-0 rounded-[12px] overflow-hidden bg-white border border-[#DBDBDB]">
      <div className="h-[120px] bg-[#EFEFEF] animate-pulse" />
      <div className="px-3 pt-2.5 pb-3 flex flex-col gap-2">
        <div className="flex justify-between">
          <div className="w-12 h-5 rounded bg-[#EFEFEF] animate-pulse" />
          <div className="w-20 h-5 rounded-full bg-[#EFEFEF] animate-pulse" />
        </div>
        <div className="flex gap-1.5">
          <div className="w-14 h-4 rounded-full bg-[#EFEFEF] animate-pulse" />
          <div className="w-10 h-4 rounded-full bg-[#EFEFEF] animate-pulse" />
        </div>
      </div>
    </div>
  );
}

/* ── Bottom sheet ────────────────────────────────────────────────────────── */
const SHEET_H   = 428;
const COLLAPSED = 216;
const SNAP_COLL = SHEET_H - COLLAPSED;
const SNAP_EXP  = 0;

function BottomSheet({ shifts, isLoading, selectedId, onSelectShift, appliedShiftIds }: {
  shifts: MockShift[]; isLoading: boolean; selectedId: string | null;
  onSelectShift: (shift: MockShift) => void; appliedShiftIds: Set<string>;
}) {
  const y         = useMotionValue(SNAP_COLL);
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs  = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!selectedId || !scrollRef.current) return;
    const el = cardRefs.current[selectedId];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selectedId]);

  function snapTo(target: number, isExpanded: boolean) {
    animate(y, target, { type: 'spring', stiffness: 380, damping: 38, restDelta: 0.5 });
    setExpanded(isExpanded);
  }

  function handleDragEnd(_: unknown, info: PanInfo) {
    const cur = y.get();
    const mid = (SNAP_EXP + SNAP_COLL) / 2;
    if (info.velocity.y < -300) snapTo(SNAP_EXP, true);
    else if (info.velocity.y > 300) snapTo(SNAP_COLL, false);
    else { const t = cur <= mid ? SNAP_EXP : SNAP_COLL; snapTo(t, t === SNAP_EXP); }
  }

  return (
    <div className="fixed left-1/2 -translate-x-1/2 w-full max-w-[390px] z-30" style={{ bottom: 56 }}>
      <motion.div drag="y" dragConstraints={{ top: SNAP_EXP, bottom: SNAP_COLL }}
        dragElastic={{ top: 0.08, bottom: 0.08 }} onDragEnd={handleDragEnd}
        style={{ y, touchAction: 'none' }}>
        <div className="bg-white border-t border-[#DBDBDB] rounded-t-[20px] overflow-hidden shadow-lg" style={{ height: SHEET_H }}>
          <div className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing" aria-hidden>
            <div className="w-10 h-[4px] rounded-full bg-[#DBDBDB]" />
          </div>

          <div className="flex items-center justify-between px-4 py-2">
            <div>
              <p className="text-black font-bold text-[15px]">
                {isLoading ? 'Loading shifts…' : `${shifts.length} shift${shifts.length !== 1 ? 's' : ''} near you`}
              </p>
              <p className="text-[#737373] text-[11px] mt-[1px]">Tap a pin or card to view details</p>
            </div>
            <button type="button" aria-label={expanded ? 'Collapse sheet' : 'Expand sheet'}
              onClick={() => expanded ? snapTo(SNAP_COLL, false) : snapTo(SNAP_EXP, true)}
              className="text-[#0095F6] text-[11px] font-medium underline underline-offset-2">
              {expanded ? 'Collapse' : 'See all'}
            </button>
          </div>

          <div ref={scrollRef}
            className="flex gap-3 px-4 pb-4 overflow-x-auto scrollbar-none pt-1"
            role="list" aria-label="Available shifts" style={{ WebkitOverflowScrolling: 'touch' }}>
            {isLoading && [1, 2, 3].map((n) => <SheetCardSkeleton key={n} />)}

            {!isLoading && shifts.map((shift) => (
              <div key={shift.id} role="listitem" ref={(el) => { cardRefs.current[shift.id] = el; }}>
                <SheetCard shift={shift} selected={selectedId === shift.id} onTap={() => onSelectShift(shift)} applied={appliedShiftIds.has(shift.id)} />
              </div>
            ))}

            {!isLoading && shifts.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center py-8 text-center px-4">
                <p className="text-[#737373] text-[14px]">No shifts match this filter.</p>
                <p className="text-[#AAAAAA] text-[12px] mt-1">Try a different category.</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ── JobsScreen ──────────────────────────────────────────────────────────── */
export function JobsScreen() {
  const [, navigate]    = useLocation();
  const [query, setQuery]               = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [selectedId, setSelectedId]     = useState<string | null>(null);

  // Map readiness tracking
  const [tilesLoaded, setTilesLoaded]   = useState(false);
  const [mapFailed,   setMapFailed]     = useState(false);
  const tilesLoadedRef                  = useRef(false);   // sync ref — read inside timeout callback

  // Container height measured via ResizeObserver so Map always gets real pixels
  const containerRef  = useRef<HTMLDivElement>(null);
  const [mapHeight, setMapHeight] = useState(0);

  const { shifts, isLoading } = useShifts();
  const { appliedShiftIds }   = useApplications();

  // ── 1. Log API-key presence on mount (never log the full key) ──
  useEffect(() => {
    if (API_KEY) {
      console.log(
        `[Jobs] Maps API key present — length: ${API_KEY.length}, prefix: ${API_KEY.slice(0, 6)}…`,
      );
    } else {
      console.warn('[Jobs] Maps API key is MISSING (import.meta.env.VITE_GOOGLE_MAPS_API_KEY is undefined)');
    }
  }, []);

  // ── 2. Measure container height — useLayoutEffect fires synchronously after
  //       React commits the DOM, so offsetHeight is the real painted value.
  //       Reading it here forces a synchronous layout, giving us a non-zero
  //       height before the first paint and before <Map> can mount at 0px.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Synchronous read — forces browser layout, always non-zero after commit
    const h = el.offsetHeight;
    if (h > 0) setMapHeight(h);
    // ResizeObserver keeps the value fresh if the viewport resizes later
    const ro = new ResizeObserver((entries) => {
      const rh = entries[0]?.contentRect.height ?? 0;
      if (rh > 0) setMapHeight(rh);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── 3. 10-second soft fallback — overlay a message if tiles are slow,
  //       but keep <Map> mounted so it can still finish loading behind it.
  useEffect(() => {
    if (!API_KEY) return;
    const t = window.setTimeout(() => {
      if (!tilesLoadedRef.current) {
        console.warn('[Jobs] Map tiles did not load within 10 s — showing overlay (map stays mounted)');
        setMapFailed(true);
      }
    }, 10000);
    return () => window.clearTimeout(t);
  }, []);

  function handleTilesReady() {
    tilesLoadedRef.current = true;
    setTilesLoaded(true);
    setMapFailed(false); // in case timer fired just before tiles arrived
  }

  const textFiltered  = shifts.filter((s) =>
    !query || [s.jobType, s.companyName, s.location].some((f) =>
      f.toLowerCase().includes(query.toLowerCase()),
    ),
  );
  const visibleShifts = applyFilter(textFiltered, activeFilter);
  const selectedShift = visibleShifts.find((s) => s.id === selectedId) ?? null;

  function handleSelectShift(shift: MockShift) { setSelectedId(shift.id); navigate(`/shift/${shift.id}`); }
  function handlePinClick(shift: MockShift)    { setSelectedId(shift.id); }

  return (
    // APIProvider wraps the ENTIRE screen — not just the inner map block —
    // so the SDK context is ready before any child tries to useMap().
    <APIProvider apiKey={API_KEY} libraries={['places']}>
      <div ref={containerRef} className="relative h-[100dvh] bg-[#f5f5f5] overflow-hidden">

        {/* ── Map layer ─────────────────────────────────────────────────────
            The map container is ALWAYS rendered when API_KEY is present.
            Overlays (loading, timeout) sit on top — we never unmount <Map>
            so a slow tile load can still complete and reveal itself.         */}
        {!!API_KEY && (
          <div
            className="absolute inset-0 z-0"
            style={{ height: mapHeight > 0 ? mapHeight : '100dvh' }}
          >
            {/* Mount Map only after useLayoutEffect gives us a real px height */}
            {mapHeight > 0 && (
              <Map
                defaultCenter={{ lat: 25.7913, lng: -80.145 }}
                defaultZoom={12}
                styles={LIGHT_MAP_STYLES}
                disableDefaultUI
                gestureHandling="greedy"
                backgroundColor="#f5f5f5"
                style={{ width: '100%', height: '100%' }}
                onIdle={handleTilesReady}
                onTilesLoaded={handleTilesReady}
              >
                <MapController shift={selectedShift} />
                {visibleShifts.map((shift) => (
                  <Marker
                    key={shift.id}
                    position={{ lat: shift.lat, lng: shift.lng }}
                    icon={goldPinUrl(selectedId === shift.id)}
                    onClick={() => handlePinClick(shift)}
                  />
                ))}
              </Map>
            )}

            {/* Loading overlay — shown while tiles haven't arrived yet.
                Sits above the map but does NOT unmount it.                  */}
            {!tilesLoaded && !mapFailed && (
              <div
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#f5f5f5]"
                aria-live="polite" aria-label="Map loading"
              >
                <div className="w-8 h-8 rounded-full border-[2.5px] border-[#DBDBDB] border-t-black animate-spin" />
                <p className="text-[#737373] text-[13px] font-medium">Map loading…</p>
              </div>
            )}

            {/* Timeout overlay — shown after 10 s if tiles still haven't fired.
                Map remains mounted underneath and will reveal itself if/when
                onIdle fires (handleTilesReady clears mapFailed).             */}
            {mapFailed && !tilesLoaded && (
              <div
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#FAFAFA]/90"
                aria-live="polite" aria-label="Map slow to load"
              >
                <WifiOff size={28} aria-hidden className="text-[#DBDBDB]" />
                <p className="text-[#737373] text-[14px] font-medium">Map is taking a while…</p>
                <p className="text-[#AAAAAA] text-[12px]">Browse shifts in the list below</p>
              </div>
            )}
          </div>
        )}

        {/* ── No-key fallback — only when VITE_GOOGLE_MAPS_API_KEY is absent ── */}
        {!API_KEY && (
          <div className="absolute inset-0 z-0 flex items-center justify-center bg-[#FAFAFA]">
            <div className="flex flex-col items-center gap-2 text-center px-8">
              <WifiOff size={28} aria-hidden className="text-[#DBDBDB]" />
              <p className="text-[#737373] text-[14px] font-medium">Map unavailable</p>
              <p className="text-[#AAAAAA] text-[12px]">Browse shifts in the list below</p>
            </div>
          </div>
        )}

        {/* ── Search + filter overlay ───────────────────────────────────── */}
        <div className="absolute top-0 left-0 right-0 z-40 pointer-events-none">
          <div className="pointer-events-auto">
            <div className="px-4 pt-5 pb-3 bg-gradient-to-b from-white/95 via-white/80 to-transparent">
              <div className="flex items-center gap-2 bg-white border border-[#DBDBDB] rounded-[10px] px-3.5 h-[46px] shadow-sm">
                <Search size={16} aria-hidden className="text-[#737373] flex-shrink-0" />
                <input
                  type="search"
                  placeholder="Search shifts, job types, locations…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search shifts"
                  className="flex-1 bg-transparent text-black text-[14px] placeholder:text-[#AAAAAA] outline-none font-medium"
                />
                {query && (
                  <button type="button" aria-label="Clear search" onClick={() => setQuery('')}
                    className="text-[#737373] text-[12px]">✕</button>
                )}
                <div className="w-px h-4 bg-[#DBDBDB]" aria-hidden />
                <button type="button" aria-label="Open filters" className="flex-shrink-0">
                  <SlidersHorizontal size={15} aria-hidden className="text-[#737373]" />
                </button>
              </div>
            </div>

            <div
              className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-none"
              role="radiogroup" aria-label="Filter shifts"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {FILTER_PILLS.map((pill) => {
                const active = activeFilter === pill.key;
                return (
                  <button key={pill.key} type="button" role="radio" aria-checked={active}
                    onClick={() => { setActiveFilter(pill.key); setSelectedId(null); }}
                    className={`flex-shrink-0 h-[34px] px-4 rounded-full text-[12px] font-semibold transition-all duration-150 whitespace-nowrap shadow-sm
                      ${active
                        ? 'bg-black text-white border-2 border-black'
                        : 'bg-white text-black border border-[#DBDBDB]'}`}>
                    {pill.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* SR-only shift list for keyboard/screen-reader users */}
        <div className="sr-only" aria-label="Shifts on map">
          {visibleShifts.map((shift) => (
            <button key={shift.id} type="button"
              aria-label={`Select ${shift.jobType} at ${shift.companyName}`}
              onClick={() => handlePinClick(shift)} />
          ))}
        </div>

        <BottomSheet
          shifts={visibleShifts}
          isLoading={isLoading}
          selectedId={selectedId}
          onSelectShift={handleSelectShift}
          appliedShiftIds={appliedShiftIds}
        />

        <BottomTabNav />
      </div>
    </APIProvider>
  );
}
