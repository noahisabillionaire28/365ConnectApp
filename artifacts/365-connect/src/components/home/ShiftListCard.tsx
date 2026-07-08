import { MapPin, Users, CheckCircle2 } from 'lucide-react';
import type { MockShift } from '@/data/mockFeed';

const NAVY = '#0A1628';

/**
 * Worker Home Feed shift card (spec A) — Nowsta-style horizontal card, no
 * cover photo. Shows job-type pill, company + location, date/time, hourly
 * pay, distance, spots remaining (red under 3), and a green checkmark when
 * the worker has already applied.
 */
export function ShiftListCard({ shift, applied, onTap }: {
  shift: MockShift; applied: boolean; onTap: () => void;
}) {
  const spotsLow = shift.spotsAvailable < 3;

  return (
    <div role="article" tabIndex={0} onClick={onTap}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onTap())}
      aria-label={`${shift.jobType} at ${shift.companyName}, $${shift.payRate}/${shift.payPeriod}${applied ? ' — already applied' : ''}`}
      className="mx-4 rounded-[12px] border border-[#E5E7EB] bg-white px-4 py-4 flex flex-col gap-3 cursor-pointer
        transition-colors active:bg-[#FAFAFA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0A1628]">

      <div className="flex items-start justify-between gap-3">
        <span className="text-white text-[11px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wide"
          style={{ background: NAVY }}>
          {shift.jobType}
        </span>
        {applied && (
          <div aria-label="Already applied" className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={15} aria-hidden className="text-white" strokeWidth={2.5} />
          </div>
        )}
      </div>

      <div>
        <p className="text-[#111827] font-bold text-[16px] leading-tight truncate">{shift.companyName}</p>
        <div className="flex items-center gap-1 mt-1">
          <MapPin size={12} aria-hidden className="text-[#6B7280] flex-shrink-0" />
          <p className="text-[#6B7280] text-[12px] truncate">{shift.location}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[#111827] text-[13px] font-medium">{shift.date}</span>
          <span className="text-[#6B7280] text-[12px]">{shift.startTime} – {shift.endTime}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-[#111827] font-bold text-[20px]">${shift.payRate}</span>
          <span className="text-[#6B7280] text-[12px] font-medium">/{shift.payPeriod}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-[#F3F4F6]">
        <span className="text-[#6B7280] text-[12px]">{shift.distanceMiles} mi away</span>
        <span className="text-[#D1D5DB]">·</span>
        <span className={`text-[12px] font-semibold ${spotsLow ? 'text-[#EF4444]' : 'text-[#6B7280]'}`}>
          {shift.spotsAvailable} spot{shift.spotsAvailable !== 1 ? 's' : ''} left
        </span>
        {spotsLow && <Users size={12} aria-hidden className="text-[#EF4444]" />}
      </div>
    </div>
  );
}

export function ShiftListCardSkeleton() {
  return (
    <div className="mx-4 rounded-[12px] border border-[#E5E7EB] bg-white px-4 py-4 flex flex-col gap-3">
      <div className="w-24 h-6 rounded-full bg-[#EFEFEF] animate-pulse" />
      <div className="w-40 h-4 rounded bg-[#EFEFEF] animate-pulse" />
      <div className="w-full h-4 rounded bg-[#EFEFEF] animate-pulse" />
    </div>
  );
}
