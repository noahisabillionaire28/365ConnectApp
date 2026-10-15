/**
 * One card for a job everywhere a worker sees one (Home, Job Board):
 *
 *   Oct 15 • Today                         [Confirmed ✓]
 *   Server / Bartender
 *   10:30a – 6:00p PDT
 *   (logo) BH Audemars Piguet • Beverly Hills, Wilshire Blvd
 *
 * The status badge says where the worker stands; `aside` replaces it (e.g.
 * pay on an open shift). `children` render under the card body (countdown,
 * clock-in, accept/decline).
 */
import { Check } from 'lucide-react';
import { dayParts, timeRange, shortPlace, initials } from '@/lib/jobFormat';

export type JobStatus =
  | 'confirmed' | 'requested' | 'applied' | 'standby'
  | 'completed' | 'cancelled' | 'expired' | 'not-selected' | 'swapped' | 'dropped';

const BADGE: Record<JobStatus, { label: string; cls: string; check?: boolean }> = {
  confirmed:      { label: 'Confirmed',    cls: 'bg-[#0A1628] text-white', check: true },
  requested:      { label: 'Requested',    cls: 'bg-[#FEF3C7] text-[#92400E]' },
  applied:        { label: 'Applied',      cls: 'bg-[#EEF2F8] text-[#1E3A5F]' },
  standby:        { label: 'Standby',      cls: 'bg-[#EDE9FE] text-[#5B21B6]' },
  completed:      { label: 'Completed',    cls: 'bg-[#ECFDF5] text-[#047857]', check: true },
  cancelled:      { label: 'Cancelled',    cls: 'bg-[#FEF2F2] text-[#B91C1C]' },
  expired:        { label: 'Expired',      cls: 'bg-[#F3F4F6] text-[#6B7280]' },
  'not-selected': { label: 'Not selected', cls: 'bg-[#F3F4F6] text-[#6B7280]' },
  swapped:        { label: 'Swapped',      cls: 'bg-[#F3F4F6] text-[#6B7280]' },
  dropped:        { label: 'Dropped',      cls: 'bg-[#F3F4F6] text-[#6B7280]' },
};

export function StatusBadge({ status }: { status: JobStatus }) {
  const b = BADGE[status];
  return (
    <span className={`inline-flex items-center gap-1 h-7 px-3 rounded-full text-[13px] font-semibold whitespace-nowrap ${b.cls}`}>
      {b.label}
      {b.check && <Check size={14} strokeWidth={2.75} aria-hidden />}
    </span>
  );
}

export function ClientLogo({ name, src, size = 24 }: { name: string | null | undefined; src?: string | null; size?: number }) {
  return src ? (
    <img src={src} alt="" width={size} height={size} loading="lazy"
      className="rounded-full object-cover flex-shrink-0 bg-[#F3F4F6]" style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden className="rounded-full bg-[#0A1628] text-white font-semibold flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}>
      {initials(name)}
    </span>
  );
}

export function JobCard({
  startISO, endISO, timezone, title, company, location, logo, status, aside, onTap, children, top, className = '',
}: {
  startISO: string | null;
  endISO?: string | null;
  timezone?: string | null;
  title: string;
  company: string | null;
  location: string | null;
  logo?: string | null;
  status?: JobStatus;
  aside?: React.ReactNode;
  onTap?: () => void;
  children?: React.ReactNode;
  /** Rendered edge to edge above the card body (e.g. a mini map). */
  top?: React.ReactNode;
  className?: string;
}) {
  const day = startISO ? dayParts(startISO, timezone) : null;
  const time = timeRange(startISO, endISO, timezone);
  const place = shortPlace(location);
  const body = (
    <>
      <div className="flex items-center justify-between gap-3 min-h-7">
        <p className="text-[15px] text-[#111827] truncate">
          {day ? <>{day.date} <span className="text-[#9CA3AF]">•</span> <span className="text-[#6B7280]">{day.rel}</span></> : <span className="text-[#6B7280]">Date to be set</span>}
        </p>
        {aside ?? (status && <StatusBadge status={status} />)}
      </div>
      <p className="mt-1.5 text-[#111827] text-[19px] font-semibold leading-snug line-clamp-2 break-words">{title}</p>
      {time && <p className="mt-0.5 text-[#111827] text-[16px]">{time}</p>}
      {(company || place) && (
        <div className="mt-3 flex items-center gap-2 min-w-0">
          <ClientLogo name={company} src={logo} />
          <p className="min-w-0 truncate text-[#6B7280] text-[14px]">
            {company}{company && place ? <span className="text-[#9CA3AF]"> • </span> : null}{place}
          </p>
        </div>
      )}
    </>
  );
  return (
    <article className={`bg-white border border-[#E5E7EB] rounded-[16px] shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden ${className}`}>
      {top}
      {onTap ? (
        <button type="button" onClick={onTap} className="w-full text-left px-4 pt-4 pb-4 active:bg-[#F9FAFB] transition-colors"
          aria-label={`${title}${day ? `, ${day.date} ${day.rel}` : ''}${time ? `, ${time}` : ''}${company ? `, ${company}` : ''}`}>
          {body}
        </button>
      ) : <div className="px-4 pt-4 pb-4">{body}</div>}
      {children && <div className="px-4 pb-4 -mt-1">{children}</div>}
    </article>
  );
}

export function JobCardSkeleton() {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[16px] p-4 animate-pulse" aria-hidden>
      <div className="flex justify-between"><div className="h-4 w-28 rounded bg-[#F3F4F6]" /><div className="h-7 w-24 rounded-full bg-[#F3F4F6]" /></div>
      <div className="mt-3 h-5 w-3/4 rounded bg-[#F3F4F6]" />
      <div className="mt-2 h-4 w-1/2 rounded bg-[#F3F4F6]" />
      <div className="mt-4 h-4 w-2/3 rounded bg-[#F3F4F6]" />
    </div>
  );
}

/** Map an application (and its shift's state) to the card's status. */
export function applicationStatus(app: {
  status: string; shiftStatus?: string | null; endTime?: string | null; startTime?: string | null;
}): JobStatus {
  const ended = app.endTime ? Date.parse(app.endTime) < Date.now() : false;
  if (app.shiftStatus === 'cancelled') return 'cancelled';
  switch (app.status) {
    case 'accepted': return ended ? 'completed' : 'confirmed';
    case 'standby':  return ended ? 'expired' : 'standby';
    case 'pending':  return ended ? 'expired' : 'applied';
    case 'withdrawn': return 'dropped';
    default: return 'not-selected';
  }
}
