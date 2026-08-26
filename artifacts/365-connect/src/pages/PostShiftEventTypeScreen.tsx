/**
 * Step 1 of 6 — Event Type
 * The event frames the whole shift (Wedding, Corporate, …). This is the first
 * step; it starts a fresh draft for a new post and preserves it when editing.
 */
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
  ChevronLeft, Check, PartyPopper, Heart, UtensilsCrossed, Star, Building2, Sparkles,
} from 'lucide-react';
import { EVENT_TYPES } from '@/lib/eventTypes';
import { getDraft, setDraft, resetDraft, getEditShiftId, setEditShiftId } from '@/store/postShiftStore';
import { BottomTabNav } from '@/components/BottomTabNav';

function StepBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5" role="progressbar"
      aria-valuenow={current} aria-valuemin={1} aria-valuemax={total}
      aria-valuetext={`Step ${current} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`h-[3px] rounded-full flex-1 transition-all duration-300 ${
          i < current ? 'bg-[#0A1628]' : 'bg-[#E5E7EB]'
        }`} />
      ))}
    </div>
  );
}

const EVENT_ICONS: Record<string, React.ComponentType<{ size: number; className?: string }>> = {
  'Cocktail Party': PartyPopper,
  'Wedding':        Heart,
  'Dinner Party':   UtensilsCrossed,
  'Bar Mitzvah':    Star,
  'Corporate':      Building2,
  'Other':          Sparkles,
};

export function PostShiftEventTypeScreen() {
  const [, navigate] = useLocation();

  // Fresh start for a new post; preserve the draft when editing an existing shift.
  useEffect(() => {
    if (!getEditShiftId()) resetDraft();
  }, []);

  const [eventType, setEventType] = useState(getDraft().event_type);

  function handleContinue() {
    if (!eventType) return;
    setDraft({ event_type: eventType });
    navigate('/post-shift/step1');
  }

  return (
    <div className="min-h-[100dvh] bg-[#F7F8FA] flex flex-col pb-[72px]">
      {/* Header */}
      <div className="bg-white px-5 pt-5 pb-4 border-b border-[#E5E7EB] sticky top-0 z-30">
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button" aria-label="Cancel — go back to home"
            onClick={() => {
              const editId = getEditShiftId();
              if (editId) { setEditShiftId(null); resetDraft(); navigate(`/shift/${editId}`); }
              else navigate('/home');
            }}
            className="w-9 h-9 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft size={18} aria-hidden className="text-[#111827]" />
          </button>
          <div className="flex-1"><StepBar current={1} total={6} /></div>
          <span className="text-[#6B7280] text-[12px] font-semibold flex-shrink-0">1 of 6</span>
        </div>
        <h1 className="text-[#111827] font-bold text-[22px] tracking-tight">What kind of event?</h1>
        <p className="text-[#6B7280] text-[13px] mt-0.5">Pick the type of event you're staffing</p>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-36">
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Select event type">
          {EVENT_TYPES.map((t, i) => {
            const Icon = EVENT_ICONS[t] ?? Sparkles;
            const selected = eventType === t;
            return (
              <motion.button
                key={t}
                type="button"
                role="radio"
                aria-checked={selected}
                whileTap={{ scale: 0.93 }}
                onClick={() => setEventType(selected ? '' : t)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.22, ease: 'easeOut' }}
                className={`relative flex flex-col items-center justify-center gap-2.5 rounded-[12px] py-6 px-2
                  border-2 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0A1628]/30
                  ${selected ? 'bg-[#0A1628]/5 border-[#0A1628]' : 'bg-white border-[#E5E7EB] active:border-[#9CA3AF]'}`}
              >
                {selected && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#0A1628] flex items-center justify-center">
                    <Check size={10} aria-hidden className="text-white" strokeWidth={3} />
                  </motion.div>
                )}
                <div className={`w-11 h-11 rounded-[10px] flex items-center justify-center ${
                  selected ? 'bg-[#0A1628]/10' : 'bg-[#F3F4F6]'
                }`}>
                  <Icon size={22} className={selected ? 'text-[#0A1628]' : 'text-[#6B7280]'} />
                </div>
                <span className={`text-[12px] font-semibold text-center leading-tight ${
                  selected ? 'text-[#0A1628]' : 'text-[#6B7280]'
                }`}>
                  {t}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Fixed CTA */}
      <div className="fixed bottom-[56px] left-1/2 -translate-x-1/2 w-full max-w-[390px] px-5 pb-4 pt-4
        bg-gradient-to-t from-[#F7F8FA] via-[#F7F8FA]/95 to-transparent z-20">
        {eventType && (
          <motion.p key={eventType} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="text-center text-[#6B7280] text-[12px] mb-2">
            <span className="text-[#0A1628] font-bold">{eventType}</span> selected
          </motion.p>
        )}
        <motion.button
          type="button" whileTap={{ scale: 0.97 }}
          onClick={handleContinue}
          disabled={!eventType}
          aria-disabled={!eventType}
          aria-label="Continue to job type"
          className={`w-full h-[52px] rounded-[12px] font-bold text-[16px] transition-all duration-200 ${
            eventType ? 'bg-[#0A1628] text-white' : 'bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed'
          }`}
        >
          Continue
        </motion.button>
      </div>

      <BottomTabNav />
    </div>
  );
}
