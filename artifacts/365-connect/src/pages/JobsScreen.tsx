import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
  Search, MapPin, Plus,
  List as ListIcon, Map as MapIcon, CalendarDays, Clock, DollarSign, Users, CheckCircle2, Zap,
} from 'lucide-react';
import { BottomTabNav } from '@/components/BottomTabNav';
import { LeafletMap } from '@/components/LeafletMap';
import { type MockShift } from '@/lib/supabase';
import { useShifts } from '@/hooks/useShifts';
import { useMyPostedShifts } from '@/hooks/useMyPostedShifts';
import { useApplications } from '@/hooks/useApplications';
import { useProfile } from '@/hooks/useProfile';
import { resetStafferDraft } from '@/store/stafferPostShiftStore';
import { resetDraft } from '@/store/postShiftStore';
import { JOB_TYPES } from '@/lib/jobTypes';
import { EVENT_TYPES } from '@/lib/eventTypes';

const NAVY = '#0A1628';

/* ── Filter logic ────────────────────────────────────────────────────────── */
type FilterKey = 'all' | 'pay30' | 'near3' | 'tonight';

const FILTER_PILLS: { key: FilterKey; label: string }[] = [
  { key: 'all',     label: 'All Jobs'   },
  { key: 'pay30',   label: 'Pay Rate: $30+/hr' },
  { key: 'near3',   label: 'Distance: < 3 mi'  },
  { key: 'tonight', label: 'Date: Tonight'     },
];

function applyFilter(shifts: MockShift[], f: FilterKey): MockShift[] {
  switch (f) {
    case 'pay30':   return shifts.filter((s) => s.payRate >= 30);
    case 'near3':   return shifts.filter((s) => s.distanceMiles < 3);
    case 'tonight': return shifts.filter((s) => s.date === 'Tonight');
    default:        return shifts;
  }
}

/* ── List card — clean Nowsta-style vertical row ─────────────────────────── */
function ShiftRow({ shift, applied, onTap }: {
  shift: MockShift; applied: boolean; onTap: () => void;
}) {
  const spotsLow = shift.spotsAvailable < 3;
  return (
    <div role="article" tabIndex={0} onClick={onTap}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onTap())}
      aria-label={`${shift.jobType} at ${shift.companyName}, $${shift.payRate}/${shift.payPeriod}${applied ? ' — already applied' : ''}`}
      className="rounded-[14px] border border-[#E5E7EB] bg-white px-4 py-4 flex flex-col gap-3 cursor-pointer
        transition-colors active:bg-[#FAFAFA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0A1628]">

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide flex-shrink-0"
            style={{ background: NAVY }}>
            {shift.jobType}
          </span>
          <span className={`text-[11px] font-semibold flex items-center gap-0.5 flex-shrink-0 ${
            spotsLow ? 'text-[#EF4444]' : 'text-[#6B7280]'}`}>
            <Users size={11} aria-hidden />
            {shift.spotsAvailable} left
          </span>
          {shift.instantClaim && (
            <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-0.5 flex-shrink-0">
              <Zap size={9} aria-hidden className="fill-emerald-600 text-emerald-600" /> Claim
            </span>
          )}
        </div>
        {applied && (
          <div aria-label="Already applied" className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={13} aria-hidden className="text-white" strokeWidth={2.5} />
          </div>
        )}
      </div>

      <div>
        <p className="text-[#111827] font-bold text-[16px] leading-tight truncate">{shift.companyName}</p>
        <div className="flex items-center gap-1 mt-1">
          <MapPin size={12} aria-hidden className="text-[#6B7280] flex-shrink-0" />
          <p className="text-[#6B7280] text-[12px] truncate">{shift.location} · {shift.distanceMiles} mi</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-[#F3F4F6]">
        <div className="flex items-center gap-3">
          <span className="text-[#6B7280] text-[12px] flex items-center gap-1">
            <CalendarDays size={12} aria-hidden />{shift.date}
          </span>
          <span className="text-[#6B7280] text-[12px] flex items-center gap-1">
            <Clock size={12} aria-hidden />{shift.startTime}
          </span>
        </div>
        <div className="flex items-baseline gap-0.5">
          <DollarSign size={14} aria-hidden className="text-[#111827] self-center" />
          <span className="text-[#111827] font-bold text-[19px]">{shift.payRate}</span>
          <span className="text-[#6B7280] text-[12px] font-medium">/{shift.payPeriod}</span>
        </div>
      </div>
    </div>
  );
}

