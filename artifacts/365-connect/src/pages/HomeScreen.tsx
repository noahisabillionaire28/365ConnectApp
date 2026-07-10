import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
  Bell, Search, PlusCircle, SlidersHorizontal,
  Briefcase, CalendarDays, Clock3, DollarSign, MapPin,
  Users, ChevronRight,
} from 'lucide-react';
import { BottomTabNav } from '@/components/BottomTabNav';
import { ShiftListCard, ShiftListCardSkeleton } from '@/components/home/ShiftListCard';
import { PeopleCard, PeopleCardSkeleton } from '@/components/home/PeopleCard';
import { useWorkerHomeShifts } from '@/hooks/useWorkerHomeShifts';
import { usePeopleFeed } from '@/hooks/usePeopleFeed';
import { useApplications } from '@/hooks/useApplications';
import { useMyApplications, type MyApplication } from '@/hooks/useMyApplications';
import { useClientShiftsDashboard, type ClientShift } from '@/hooks/useClientShiftsDashboard';
import { useRole } from '@/contexts/RoleContext';
import { JOB_TYPES } from '@/lib/jobTypes';
import { resetStafferDraft } from '@/store/stafferPostShiftStore';

/* ─── Shared header ──────────────────────────────────────────────────────────── */
function FeedHeader({ subtitle, onPost }: { subtitle: string; onPost?: () => void }) {
  const [, navigate] = useLocation();
  return (
    <div className="flex items-center justify-between px-4 pt-4 pb-2">
      <div>
        <h1 className="text-black font-bold text-[22px] leading-tight">365 Connect</h1>
        <p className="text-[#737373] text-[12px] font-medium mt-[1px]">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2">
        {onPost && (
          <button type="button" aria-label="Post a shift" onClick={onPost}
            className="w-9 h-9 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center">
            <PlusCircle size={16} aria-hidden className="text-black" />
          </button>
        )}
        <button type="button" aria-label="Search" onClick={() => navigate('/explore')}
          className="w-9 h-9 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center">
          <Search size={16} aria-hidden className="text-[#737373]" />
        </button>
        <button type="button" aria-label="Notifications" onClick={() => navigate('/notifications')}
          className="w-9 h-9 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center relative">
          <Bell size={16} aria-hidden className="text-[#737373]" />
          <span aria-hidden className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#0095F6] border-[1.5px] border-white" />
        </button>
      </div>
    </div>
  );
}

