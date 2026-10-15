/**
 * Worker Home — "what's next" first.
 *
 *   ┌ navy header ─────────────────────────────┐
 *   │ Hi, Maria!                 (bell) (wallet)│
 *   │ Thursday, October 15                      │
 *   │ Today's job / Next job                    │
 *   │ ┌ map + Get directions ┐                  │
 *   │ │ JobCard + clock-in   │                  │
 *   └───────────────────────────────────────────┘
 *   Upcoming jobs   (horizontal cards → Job Board)
 *   For you         (offers, then open shifts near you)
 *
 * Everything else a worker tracks (applied, past, requests) lives on the
 * Job Board (/jobs), one tap away.
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { Bell, Wallet, Navigation, SearchCheck, ChevronRight, Repeat2, Send, Clock3 } from 'lucide-react';
import { BottomTabNav } from '@/components/BottomTabNav';
import { InstallBanner } from '@/components/InstallBanner';
import { AppMap } from '@/components/AppMap';
import { ArrivalPills } from '@/components/ArrivalPills';
import { RatePromptCard } from '@/components/home/RatePromptCard';
import { WorkerRolesNudge } from '@/components/home/WorkerOffers';
import { JobCard, JobCardSkeleton } from '@/components/jobs/JobCard';
import { LoadError } from '@/components/StateView';
import { useMyApplications, groupApplications, type MyApplication } from '@/hooks/useMyApplications';
import { useShiftRequests, isLiveOffer } from '@/hooks/useShiftRequests';
import { useMySwaps } from '@/hooks/useSwaps';
import { useWorkerHomeShifts } from '@/hooks/useWorkerHomeShifts';
import { useApplications } from '@/hooks/useApplications';
import { useNotifications } from '@/hooks/useNotifications';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { isDayOfWindow } from '@/hooks/useArrivalStatus';
import { shiftHeadline } from '@/lib/supabase';
import { untilLabel, directionsUrl } from '@/lib/jobFormat';

/**
 * The signed-in worker's own first name for the greeting: the name their
 * Google/Apple account gave us, else their handle when it reads like a name
 * ("maria.r" → "Maria"). Generated or long handles ("user_8f3a2c",
 * "partyking2024xyz") give null, and the greeting falls back to "Hi there!".
 */