function ShiftRowSkeleton() {
  return (
    <div className="rounded-[14px] border border-[#E5E7EB] bg-white px-4 py-4 flex flex-col gap-3">
      <div className="w-24 h-5 rounded-full bg-[#EFEFEF] animate-pulse" />
      <div className="w-40 h-4 rounded bg-[#EFEFEF] animate-pulse" />
      <div className="w-full h-4 rounded bg-[#EFEFEF] animate-pulse" />
    </div>
  );
}

/* ── MapPane — Leaflet map with price pins + a card carousel (Airbnb-style) ── */
function MapPane({ shifts, selectedId, onPinClick, onOpenShift }: {
  shifts: MockShift[];
  selectedId: string | null;
  onPinClick: (s: MockShift) => void;
  onOpenShift: (s: MockShift) => void;
}) {
  const byId = new Map(shifts.map((s) => [s.id, s]));
  const selectedShift = shifts.find((s) => s.id === selectedId) ?? shifts[0] ?? null;
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Keep the carousel in sync with the selected pin.
  useEffect(() => {
    if (!selectedId) return;
    cardRefs.current[selectedId]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selectedId]);

  const center = selectedShift
    ? { lat: selectedShift.lat, lng: selectedShift.lng }
    : { lat: 25.7913, lng: -80.145 };

  return (
    <div className="flex-1 relative bg-[#eef1f4]">
      <LeafletMap
        center={center}
        zoom={12}
        recenter={!!selectedShift}
        ariaLabel="Map of available shifts"
        markers={shifts.map((s) => ({
          id: s.id, lat: s.lat, lng: s.lng,
          selected: s.id === (selectedId ?? selectedShift?.id),
          label: `$${s.payRate}`,
        }))}
        onMarkerClick={(id) => { const s = byId.get(id); if (s) onPinClick(s); }}
      />

      {shifts.length === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#FAFAFA]/80 pointer-events-none">
          <MapPin size={28} aria-hidden className="text-[#DBDBDB]" />
          <p className="text-[#737373] text-[14px] font-medium">No shifts to map</p>
          <p className="text-[#AAAAAA] text-[12px]">Try a different filter</p>
        </div>
      )}

      {/* Card carousel — one card per pin, swipeable, tap to open */}
      {shifts.length > 0 && (
        <div className="absolute left-0 right-0 bottom-4 z-20 flex gap-3 overflow-x-auto snap-x snap-mandatory px-4 pb-1 scrollbar-none"
          style={{ WebkitOverflowScrolling: 'touch' }} aria-label="Shifts on the map">
          {shifts.map((shift) => {
            const active = shift.id === (selectedId ?? selectedShift?.id);
            return (
              <div key={shift.id} ref={(el) => { cardRefs.current[shift.id] = el; }}
                className="snap-center flex-shrink-0 w-[80%] max-w-[320px]">
                <button type="button"
                  onClick={() => { onPinClick(shift); onOpenShift(shift); }}
                  className={`w-full text-left bg-white rounded-[16px] px-4 py-3.5 flex items-center justify-between gap-3 border transition-all ${
                    active ? 'border-[#0A1628] shadow-xl' : 'border-[#E5E7EB] shadow-md'}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                        style={{ background: NAVY }}>{shift.jobType}</span>
                      {shift.instantClaim && (
                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase">Claim</span>
                      )}
                    </div>
                    <p className="text-[#111827] font-bold text-[15px] truncate">{shift.companyName}</p>
                    <p className="text-[#6B7280] text-[11px] truncate flex items-center gap-1">
                      <MapPin size={10} aria-hidden />{shift.location} · {shift.distanceMiles} mi
                    </p>
                    <p className="text-[#9CA3AF] text-[11px] truncate mt-0.5">{shift.date} · {shift.startTime}</p>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0">
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-[#111827] font-bold text-[19px]">${shift.payRate}</span>
                      <span className="text-[#6B7280] text-[11px]">/{shift.payPeriod}</span>
                    </div>
                    <span className="text-[#0A1628] text-[11px] font-semibold mt-1">View →</span>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── View toggle (List / Map) ────────────────────────────────────────────── */
function ViewToggle({ view, onChange }: { view: 'list' | 'map'; onChange: (v: 'list' | 'map') => void }) {
  return (
    <div className="flex bg-[#F3F4F6] rounded-full p-[3px]" role="tablist" aria-label="Choose view">
      <button type="button" role="tab" aria-selected={view === 'list'} aria-label="List view"
        onClick={() => onChange('list')}
        className={`flex items-center gap-1 h-[32px] px-3 rounded-full text-[12px] font-semibold transition-all ${
          view === 'list' ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280]'}`}>
        <ListIcon size={14} aria-hidden /> List
      </button>
      <button type="button" role="tab" aria-selected={view === 'map'} aria-label="Map view"
        onClick={() => onChange('map')}
        className={`flex items-center gap-1 h-[32px] px-3 rounded-full text-[12px] font-semibold transition-all ${
          view === 'map' ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280]'}`}>
        <MapIcon size={14} aria-hidden /> Map
      </button>
    </div>
  );
}

/* ── JobsScreen ──────────────────────────────────────────────────────────── */
export function JobsScreen() {
  const [, navigate]    = useLocation();
  const [query, setQuery]                 = useState('');
  const [activeFilter, setActiveFilter]   = useState<FilterKey>('all');
  const [jobTypeFilter, setJobTypeFilter] = useState<string | null>(null);
  const [eventTypeFilter, setEventTypeFilter] = useState<string | null>(null);
  const [selectedId, setSelectedId]       = useState<string | null>(null);
  const [view, setView]                   = useState<'list' | 'map'>('list');

  // Role-gated FAB: visible only for staffer / client
  const { role } = useProfile();
  const canPost = role === 'staffer' || role === 'client';
  function handlePostShift() {
    if (role === 'staffer') resetStafferDraft();
    else resetDraft();
    navigate('/post-shift/event');
  }

  // Workers browse all open shifts; clients/staffers see only their own posted shifts.
  const openShifts   = useShifts();
  const postedShifts = useMyPostedShifts();
  const isWorkerRole = role === 'worker' || role === null;
  const shifts    = isWorkerRole ? openShifts.shifts    : postedShifts.shifts;
  const isLoading = isWorkerRole ? openShifts.isLoading : postedShifts.isLoading;
  const { appliedShiftIds } = useApplications();

  const textFiltered = shifts.filter((s) =>
    !query || [s.jobType, s.companyName, s.location].some((f) =>
      f.toLowerCase().includes(query.toLowerCase()),
    ),
  );
  const jobTypeFiltered = jobTypeFilter
    ? textFiltered.filter((s) => s.jobTypes.includes(jobTypeFilter))
    : textFiltered;
  const eventTypeFiltered = eventTypeFilter
    ? jobTypeFiltered.filter((s) => s.eventType === eventTypeFilter)
    : jobTypeFiltered;
  const visibleShifts = applyFilter(eventTypeFiltered, activeFilter);

  function handleSelectShift(shift: MockShift) { setSelectedId(shift.id); navigate(`/shift/${shift.id}`); }
  function handlePinClick(shift: MockShift)    { setSelectedId(shift.id); }

  return (
    <div className="h-[100dvh] bg-white flex flex-col overflow-hidden">

      {/* ── Header: search + filters + view toggle ───────────────────────── */}
      <div className="flex-shrink-0 bg-white border-b border-[#EAEAEA]">
        <div className="px-4 pt-4 pb-2 flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-[#F5F5F5] border border-[#E5E7EB] rounded-[12px] px-3.5 h-[44px]">
            <Search size={16} aria-hidden className="text-[#737373] flex-shrink-0" />
            <input
              type="search"
              placeholder="Search shifts"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search shifts"
              className="flex-1 bg-transparent text-black text-[14px] placeholder:text-[#AAAAAA] outline-none font-medium"
            />
            {query && (
              <button type="button" aria-label="Clear search" onClick={() => setQuery('')}
                className="text-[#737373] text-[13px]">✕</button>
            )}
          </div>
          <ViewToggle view={view} onChange={setView} />
        </div>

        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-none"
          role="radiogroup" aria-label="Filter shifts" style={{ WebkitOverflowScrolling: 'touch' }}>
          <select
            value={eventTypeFilter ?? ''}
            onChange={(e) => { setEventTypeFilter(e.target.value || null); setSelectedId(null); }}
            aria-label="Filter by event type"
            className={`flex-shrink-0 h-[34px] px-3 rounded-full text-[12px] font-semibold outline-none whitespace-nowrap
              ${eventTypeFilter ? 'bg-black text-white border-2 border-black' : 'bg-white text-black border border-[#DBDBDB]'}`}>
            <option value="">Event: All</option>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={jobTypeFilter ?? ''}
            onChange={(e) => { setJobTypeFilter(e.target.value || null); setSelectedId(null); }}
            aria-label="Filter by job type"
            className={`flex-shrink-0 h-[34px] px-3 rounded-full text-[12px] font-semibold outline-none whitespace-nowrap
              ${jobTypeFilter ? 'bg-black text-white border-2 border-black' : 'bg-white text-black border border-[#DBDBDB]'}`}>
            <option value="">Job Type: All</option>
            {JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {FILTER_PILLS.map((pill) => {
            const active = activeFilter === pill.key;
            return (
              <button key={pill.key} type="button" role="radio" aria-checked={active}
                onClick={() => { setActiveFilter(pill.key); setSelectedId(null); }}
                className={`flex-shrink-0 h-[34px] px-4 rounded-full text-[12px] font-semibold transition-all duration-150 whitespace-nowrap
                  ${active ? 'bg-black text-white border-2 border-black' : 'bg-white text-black border border-[#DBDBDB]'}`}>
                {pill.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      {view === 'list' ? (
        <main className="flex-1 overflow-y-auto" aria-label="Shift list">
          <div className="px-4 pt-3 pb-[88px] flex flex-col gap-3">
            {isLoading && [1, 2, 3, 4].map((n) => <ShiftRowSkeleton key={n} />)}

            {!isLoading && visibleShifts.map((shift, i) => (
              <motion.div key={shift.id}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.25, ease: 'easeOut' }}>
                <ShiftRow shift={shift} applied={appliedShiftIds.has(shift.id)}
                  onTap={() => handleSelectShift(shift)} />
              </motion.div>
            ))}

            {!isLoading && visibleShifts.length === 0 && (
              <div className="mt-6 rounded-[12px] bg-[#FAFAFA] border border-[#DBDBDB] px-6 py-10 text-center">
                <p className="text-[#737373] text-[14px] font-medium">No shifts match this filter.</p>
                <p className="text-[#AAAAAA] text-[12px] mt-1">Try a different category or clear the search.</p>
              </div>
            )}
          </div>
        </main>
      ) : (
        <MapPane shifts={visibleShifts} selectedId={selectedId}
          onPinClick={handlePinClick} onOpenShift={handleSelectShift} />
      )}

      {/* SR-only shift list for keyboard/screen-reader users */}
      <div className="sr-only" aria-label="Shifts">
        {visibleShifts.map((shift) => (
          <button key={shift.id} type="button"
            aria-label={`Open ${shift.jobType} at ${shift.companyName}`}
            onClick={() => handleSelectShift(shift)} />
        ))}
      </div>

      {/* ── Post-a-Shift FAB — visible only for staffer / client roles ────── */}
      {canPost && (
        <motion.button
          type="button"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28, delay: 0.15 }}
          whileTap={{ scale: 0.93 }}
          onClick={handlePostShift}
          aria-label="Post a shift"
          className="absolute bottom-[80px] right-4 z-50 flex items-center gap-2 h-[44px] px-4 bg-black text-white rounded-full shadow-lg font-bold text-[13px]"
        >
          <Plus size={16} aria-hidden className="flex-shrink-0" />
          Post a Shift
        </motion.button>
      )}

      <BottomTabNav />
    </div>
  );
}
