import { useState } from 'react';
import { useLocation, useSearch, Redirect } from 'wouter';
import {
  Bell, Search, PlusCircle, SlidersHorizontal,
  Briefcase, CalendarDays, Clock3, MapPin,
  Users, ChevronRight, Repeat2,
} from 'lucide-react';
import { BottomTabNav } from '@/components/BottomTabNav';
import { InstallBanner } from '@/components/InstallBanner';
import { ShiftListCardSkeleton } from '@/components/home/ShiftListCard';
import { PeopleCard, PeopleCardSkeleton } from '@/components/home/PeopleCard';
import { usePeopleFeed } from '@/hooks/usePeopleFeed';
import { useClientShiftsDashboard, type ClientShift } from '@/hooks/useClientShiftsDashboard';
import { useProfile } from '@/hooks/useProfile';
import { useNotifications } from '@/hooks/useNotifications';
import { useRole } from '@/contexts/RoleContext';
import { useAuth } from '@/contexts/AuthContext';
import { JOB_TYPES } from '@/lib/jobTypes';
import { resetDraft } from '@/store/postShiftStore';
import { RatePromptCard } from '@/components/home/RatePromptCard';
import { LoadError } from '@/components/StateView';
import { WorkerHomeScreen } from '@/pages/WorkerHomeScreen';