function greetingName(providerFirst: string | undefined, handle: string | null | undefined): string | null {
  const cap = (w: string) => w[0].toUpperCase() + w.slice(1).toLowerCase();
  const given = providerFirst?.trim();
  if (given && /^[\p{L}'-]{1,20}$/u.test(given)) return cap(given);
  const h = (handle ?? '').replace(/^@/, '').trim();
  if (!h || /^user[_-]?[0-9a-f]{4,}$/i.test(h)) return null;
  const word = h.split(/[^A-Za-z]+/).find(Boolean) ?? '';
  return word.length >= 2 && word.length <= 12 ? cap(word) : null;
}

/** Re-render every 30 s so countdowns and the clock-in window stay current. */
function useNow(ms = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="flex items-end justify-between px-4 mb-3">
      <h2 className="text-[#111827] text-[22px] font-bold tracking-tight">{children}</h2>
      {action && (
        <button type="button" onClick={action.onClick} className="h-9 -mr-1 px-1 text-[#0A1628] text-[14px] font-semibold flex items-center gap-0.5">
          {action.label}<ChevronRight size={16} aria-hidden />
        </button>
      )}
    </div>
  );
}

/** The booked shift happening today (or the next one), with map, directions and clock-in. */
function NextJobCard({ app, now }: { app: MyApplication; now: number }) {
  const [, navigate] = useLocation();
  const start = app.startTime ? Date.parse(app.startTime) : NaN;
  const end = app.endTime ? Date.parse(app.endTime) : NaN;
  const opensAt = start - 60 * 60_000; // clock-in opens an hour before
  const canClockIn = Number.isFinite(start) && now >= opensAt && (!Number.isFinite(end) || now <= end);
  const opensIn = Number.isFinite(start) ? untilLabel(opensAt) : null;
  const dayOf = isDayOfWindow(app.startTime, app.endTime, now);
  const hasMap = app.lat != null && app.lng != null;
  const title = app.shiftTitle?.trim() || `${app.jobType ?? 'Event'} shift`;

  return (
    <JobCard
      startISO={app.startTime} endISO={app.endTime} timezone={app.timezone}
      title={title} company={app.companyName} location={app.location} logo={app.clientLogo}
      status="confirmed" onTap={() => navigate(`/shift/${app.shiftId}`)}
      top={hasMap ? (
        <div className="relative h-[160px] bg-[#E5E7EB]">
          <AppMap center={{ lat: app.lat!, lng: app.lng! }} zoom={15} interactive={false}
            markers={[{ id: app.shiftId, lat: app.lat!, lng: app.lng! }]} ariaLabel={`Map of ${title}`} />
          <a href={directionsUrl(app.lat!, app.lng!, app.location ?? title)} target="_blank" rel="noopener noreferrer"
            aria-label="Get directions" className="absolute bottom-0 right-0 z-[2] h-11 pl-4 pr-3 rounded-tl-[16px] bg-white/95 backdrop-blur text-[#0A1628] text-[15px] font-semibold flex items-center gap-2 shadow-sm">
            {/* Shorter on the smallest phones so the map credit stays visible. */}
            <span className="min-[360px]:hidden">Directions</span>
            <span className="hidden min-[360px]:inline">Get directions</span>
            <span className="w-6 h-6 rounded-[7px] bg-[#0A1628] text-white flex items-center justify-center rotate-45">
              <Navigation size={12} aria-hidden className="-rotate-45" />
            </span>
          </a>
        </div>
      ) : undefined}
    >
      <div className="flex flex-col gap-2.5">
        {canClockIn ? (
          <button type="button" onClick={() => navigate(`/clock/${app.shiftId}`)}
            className="h-12 rounded-[12px] bg-[#0A1628] text-white text-[16px] font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
            <Clock3 size={18} aria-hidden /> Clock in
          </button>
        ) : opensIn ? (
          <p className="rounded-[12px] bg-[#EEF2F8] px-4 py-3 text-[#1E3A5F] text-[15px]">
            You'll be able to <span className="font-semibold">clock in</span> in {opensIn}.
          </p>
        ) : null}
        {dayOf && <ArrivalPills applicationId={app.applicationId} status={app.arrivalStatus} statusAt={app.arrivalStatusAt} compact />}
      </div>
    </JobCard>
  );
}

export function WorkerHomeScreen() {
  const [, navigate] = useLocation();
  const now = useNow();
  const { user } = useAuth();
  const profile = useProfile();
  const { unreadCount } = useNotifications();
  const { applications, isLoading, error, refetch } = useMyApplications();
  const { upcoming, applied, standby } = useMemo(() => groupApplications(applications), [applications, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const { requests } = useShiftRequests();
  const { incoming: swapOffers } = useMySwaps();
  const nearby = useWorkerHomeShifts();
  const { appliedShiftIds } = useApplications();

  const next = upcoming[0] ?? null;
  const nextIsToday = !!next?.startTime && (Date.parse(next.startTime) - now < 24 * 3_600_000);
  const later = upcoming.slice(1);
  const offers = requests.filter((r) => r.worker_id === user?.id && isLiveOffer(r));
  // Never suggest a shift the worker already applied to or is booked on.
  const mine = new Set(applications.map((a) => a.shiftId));
  const openNearby = nearby.shifts.filter((s) => !appliedShiftIds.has(s.id) && !mine.has(s.id)).slice(0, 5);
  const waiting = applied.length + standby.length;

  const name = greetingName(user?.firstName, profile.username);
  const today = new Date(now).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-[100dvh] bg-[#F3F4F6] flex flex-col pb-[80px]">
      {/* ── Header + the job that matters most ─────────────────────────── */}
      <header className="bg-gradient-to-b from-[#0A1628] to-[#1E3A5F] text-white px-4 pt-[calc(env(safe-area-inset-top)+18px)] pb-6 rounded-b-[24px]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold leading-tight truncate">{name ? `Hi, ${name}!` : 'Hi there!'}</h1>
            <p className="text-white/75 text-[15px] mt-0.5">{today}</p>
          </div>
          <div className="flex gap-2.5 flex-shrink-0">
            <button type="button" onClick={() => navigate('/notifications')}
              aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
              className="relative w-11 h-11 rounded-full bg-white/12 flex items-center justify-center active:bg-white/20" style={{ background: 'rgba(255,255,255,0.12)' }}>
              <Bell size={20} aria-hidden />
              {unreadCount > 0 && <span aria-hidden className="absolute top-2 right-2.5 w-2.5 h-2.5 rounded-full bg-[#EF4444] border-2 border-[#0A1628]" />}
            </button>
            <button type="button" onClick={() => navigate('/earnings')} aria-label="Earnings"
              className="w-11 h-11 rounded-full flex items-center justify-center active:bg-white/20" style={{ background: 'rgba(255,255,255,0.12)' }}>
              <Wallet size={20} aria-hidden />
            </button>
          </div>
        </div>

        {(isLoading || next || (error && !applications.length)) && (
          <h2 className="mt-6 mb-3 text-[20px] font-bold">{isLoading ? "Today's job" : next ? (nextIsToday ? "Today's job" : 'Next job') : "Today's job"}</h2>
        )}
        {isLoading ? <JobCardSkeleton /> : error && !applications.length ? (
          <div className="bg-white rounded-[16px]"><LoadError what="your jobs" onRetry={() => void refetch()} compact /></div>
        ) : next ? (
          <NextJobCard app={next} now={now} />
        ) : (
          <div className="mt-6 bg-white/10 rounded-[16px] px-4 py-4 flex items-center gap-3">
            <SearchCheck size={22} aria-hidden className="text-white/80 flex-shrink-0" />
            <p className="flex-1 text-[15px] text-white/90">No jobs booked yet. Find one that fits your week.</p>
            <button type="button" onClick={() => navigate('/jobs?tab=open')}
              className="h-10 px-4 rounded-full bg-white text-[#0A1628] text-[14px] font-semibold flex-shrink-0">Find jobs</button>
          </div>
        )}
      </header>

      <div className="pt-3"><InstallBanner compact /></div>
      <WorkerRolesNudge />
      <div className="pt-2"><RatePromptCard role="worker" /></div>

      {/* ── Upcoming jobs ──────────────────────────────────────────────── */}
      {later.length > 0 && (
        <section className="mt-4" aria-label="Upcoming jobs">
          <SectionTitle action={{ label: 'See all', onClick: () => navigate('/jobs?tab=confirmed') }}>Upcoming jobs</SectionTitle>
          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory px-4 pb-1 scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
            {later.slice(0, 8).map((a) => (
              <JobCard key={a.applicationId} className="snap-start flex-shrink-0 w-[86%]"
                startISO={a.startTime} endISO={a.endTime} timezone={a.timezone}
                title={a.shiftTitle?.trim() || `${a.jobType ?? 'Event'} shift`} company={a.companyName}
                location={a.location} logo={a.clientLogo} status="confirmed"
                onTap={() => navigate(`/shift/${a.shiftId}`)} />
            ))}
          </div>
        </section>
      )}

      {waiting > 0 && (
        <button type="button" onClick={() => navigate('/jobs?tab=applied')}
          className="mx-4 mt-4 bg-white border border-[#E5E7EB] rounded-[16px] px-4 py-3.5 flex items-center gap-3 text-left active:bg-[#F9FAFB]">
          <Send size={18} aria-hidden className="text-[#1E3A5F] flex-shrink-0" />
          <span className="flex-1 text-[#111827] text-[15px]">
            Waiting to hear back on <span className="font-semibold">{waiting} application{waiting === 1 ? '' : 's'}</span>
          </span>
          <ChevronRight size={18} aria-hidden className="text-[#9CA3AF]" />
        </button>
      )}

      {/* ── For you: offers first, then open shifts near you ───────────── */}
      <section className="mt-6" aria-label="For you">
        <SectionTitle action={openNearby.length ? { label: 'Browse', onClick: () => navigate('/jobs?tab=open') } : undefined}>For you</SectionTitle>
        <div className="px-4 flex flex-col gap-3">
          {(offers.length > 0 || swapOffers.length > 0) && (
            <button type="button" onClick={() => navigate('/jobs?tab=requests')}
              className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[16px] px-4 py-3.5 flex items-center gap-3 text-left active:bg-[#FEF3C7]">
              {offers.length ? <Send size={18} aria-hidden className="text-[#B45309] flex-shrink-0" /> : <Repeat2 size={18} aria-hidden className="text-[#B45309] flex-shrink-0" />}
              <span className="flex-1 text-[#111827] text-[15px]">
                {offers.length > 0 && <><span className="font-semibold">{offers.length} shift offer{offers.length === 1 ? '' : 's'}</span> waiting for you</>}
                {offers.length > 0 && swapOffers.length > 0 && ' · '}
                {swapOffers.length > 0 && <><span className="font-semibold">{swapOffers.length} swap offer{swapOffers.length === 1 ? '' : 's'}</span></>}
              </span>
              <ChevronRight size={18} aria-hidden className="text-[#B45309]" />
            </button>
          )}

          {nearby.isLoading ? <JobCardSkeleton /> : openNearby.map((s) => (
            <JobCard key={s.id} startISO={s.startTimeISO} endISO={s.endTimeISO} timezone={s.timezone}
              title={shiftHeadline(s)} company={s.companyName} location={s.location}
              aside={<span className="h-7 px-3 rounded-full bg-[#ECFDF5] text-[#047857] text-[13px] font-semibold flex items-center whitespace-nowrap">${s.payRate}/{s.payPeriod}</span>}
              onTap={() => navigate(`/shift/${s.id}`)} />
          ))}

          {!nearby.isLoading && openNearby.length === 0 && offers.length === 0 && swapOffers.length === 0 && (
            <div className="bg-white border border-[#E5E7EB] rounded-[16px] px-6 py-8 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-[#EEF2F8] flex items-center justify-center mb-3">
                <SearchCheck size={24} aria-hidden className="text-[#1E3A5F]" />
              </div>
              <p className="text-[#111827] text-[17px] font-semibold">No new opportunities</p>
              <p className="text-[#6B7280] text-[14px] mt-1 max-w-[260px]">Check back for new requests and open shifts near you.</p>
              <button type="button" onClick={() => navigate('/jobs?tab=open')}
                className="mt-4 h-11 px-5 rounded-[12px] bg-[#0A1628] text-white text-[15px] font-semibold">Browse all shifts</button>
            </div>
          )}
        </div>
      </section>

      <BottomTabNav />
    </div>
  );
}
