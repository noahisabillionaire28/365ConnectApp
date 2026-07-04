import { useParams, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  Heart,
  MapPin,
  Clock,
  Calendar,
  DollarSign,
  Users,
  Sparkles,
  User,
  Shirt,
} from 'lucide-react';
import { MOCK_SHIFTS } from '@/data/mockFeed';
import { useFeedStore, toggleSaved, markApplied } from '@/store/feedStore';

function InfoRow({
  icon,
  label,
  value,
  valueClass = '',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-[#1E1E1E] last:border-0">
      <div className="w-8 h-8 rounded-[10px] bg-[#161616] flex items-center justify-center flex-shrink-0 mt-[1px]">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[#666] text-[11px] font-medium uppercase tracking-wider mb-[2px]">{label}</p>
        <p className={`text-white text-[14px] font-medium leading-snug ${valueClass}`}>{value}</p>
      </div>
    </div>
  );
}

export function ShiftDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const store = useFeedStore();

  const shift = MOCK_SHIFTS.find((s) => s.id === id);

  if (!shift) {
    return (
      <div className="min-h-[100dvh] bg-black flex items-center justify-center">
        <p className="text-[#666]">Shift not found.</p>
      </div>
    );
  }

  const saved = store.isSaved(shift.id);
  const applied = store.isApplied(shift.id);
  const spotsLow = shift.spotsAvailable < 3;

  return (
    <div className="min-h-[100dvh] bg-black flex flex-col">
      {/* Hero image */}
      <div className="relative w-full h-[340px] flex-shrink-0 overflow-hidden">
        <img
          src={shift.coverImage}
          alt={`${shift.jobType} at ${shift.companyName}`}
          loading="eager"
          decoding="async"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/90" />

        {/* Back button */}
        <button
          type="button"
          aria-label="Go back"
          onClick={() => navigate('/home')}
          className="absolute top-5 left-4 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center"
        >
          <ChevronLeft size={20} aria-hidden="true" className="text-white" />
        </button>

        {/* Save button */}
        <button
          type="button"
          aria-label={saved ? 'Remove from saved' : 'Save this shift'}
          aria-pressed={saved}
          onClick={() => toggleSaved(shift.id)}
          className="absolute top-5 right-4 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center"
        >
          <Heart
            size={18}
            aria-hidden="true"
            className={saved ? 'text-primary fill-primary' : 'text-white'}
          />
        </button>

        {/* Job type pill */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2">
          <span className="bg-primary text-black text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wide">
            {shift.jobType}
          </span>
        </div>

        {/* AI Match */}
        <div className="absolute bottom-4 right-4" aria-label={`${shift.aiMatchPct}% AI match score`}>
          <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-sm border border-primary/30 rounded-full px-3 py-1.5">
            <Sparkles size={12} aria-hidden="true" className="text-primary" />
            <span className="text-primary text-[12px] font-bold">{shift.aiMatchPct}% Match</span>
          </div>
        </div>

        {/* Company name overlay */}
        <div className="absolute bottom-4 left-4">
          <p className="text-white font-bold text-[18px] leading-tight drop-shadow-lg">
            {shift.companyName}
          </p>
          <p className="text-white/70 text-[12px] mt-0.5">{shift.location}</p>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pb-32">
        {/* Quick stats bar */}
        <div className="grid grid-cols-3 border-b border-[#1E1E1E]" role="group" aria-label="Shift summary">
          <div className="flex flex-col items-center justify-center py-4 border-r border-[#1E1E1E]">
            <span className="text-primary font-bold text-[18px]">
              ${shift.payRate}
              <span className="text-[12px] font-normal text-[#666]">/{shift.payPeriod}</span>
            </span>
            <span className="text-[#666] text-[11px] mt-0.5">Pay Rate</span>
          </div>
          <div className="flex flex-col items-center justify-center py-4 border-r border-[#1E1E1E]">
            <span className={`font-bold text-[18px] ${spotsLow ? 'text-red-500' : 'text-white'}`}>
              {shift.spotsAvailable}
              <span className="text-[12px] font-normal text-[#666]">/{shift.spotsTotal}</span>
            </span>
            <span className="text-[#666] text-[11px] mt-0.5">Spots Left</span>
          </div>
          <div className="flex flex-col items-center justify-center py-4">
            <span className="text-white font-bold text-[18px]">
              {shift.distanceMiles}
              <span className="text-[12px] font-normal text-[#666]"> mi</span>
            </span>
            <span className="text-[#666] text-[11px] mt-0.5">Away</span>
          </div>
        </div>

        <div className="px-5 pt-5">
          <h2 className="text-white font-bold text-[20px] mb-4">Shift Details</h2>

          <div className="bg-[#0E0E0E] rounded-[14px] px-4 mb-5">
            <InfoRow
              icon={<Calendar size={15} aria-hidden="true" className="text-primary" />}
              label="Date"
              value={shift.date}
            />
            <InfoRow
              icon={<Clock size={15} aria-hidden="true" className="text-primary" />}
              label="Time"
              value={`${shift.startTime} – ${shift.endTime}`}
            />
            <InfoRow
              icon={<MapPin size={15} aria-hidden="true" className="text-primary" />}
              label="Location"
              value={`${shift.location} · ${shift.distanceMiles} mi away`}
            />
            <InfoRow
              icon={<DollarSign size={15} aria-hidden="true" className="text-primary" />}
              label="Pay"
              value={`$${shift.payRate}/${shift.payPeriod}`}
              valueClass="text-primary"
            />
            <InfoRow
              icon={<Users size={15} aria-hidden="true" className="text-primary" />}
              label="Spots Available"
              value={`${shift.spotsAvailable} of ${shift.spotsTotal} remaining`}
              valueClass={spotsLow ? 'text-red-400' : ''}
            />
            <InfoRow
              icon={<Shirt size={15} aria-hidden="true" className="text-primary" />}
              label="Dress Code"
              value={shift.dressCode}
            />
            <InfoRow
              icon={<User size={15} aria-hidden="true" className="text-primary" />}
              label="Point of Contact"
              value={shift.pointOfContact}
            />
          </div>

          <h2 className="text-white font-bold text-[18px] mb-3">About this Shift</h2>
          <p className="text-[#9A9A9A] text-[14px] leading-relaxed mb-6">{shift.description}</p>

          <h2 className="text-white font-bold text-[18px] mb-3">Requirements</h2>
          <ul className="flex flex-col gap-2 mb-6" aria-label="Shift requirements">
            {shift.requirements.map((req) => (
              <li key={req} className="flex items-center gap-3">
                <div aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                <span className="text-[#9A9A9A] text-[14px]">{req}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Fixed CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] px-5 pb-8 pt-4 bg-gradient-to-t from-black via-black/95 to-transparent">
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={() => markApplied(shift.id)}
          disabled={applied}
          aria-label={applied ? 'Application already sent' : `Apply to ${shift.companyName}`}
          aria-disabled={applied}
          className={`w-full h-[54px] rounded-[14px] font-bold text-[16px] transition-all ${
            applied
              ? 'bg-[#1A1A1A] text-[#666] cursor-default'
              : 'bg-primary text-black active:opacity-90'
          }`}
        >
          {applied ? 'Application Sent ✓' : 'Apply Now'}
        </motion.button>
      </div>
    </div>
  );
}