/* ─── Shared header ──────────────────────────────────────────────────────────── */
function FeedHeader({ subtitle, onPost }: { subtitle: string; onPost?: () => void }) {
  const [, navigate] = useLocation();
  const { role } = useProfile();
  const { unreadCount } = useNotifications();
  return (
    <div className="flex items-center justify-between px-4 pt-4 pb-2">
      <div>
        <h1 className="text-black font-bold text-[22px] leading-tight">365 Connect</h1>
        <p className="text-[#6B7280] text-[12px] font-medium mt-[1px]">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2">
        {onPost && (
          <button type="button" aria-label="Post a shift" onClick={onPost}
            className="w-10 h-10 rounded-full bg-[#FAFAFA] border border-[#E5E7EB] flex items-center justify-center">
            <PlusCircle size={16} aria-hidden className="text-black" />
          </button>
        )}
        <button type="button" aria-label={role === 'worker' ? 'Search shifts' : 'Search'} onClick={() => navigate(role === 'worker' ? '/jobs' : '/explore')}
          className="w-10 h-10 rounded-full bg-[#FAFAFA] border border-[#E5E7EB] flex items-center justify-center">
          <Search size={16} aria-hidden className="text-[#6B7280]" />
        </button>
        <button type="button"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          onClick={() => navigate('/notifications')}
          className="w-10 h-10 rounded-full bg-[#FAFAFA] border border-[#E5E7EB] flex items-center justify-center relative">
          <Bell size={16} aria-hidden className="text-[#6B7280]" />
          {unreadCount > 0 && (
            <span aria-hidden className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#EF4444] border-[1.5px] border-white" />
          )}
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
          className={`flex-1 h-10 rounded-[8px] text-[13px] font-semibold transition-all duration-150 ${
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
    // A worker matches a job type if it's their primary OR one of their others.
    if (jobType && p.primaryJobType !== jobType && !(p.job_types ?? []).includes(jobType) && !(p.secondary_job_types ?? []).includes(jobType)) return false;
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
          className="h-10 px-3 rounded-full text-[12px] font-semibold border border-[#E5E7EB] bg-white text-black flex-shrink-0">
          <option value="">All job types</option>
          {JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select aria-label="Filter by rating" value={rating}
          onChange={(e) => setRating(e.target.value as typeof rating)}
          className="h-10 px-3 rounded-full text-[12px] font-semibold border border-[#E5E7EB] bg-white text-black flex-shrink-0">
          {RATING_FILTERS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select aria-label="Filter by distance" value={distance}
          onChange={(e) => setDistance(e.target.value as typeof distance)}
          className="h-10 px-3 rounded-full text-[12px] font-semibold border border-[#E5E7EB] bg-white text-black flex-shrink-0">
          {DISTANCE_FILTERS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <button type="button" role="switch" aria-checked={availableOnly}
          onClick={() => setAvailableOnly((v) => !v)}
          className={`h-10 px-3 rounded-full text-[12px] font-semibold border flex items-center gap-1.5 flex-shrink-0 ${
            availableOnly ? 'bg-black text-white border-black' : 'bg-white text-black border-[#E5E7EB]'
          }`}>
          <SlidersHorizontal size={12} aria-hidden />
          Available today
        </button>
      </div>

      <main className="flex-1 overflow-y-auto" aria-label="Worker feed">
        <div className="pt-4 pb-4 flex flex-col gap-3">
          {isLoading && Array.from({ length: 4 }).map((_, i) => <PeopleCardSkeleton key={i} />)}
          {error && !isLoading && (
            <div className="mx-4 rounded-[12px] bg-[#FAFAFA] border border-[#E5E7EB] px-6 py-10 text-center">
              <p className="text-[#6B7280] text-[14px]">Couldn't load workers right now.</p>
            </div>
          )}
          {!isLoading && !error && filtered.map((person) => (
            <PeopleCard key={person.id} person={person} />
          ))}
          {!isLoading && !error && filtered.length === 0 && (
            <div className="mx-4 rounded-[12px] bg-[#FAFAFA] border border-[#E5E7EB] px-6 py-10 text-center">
              <p className="text-[#6B7280] text-[14px]">No workers found. Try adjusting your filters.</p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

/* ─── Client: My Shifts view ─────────────────────────────────────────────────── */
function ClientShiftCard({
  shift, onTap, onApplicants, showCount, actionLabel = 'View applicants',
}: {
  shift: ClientShift;
  onTap: () => void;
  onApplicants?: () => void;
  showCount?: boolean;
  actionLabel?: string;
}) {
  const dateStr = shift.startTimeISO
    ? new Date(shift.startTimeISO).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: shift.timezone || undefined })
    : null;

  return (
    <div className="mx-4 mb-3 bg-white border border-[#E5E7EB] rounded-[12px] overflow-hidden">
      <button type="button" onClick={onTap} className="w-full text-left px-4 pt-4 pb-3 active:scale-[0.99] transition-transform">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <span className="inline-block bg-[#0A1628] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide mb-1.5">
              {shift.jobType}
            </span>
            {shift.event_id && (
              <span className="inline-block ml-1.5 bg-[#F3F4F6] text-[#0A1628] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#E5E7EB] mb-1.5">
                Event position
              </span>
            )}
            {shift.seriesIndex != null && shift.seriesCount != null && (
              <span className="inline-flex items-center gap-1 ml-1.5 bg-[#F3F4F6] text-[#0A1628] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#E5E7EB] mb-1.5"
                aria-label={`Shift ${shift.seriesIndex} of ${shift.seriesCount} in a recurring series`}>
                <Repeat2 size={10} aria-hidden />{shift.seriesIndex} of {shift.seriesCount}
              </span>
            )}
            <p className="text-[#111827] font-bold text-[17px] leading-snug truncate">
              {shift.title || `${shift.jobType || 'Event Staff'} shift`}
            </p>
            <p className="text-[#6B7280] text-[13px] font-medium leading-snug truncate">
              {[shift.jobType, shift.eventType].filter(Boolean).join(' · ')}
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              {dateStr && (
                <span className="text-[#6B7280] text-[12px] flex items-center gap-1">
                  <CalendarDays size={11} aria-hidden />{dateStr}
                </span>
              )}
              <span className="text-[#6B7280] text-[12px] flex items-center gap-1">
                <Clock3 size={11} aria-hidden />{shift.startTime}
              </span>
              {(shift.payRate ?? 0) > 0 && (
                <span className="text-[#6B7280] text-[12px]">
                  ${shift.payRate}/{shift.payPeriod ?? 'hr'}
                </span>
              )}
            </div>
            {shift.location && (
              <p className="text-[#6B7280] text-[12px] mt-1 flex items-center gap-1 min-w-0">
                <MapPin size={11} aria-hidden className="flex-shrink-0" /><span className="truncate">{shift.location}</span>
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            {/* Fill status at a glance: confirmed / needed */}
            {(() => {
              const total = Math.max(1, Number(shift.spots_available ?? 1) || 1);
              const filled = Math.min(total, Math.max(0, Number(shift.spots_filled ?? 0) || 0));
              const full = filled >= total;
              const none = filled === 0;
              const cls = full
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : none ? 'bg-red-50 border-red-200 text-red-600'
                : 'bg-amber-50 border-amber-200 text-amber-700';
              return (
                <span className={`inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-[11px] font-bold ${cls}`}
                  aria-label={`${filled} of ${total} spots confirmed`}>
                  <Users size={11} aria-hidden />{filled}/{total} confirmed
                </span>
              );
            })()}
            {shift.swapCount > 0 && (
              <span className="inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-[11px] font-bold bg-amber-50 border-amber-200 text-amber-700"
                aria-label={`${shift.swapCount} swap${shift.swapCount === 1 ? '' : 's'} waiting for your approval`}>
                <Repeat2 size={11} aria-hidden />{shift.swapCount} swap{shift.swapCount === 1 ? '' : 's'} to approve
              </span>
            )}
            {showCount && (
              <div className="flex flex-col items-center bg-[#F3F4F6] rounded-[8px] px-2.5 py-1.5 min-w-[44px] text-center">
                <span className="text-[#111827] font-bold text-[16px] leading-tight">{shift.applicantCount}</span>
                <span className="text-[#6B7280] text-[9px] font-semibold uppercase tracking-wide">Applied</span>
              </div>
            )}
          </div>
        </div>
      </button>
      {onApplicants && (
        <div className="border-t border-[#E5E7EB] px-4 py-2.5">
          <button type="button" onClick={onApplicants}
            className="flex items-center gap-1.5 text-[#0A1628] text-[12px] font-semibold">
            <Users size={13} aria-hidden />
            {actionLabel}
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
  label, shifts, dotColor, onTap, onApplicants, showCount, emptyText, actionLabel,
}: {
  label: string;
  shifts: ClientShift[];
  dotColor: string;
  onTap: (s: ClientShift) => void;
  onApplicants?: (s: ClientShift) => void;
  showCount?: boolean;
  emptyText?: string;
  actionLabel?: string;
}) {
  if (shifts.length === 0 && !emptyText) return null;
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 px-4 mb-2">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor }} aria-hidden />
        <p className="text-[#6B7280] text-[11px] font-bold uppercase tracking-[0.16em]">
          {label}
          {shifts.length > 0 && (
            <span className="ml-1.5 text-[#6B7280] font-semibold normal-case tracking-normal">({shifts.length})</span>
          )}
        </p>
      </div>
      {shifts.length > 0
        ? shifts.map((s) => (
          <ClientShiftCard key={s.id} shift={s}
            onTap={() => onTap(s)}
            onApplicants={onApplicants ? () => onApplicants(s) : undefined}
            showCount={showCount}
            actionLabel={actionLabel}
          />
        ))
        : (
          <div className="mx-4 bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-4 text-center">
            <p className="text-[#6B7280] text-[13px]">{emptyText}</p>
          </div>
        )}
    </div>
  );
}

function ClientMyShiftsView() {
  const [, navigate] = useLocation();
  const { shifts, isLoading, error, refetch } = useClientShiftsDashboard();
  const now = Date.now();

  // A shift is "over" once it has ended, whatever its stored status — the
  // server sweeps statuses lazily, so never trust status alone for grouping.
  const isOver = (s: ClientShift) => {
    const ref = s.end_time || s.startTimeISO;
    const t = ref ? Date.parse(ref) : NaN;
    return Number.isFinite(t) && t < now;
  };
  const byStart = (a: ClientShift, b: ClientShift) => Date.parse(a.startTimeISO || '') - Date.parse(b.startTimeISO || '');

  const open      = shifts.filter((s) => s.status === 'open'   && !isOver(s)).sort(byStart);
  const filled    = shifts.filter((s) => s.status === 'filled' && !isOver(s)).sort(byStart);
  const completed = shifts.filter((s) => s.status === 'completed' || (s.status !== 'cancelled' && isOver(s))).sort(byStart).reverse();
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

  if (error && shifts.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto pt-4 pb-4">
        <LoadError what="your shifts" onRetry={() => void refetch()} />
      </div>
    );
  }

  if (shifts.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto pt-4 pb-4">
        <div className="mx-4 rounded-[12px] bg-[#FAFAFA] border border-[#E5E7EB] px-6 py-10 text-center">
          <Briefcase size={28} aria-hidden className="text-[#D1D5DB] mx-auto mb-3" />
          <p className="text-[#6B7280] font-semibold text-[14px]">No shifts posted yet</p>
          <p className="text-[#6B7280] text-[12px] mt-1">Post a shift to start finding workers.</p>
          <button type="button" onClick={() => { resetDraft(); navigate('/post-shift/name'); }}
            className="mt-4 h-[40px] px-5 bg-[#0A1628] text-white rounded-[10px] text-[13px] font-semibold">
            Post a shift
          </button>
        </div>
      </div>
    );
  }

  // What needs the poster today, so Home starts with decisions, not a list.
  const upcoming = [...open, ...filled];
  const waitingApplicants = upcoming.filter((s) => s.applicantCount > 0);
  const applicantTotal = waitingApplicants.reduce((n, s) => n + s.applicantCount, 0);
  const swaps = upcoming.filter((s) => s.swapCount > 0);
  const soonUnfilled = open.filter((s) => {
    const t = Date.parse(s.startTimeISO || '');
    return Number.isFinite(t) && t - now < 48 * 3_600_000 && (s.spots_filled ?? 0) < (s.spots_available ?? 0);
  });
  const attention: { key: string; text: string; go: () => void }[] = [];
  if (applicantTotal > 0) attention.push({
    key: 'apps',
    text: `${applicantTotal} applicant${applicantTotal === 1 ? '' : 's'} waiting${waitingApplicants.length > 1 ? ` across ${waitingApplicants.length} shifts` : ''}`,
    go: () => navigate(`/shift/${waitingApplicants[0].id}/applicants`),
  });
  if (swaps.length) attention.push({
    key: 'swaps',
    text: `${swaps.length} swap request${swaps.length === 1 ? '' : 's'} to approve`,
    go: () => navigate(`/shift/${swaps[0].id}/applicants`),
  });
  for (const s of soonUnfilled.slice(0, 2)) {
    const left = (s.spots_available ?? 0) - (s.spots_filled ?? 0);
    attention.push({ key: `fill-${s.id}`, text: `${s.title?.trim() || `${s.jobType ?? 'Event'} shift`} starts soon with ${left} spot${left === 1 ? '' : 's'} open`, go: () => navigate(`/shift/${s.id}/applicants`) });
  }

  return (
    <div className="flex-1 overflow-y-auto pt-4 pb-4">
      <RatePromptCard role="poster" />
      {attention.length > 0 && (
        <section aria-label="Needs attention" className="mx-4 mb-5 rounded-[12px] border border-[#FDE68A] bg-[#FFFBEB] overflow-hidden">
          <p className="px-4 pt-3 pb-1 text-[#92400E] text-[13px] font-semibold">Needs attention</p>
          {attention.map((a) => (
            <button key={a.key} type="button" onClick={a.go}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-left border-t border-[#FDE68A] first-of-type:border-t-0 active:bg-[#FEF3C7]">
              <span className="flex-1 min-w-0 text-[#111827] text-[14px] font-medium leading-snug">{a.text}</span>
              <ChevronRight size={16} aria-hidden className="text-[#B45309] flex-shrink-0" />
            </button>
          ))}
        </section>
      )}
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
        actionLabel="Crew"
      />
      <ClientShiftGroup
        label="Completed" shifts={completed} dotColor="#6B7280"
        onTap={(s) => navigate(`/shift/${s.id}`)}
        // Hours are approved and workers paid from the crew page.
        onApplicants={(s) => navigate(`/shift/${s.id}/applicants`)}
        actionLabel="Hours & pay"
      />
      <ClientShiftGroup
        label="Cancelled" shifts={cancelled} dotColor="#EF4444"
        onTap={(s) => navigate(`/shift/${s.id}`)}
      />
    </div>
  );
}

/** Read the initial home tab from ?tab= (used after posting a shift). */
function useInitialPosterTab(): 'browse' | 'my-shifts' {
  const search = useSearch();
  // Posters open on their own shifts; ?tab=browse jumps to finding workers.
  return new URLSearchParams(search).get('tab') === 'browse' ? 'browse' : 'my-shifts';
}

/* ─── (B) Client Home Feed ───────────────────────────────────────────────────── */
function ClientHomeFeed() {
  const [tab, setTab] = useState<'browse' | 'my-shifts'>(useInitialPosterTab());
  return (
    <div className="min-h-[100dvh] bg-white flex flex-col pb-[64px]">
      <div className="bg-white sticky top-0 z-40 border-b border-[#E5E7EB]">
        <FeedHeader subtitle={tab === 'browse' ? 'Find workers for your shifts' : 'Your shifts'} />
        <SegmentControl
          tabs={[
            { value: 'my-shifts', label: 'My shifts' },
            { value: 'browse', label: 'Find workers' },
          ]}
          value={tab}
          onChange={(v) => setTab(v as 'browse' | 'my-shifts')}
        />
      </div>
      <div className="pt-3"><InstallBanner compact /></div>
      {tab === 'browse' ? <WorkerDiscoveryBody /> : <ClientMyShiftsView />}
      <BottomTabNav />
    </div>
  );
}

/* ─── (C) Staffer Home Feed ──────────────────────────────────────────────────── */
function StafferHomeFeed() {
  // Posting lives on the tab bar's "Post Shift"; no second header or floating button.
  const [tab, setTab] = useState<'browse' | 'my-shifts'>(useInitialPosterTab());

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col pb-[64px]">
      <div className="bg-white sticky top-0 z-40 border-b border-[#E5E7EB]">
        <FeedHeader subtitle={tab === 'browse' ? 'Find workers for your shifts' : 'Your shifts'} />
        <SegmentControl
          tabs={[
            { value: 'my-shifts', label: 'My shifts' },
            { value: 'browse', label: 'Find workers' },
          ]}
          value={tab}
          onChange={(v) => setTab(v as 'browse' | 'my-shifts')}
        />
      </div>
      <div className="pt-3"><InstallBanner compact /></div>
      {tab === 'browse' ? <WorkerDiscoveryBody /> : <ClientMyShiftsView />}


      <BottomTabNav />
    </div>
  );
}

/* ─── (A) Worker Home ─────────────────────────────────────────────────────────
   Worker lists (offers, applications, open shifts) live on the Job Board now;
   old /home?tab=… links land on the matching Job Board tab. */
function WorkerHomeRoute() {
  const tab = new URLSearchParams(useSearch()).get('tab');
  if (tab === 'requests') return <Redirect to="/jobs?tab=requests" replace />;
  if (tab === 'available') return <Redirect to="/jobs?tab=open" replace />;
  if (tab === 'schedule') return <Redirect to="/jobs?tab=confirmed" replace />;
  return <WorkerHomeScreen />;
}

/* ─── HomeScreen — role router ────────────────────────────────────────────────── */
export function HomeScreen() {
  const { role, roleLoading, roleError, refetchRole } = useRole();
  const { user, loading: authLoading } = useAuth();

  if (roleLoading || authLoading) {
    return (
      <div className="min-h-[100dvh] bg-white flex flex-col pb-[64px]">
        <div className="pt-4 flex flex-col gap-4">
          {[1, 2, 3].map((n) => <ShiftListCardSkeleton key={n} />)}
        </div>
        <BottomTabNav />
      </div>
    );
  }

  // Signed out → splash (which routes to login); signed in with no role yet
  // (onboarding never finished) → pick one. A failed profile read is not "no
  // role": it gets a retry card, never a bounce to role select (where a tap
  // would try to rewrite the account) and never a guessed feed.
  if (!user) return <Redirect to="/" />;
  if (!role && roleError) {
    return (
      <div className="min-h-[100dvh] bg-white flex flex-col items-center justify-center px-8 pb-[64px] gap-3 text-center">
        <p className="text-[#111827] font-bold text-[17px]">Couldn't load your account</p>
        <p className="text-[#6B7280] text-[14px] leading-relaxed max-w-[280px]">Check your connection and try again.</p>
        <button type="button" onClick={() => { void refetchRole(); }}
          className="mt-2 h-[48px] w-full max-w-[280px] rounded-[12px] bg-[#0A1628] text-white text-[15px] font-bold"
          data-testid="btn-home-retry">
          Try again
        </button>
        <BottomTabNav />
      </div>
    );
  }
  if (!role) return <Redirect to="/role-select" />;

  if (role === 'worker') return <WorkerHomeRoute />;
  if (role === 'staffer') return <StafferHomeFeed />;
  return <ClientHomeFeed />;
}