/* ─── Segment control ────────────────────────────────────────────────────────── */
function SegmentControl({
  tabs, value, onChange,
}: {
  tabs: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex mx-4 mb-3 bg-[#F3F4F6] rounded-[10px] p-[3px]" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={value === tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={`flex-1 h-[34px] rounded-[8px] text-[13px] font-semibold transition-all duration-150 ${
            value === tab.value
              ? 'bg-white text-[#111827] shadow-sm'
              : 'text-[#6B7280]'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Worker: My Shifts view ─────────────────────────────────────────────────── */
function groupApplications(apps: MyApplication[]) {
  const now = new Date();
  return {
    upcoming: apps.filter(
      (a) => a.status === 'accepted' && a.startTime && new Date(a.startTime) > now,
    ),
    applied: apps.filter((a) => a.status === 'pending'),
    completed: apps.filter(
      (a) => a.status === 'accepted' && (!a.startTime || new Date(a.startTime) <= now),
    ),
    notSelected: apps.filter(
      (a) => a.status === 'declined' || a.status === 'rejected' || a.status === 'withdrawn',
    ),
  };
}

function MyShiftRow({ app, onTap }: { app: MyApplication; onTap: () => void }) {
  const dateStr = app.startTime
    ? new Date(app.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : null;

  return (
    <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={onTap}
      className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-[#E5E7EB] text-left last:border-none">
      <div className="w-10 h-10 rounded-[10px] bg-[#F3F4F6] flex items-center justify-center flex-shrink-0">
        <Briefcase size={16} aria-hidden className="text-[#6B7280]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[#111827] font-semibold text-[14px] truncate">{app.shiftTitle}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {app.companyName && (
            <span className="text-[#6B7280] text-[12px] truncate">{app.companyName}</span>
          )}
          {dateStr && (
            <span className="text-[#6B7280] text-[12px] flex items-center gap-0.5 flex-shrink-0">
              <CalendarDays size={10} aria-hidden />
              {dateStr}
            </span>
          )}
          {app.payRate != null && (
            <span className="text-[#6B7280] text-[12px] flex-shrink-0">
              ${app.payRate}/{app.payPeriod}
            </span>
          )}
        </div>
      </div>
      <ChevronRight size={15} aria-hidden className="text-[#D1D5DB] flex-shrink-0" />
    </motion.button>
  );
}

function MyShiftSection({
  label, items, onTap, dotColor, emptyText,
}: {
  label: string;
  items: MyApplication[];
  onTap: (a: MyApplication) => void;
  dotColor: string;
  emptyText?: string;
}) {
  if (items.length === 0 && !emptyText) return null;
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 px-4 mb-2">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor }} aria-hidden />
        <p className="text-[#6B7280] text-[11px] font-bold uppercase tracking-[0.16em]">
          {label}
          {items.length > 0 && (
            <span className="ml-1.5 text-[#9CA3AF] font-semibold normal-case tracking-normal">({items.length})</span>
          )}
        </p>
      </div>
      <div className="mx-4 bg-white border border-[#E5E7EB] rounded-[12px] overflow-hidden">
        {items.length > 0
          ? items.map((a) => <MyShiftRow key={a.applicationId} app={a} onTap={() => onTap(a)} />)
          : (
            <p className="px-4 py-4 text-center text-[#9CA3AF] text-[13px]">{emptyText}</p>
          )}
      </div>
    </div>
  );
}

function WorkerMyShiftsView() {
  const [, navigate] = useLocation();
  const { applications, isLoading, error } = useMyApplications();
  const { upcoming, applied, completed, notSelected } = groupApplications(applications);
  const goToShift = (a: MyApplication) => navigate(`/shift/${a.shiftId}`);

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto pt-4 pb-4" aria-busy="true">
        {[1, 2, 3].map((n) => (
          <div key={n} className="mx-4 mb-4 bg-white border border-[#E5E7EB] rounded-[12px] overflow-hidden">
            {[1, 2].map((r) => (
              <div key={r} className="flex items-center gap-3 px-4 py-3.5 border-b border-[#E5E7EB] last:border-none">
                <div className="w-10 h-10 rounded-[10px] bg-[#F3F4F6] animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="w-2/3 h-3.5 rounded bg-[#F3F4F6] animate-pulse" />
                  <div className="w-1/3 h-3 rounded bg-[#F3F4F6] animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 overflow-y-auto pt-4 pb-4">
        <div className="mx-4 rounded-[12px] bg-[#FAFAFA] border border-[#E5E7EB] px-6 py-8 text-center">
          <p className="text-[#6B7280] text-[14px]">Couldn't load your shifts right now.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto pt-4 pb-4">
      <MyShiftSection label="Upcoming"     items={upcoming}     onTap={goToShift} dotColor="#10B981" emptyText="No confirmed upcoming shifts." />
      <MyShiftSection label="Applied"      items={applied}      onTap={goToShift} dotColor="#F59E0B" emptyText="No pending applications. Browse Jobs to apply." />
      <MyShiftSection label="Completed"    items={completed}    onTap={goToShift} dotColor="#6B7280" />
      <MyShiftSection label="Not Selected" items={notSelected}  onTap={goToShift} dotColor="#D1D5DB" />
    </div>
  );
}

/* ─── (A) Worker Home Feed ───────────────────────────────────────────────────── */
function WorkerHomeFeed() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<'discover' | 'my-shifts'>('discover');
  const { shifts, isLoading, error } = useWorkerHomeShifts();
  const { appliedShiftIds } = useApplications();

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col pb-[64px]">
      <div className="bg-white sticky top-0 z-40 border-b border-[#DBDBDB]">
        <FeedHeader subtitle={tab === 'discover' ? 'Shifts near you' : 'My applications'} />
        <SegmentControl
          tabs={[
            { value: 'discover', label: 'Discover Shifts' },
            { value: 'my-shifts', label: 'My Shifts' },
          ]}
          value={tab}
          onChange={(v) => setTab(v as 'discover' | 'my-shifts')}
        />
      </div>

      {tab === 'discover' ? (
        <main className="flex-1 overflow-y-auto" aria-label="Shift feed">
          <div className="pt-4 pb-4">
            {isLoading && (
              <div className="flex flex-col gap-4" aria-busy="true">
                {[1, 2, 3].map((n) => <ShiftListCardSkeleton key={n} />)}
              </div>
            )}
            {error && !isLoading && (
              <div className="mx-4 rounded-[12px] bg-[#FAFAFA] border border-[#DBDBDB] px-6 py-10 text-center">
                <p className="text-[#737373] text-[14px]">Couldn't load shifts right now.</p>
              </div>
            )}
            {!isLoading && !error && (
              <div className="flex flex-col gap-4" role="feed" aria-label="Available shifts near you">
                {shifts.map((shift, i) => (
                  <motion.div key={shift.id}
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.3, ease: 'easeOut' }}>
                    <ShiftListCard shift={shift} applied={appliedShiftIds.has(shift.id)}
                      onTap={() => navigate(`/shift/${shift.id}`)} />
                  </motion.div>
                ))}
                {shifts.length === 0 && (
                  <div className="mx-4 rounded-[12px] bg-[#FAFAFA] border border-[#DBDBDB] px-6 py-10 text-center">
                    <p className="text-[#737373] text-[14px]">No shifts near you right now. Check back soon.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      ) : (
        <WorkerMyShiftsView />
      )}

      <BottomTabNav />
    </div>
  );
}

/* ─── Shared worker discovery body ──────────────────────────────────────────── */
const RATING_FILTERS   = ['Any rating', '4.0+', '4.5+'] as const;
const DISTANCE_FILTERS = ['Any distance', '< 5 mi', '< 15 mi', '< 25 mi'] as const;

function WorkerDiscoveryBody() {
  const { people, isLoading, error } = usePeopleFeed();
  const [jobType,       setJobType]       = useState<string | null>(null);
  const [rating,        setRating]        = useState<(typeof RATING_FILTERS)[number]>('Any rating');
  const [distance,      setDistance]      = useState<(typeof DISTANCE_FILTERS)[number]>('Any distance');
  const [availableOnly, setAvailableOnly] = useState(false);

  const minRating    = rating   === '4.5+' ? 4.5 : rating   === '4.0+' ? 4.0 : 0;
  const maxDistance  = distance === '< 5 mi' ? 5 : distance === '< 15 mi' ? 15 : distance === '< 25 mi' ? 25 : Infinity;

  const filtered = people.filter((p) => {
    if (jobType && p.primaryJobType !== jobType) return false;
    if (p.rating < minRating)        return false;
    if (p.distanceMiles > maxDistance) return false;
    if (availableOnly && !p.availableToday) return false;
    return true;
  });

  return (
    <>
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-none" role="group" aria-label="Filters"
        style={{ WebkitOverflowScrolling: 'touch' }}>
        <select aria-label="Filter by job type" value={jobType ?? ''}
          onChange={(e) => setJobType(e.target.value || null)}
          className="h-[32px] px-3 rounded-full text-[12px] font-semibold border border-[#DBDBDB] bg-white text-black flex-shrink-0">
          <option value="">All job types</option>
          {JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select aria-label="Filter by rating" value={rating}
          onChange={(e) => setRating(e.target.value as typeof rating)}
          className="h-[32px] px-3 rounded-full text-[12px] font-semibold border border-[#DBDBDB] bg-white text-black flex-shrink-0">
          {RATING_FILTERS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select aria-label="Filter by distance" value={distance}
          onChange={(e) => setDistance(e.target.value as typeof distance)}
          className="h-[32px] px-3 rounded-full text-[12px] font-semibold border border-[#DBDBDB] bg-white text-black flex-shrink-0">
          {DISTANCE_FILTERS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <button type="button" role="switch" aria-checked={availableOnly}
          onClick={() => setAvailableOnly((v) => !v)}
          className={`h-[32px] px-3 rounded-full text-[12px] font-semibold border flex items-center gap-1.5 flex-shrink-0 ${
            availableOnly ? 'bg-black text-white border-black' : 'bg-white text-black border-[#DBDBDB]'
          }`}>
          <SlidersHorizontal size={12} aria-hidden />
          Available today
        </button>
      </div>

      <main className="flex-1 overflow-y-auto" aria-label="Worker feed">
        <div className="pt-4 pb-4 flex flex-col gap-3">
          {isLoading && Array.from({ length: 4 }).map((_, i) => <PeopleCardSkeleton key={i} />)}
          {error && !isLoading && (
            <div className="mx-4 rounded-[12px] bg-[#FAFAFA] border border-[#DBDBDB] px-6 py-10 text-center">
              <p className="text-[#737373] text-[14px]">Couldn't load workers right now.</p>
            </div>
          )}
          {!isLoading && !error && filtered.map((person) => (
            <PeopleCard key={person.id} person={person} />
          ))}
          {!isLoading && !error && filtered.length === 0 && (
            <div className="mx-4 rounded-[12px] bg-[#FAFAFA] border border-[#DBDBDB] px-6 py-10 text-center">
              <p className="text-[#737373] text-[14px]">No workers found. Try adjusting your filters.</p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

/* ─── Client: My Shifts view ─────────────────────────────────────────────────── */
function ClientShiftCard({
  shift, onTap, onApplicants, showCount,
}: {
  shift: ClientShift;
  onTap: () => void;
  onApplicants?: () => void;
  showCount?: boolean;
}) {
  const dateStr = shift.startTimeISO
    ? new Date(shift.startTimeISO).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : shift.date;

  return (
    <div className="mx-4 mb-3 bg-white border border-[#E5E7EB] rounded-[12px] overflow-hidden">
      <motion.button type="button" whileTap={{ scale: 0.99 }} onClick={onTap} className="w-full text-left px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <span className="inline-block bg-[#0A1628] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide mb-1.5">
              {shift.jobType}
            </span>
            <p className="text-[#111827] font-bold text-[15px] leading-snug">{shift.companyName}</p>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              {dateStr && (
                <span className="text-[#6B7280] text-[12px] flex items-center gap-1">
                  <CalendarDays size={11} aria-hidden />{dateStr}
                </span>
              )}
              <span className="text-[#6B7280] text-[12px] flex items-center gap-1">
                <Clock3 size={11} aria-hidden />{shift.startTime}
              </span>
              {shift.payRate > 0 && (
                <span className="text-[#6B7280] text-[12px] flex items-center gap-1">
                  <DollarSign size={11} aria-hidden />{shift.payRate}/{shift.payPeriod}
                </span>
              )}
            </div>
            {shift.location && (
              <p className="text-[#9CA3AF] text-[12px] mt-1 flex items-center gap-1 truncate">
                <MapPin size={11} aria-hidden />{shift.location}
              </p>
            )}
          </div>
          {showCount && (
            <div className="flex flex-col items-center bg-[#F3F4F6] rounded-[8px] px-2.5 py-1.5 flex-shrink-0 min-w-[44px] text-center">
              <span className="text-[#111827] font-bold text-[16px] leading-tight">{shift.applicantCount}</span>
              <span className="text-[#6B7280] text-[9px] font-semibold uppercase tracking-wide">Applied</span>
            </div>
          )}
        </div>
      </motion.button>
      {onApplicants && (
        <div className="border-t border-[#E5E7EB] px-4 py-2.5">
          <button type="button" onClick={onApplicants}
            className="flex items-center gap-1.5 text-[#0A1628] text-[12px] font-semibold">
            <Users size={13} aria-hidden />
            View Applicants
            {shift.applicantCount > 0 && (
              <span className="bg-[#0A1628] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-0.5">
                {shift.applicantCount}
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function ClientShiftGroup({
  label, shifts, dotColor, onTap, onApplicants, showCount, emptyText,
}: {
  label: string;
  shifts: ClientShift[];
  dotColor: string;
  onTap: (s: ClientShift) => void;
  onApplicants?: (s: ClientShift) => void;
  showCount?: boolean;
  emptyText?: string;
}) {
  if (shifts.length === 0 && !emptyText) return null;
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 px-4 mb-2">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor }} aria-hidden />
        <p className="text-[#6B7280] text-[11px] font-bold uppercase tracking-[0.16em]">
          {label}
          {shifts.length > 0 && (
            <span className="ml-1.5 text-[#9CA3AF] font-semibold normal-case tracking-normal">({shifts.length})</span>
          )}
        </p>
      </div>
      {shifts.length > 0
        ? shifts.map((s) => (
          <ClientShiftCard key={s.id} shift={s}
            onTap={() => onTap(s)}
            onApplicants={onApplicants ? () => onApplicants(s) : undefined}
            showCount={showCount}
          />
        ))
        : (
          <div className="mx-4 bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-4 text-center">
            <p className="text-[#9CA3AF] text-[13px]">{emptyText}</p>
          </div>
        )}
    </div>
  );
}

function ClientMyShiftsView() {
  const [, navigate] = useLocation();
  const { shifts, isLoading, error } = useClientShiftsDashboard();
  const now = new Date();

  const open      = shifts.filter((s) => s.status === 'open');
  const filled    = shifts.filter((s) => s.status === 'filled');
  const completed = shifts.filter(
    (s) => s.status === 'completed' ||
      (s.status !== 'cancelled' && s.status !== 'open' && s.status !== 'filled' &&
       s.startTimeISO && new Date(s.startTimeISO) < now),
  );
  const cancelled = shifts.filter((s) => s.status === 'cancelled');

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto pt-4 pb-4" aria-busy="true">
        {[1, 2].map((n) => (
          <div key={n} className="mx-4 mb-3 bg-white border border-[#E5E7EB] rounded-[12px] p-4 space-y-2">
            <div className="w-16 h-3 rounded bg-[#F3F4F6] animate-pulse" />
            <div className="w-2/3 h-5 rounded bg-[#F3F4F6] animate-pulse" />
            <div className="w-1/2 h-3 rounded bg-[#F3F4F6] animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 overflow-y-auto pt-4 pb-4">
        <div className="mx-4 rounded-[12px] bg-[#FAFAFA] border border-[#E5E7EB] px-6 py-8 text-center">
          <p className="text-[#6B7280] text-[14px]">Couldn't load your shifts right now.</p>
        </div>
      </div>
    );
  }

  if (shifts.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto pt-4 pb-4">
        <div className="mx-4 rounded-[12px] bg-[#FAFAFA] border border-[#E5E7EB] px-6 py-10 text-center">
          <Briefcase size={28} aria-hidden className="text-[#D1D5DB] mx-auto mb-3" />
          <p className="text-[#6B7280] font-semibold text-[14px]">No shifts posted yet</p>
          <p className="text-[#9CA3AF] text-[12px] mt-1">Post a shift to start finding workers.</p>
          <button type="button" onClick={() => navigate('/post-shift/step1')}
            className="mt-4 h-[40px] px-5 bg-[#0A1628] text-white rounded-[10px] text-[13px] font-semibold">
            Post a Shift
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto pt-4 pb-4">
      <ClientShiftGroup
        label="Open" shifts={open} dotColor="#10B981"
        onTap={(s) => navigate(`/shift/${s.id}`)}
        onApplicants={(s) => navigate(`/shift/${s.id}/applicants`)}
        showCount
        emptyText="No open shifts."
      />
      <ClientShiftGroup
        label="Confirmed" shifts={filled} dotColor="#0A1628"
        onTap={(s) => navigate(`/shift/${s.id}`)}
        onApplicants={(s) => navigate(`/shift/${s.id}/applicants`)}
      />
      <ClientShiftGroup
        label="Completed" shifts={completed} dotColor="#6B7280"
        onTap={(s) => navigate(`/shift/${s.id}`)}
      />
      <ClientShiftGroup
        label="Cancelled" shifts={cancelled} dotColor="#EF4444"
        onTap={(s) => navigate(`/shift/${s.id}`)}
      />
    </div>
  );
}

/* ─── (B) Client Home Feed ───────────────────────────────────────────────────── */
function ClientHomeFeed() {
  const [tab, setTab] = useState<'browse' | 'my-shifts'>('browse');
  return (
    <div className="min-h-[100dvh] bg-white flex flex-col pb-[64px]">
      <div className="bg-white sticky top-0 z-40 border-b border-[#DBDBDB]">
        <FeedHeader subtitle={tab === 'browse' ? 'Discover workers' : 'Your posted shifts'} />
        <SegmentControl
          tabs={[
            { value: 'browse', label: 'Browse Workers' },
            { value: 'my-shifts', label: 'My Shifts' },
          ]}
          value={tab}
          onChange={(v) => setTab(v as 'browse' | 'my-shifts')}
        />
      </div>
      {tab === 'browse' ? <WorkerDiscoveryBody /> : <ClientMyShiftsView />}
      <BottomTabNav />
    </div>
  );
}

/* ─── (C) Staffer Home Feed ──────────────────────────────────────────────────── */
function StafferHomeFeed() {
  const [, navigate] = useLocation();

  function handlePostShift() {
    resetStafferDraft();
    navigate('/staffer-shift/step1');
  }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col pb-[64px]">
      <div className="bg-white sticky top-0 z-40 border-b border-[#DBDBDB]">
        <FeedHeader subtitle="Discover workers" onPost={handlePostShift} />
      </div>
      <WorkerDiscoveryBody />

      <motion.button
        type="button"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28, delay: 0.15 }}
        whileTap={{ scale: 0.93 }}
        onClick={handlePostShift}
        aria-label="Post a shift"
        className="fixed bottom-[80px] right-4 z-50 flex items-center gap-2 h-[44px] px-4 bg-[#0A1628] text-white rounded-full shadow-lg font-bold text-[13px]"
      >
        <PlusCircle size={16} aria-hidden className="flex-shrink-0" />
        Post a Shift
      </motion.button>

      <BottomTabNav />
    </div>
  );
}

/* ─── HomeScreen — role router ────────────────────────────────────────────────── */
export function HomeScreen() {
  const { role, roleLoading } = useRole();

  if (roleLoading) {
    return (
      <div className="min-h-[100dvh] bg-white flex flex-col pb-[64px]">
        <div className="pt-4 flex flex-col gap-4">
          {[1, 2, 3].map((n) => <ShiftListCardSkeleton key={n} />)}
        </div>
        <BottomTabNav />
      </div>
    );
  }

  if (role === 'worker') return <WorkerHomeFeed />;
  if (role === 'staffer') return <StafferHomeFeed />;
  return <ClientHomeFeed />;
}
