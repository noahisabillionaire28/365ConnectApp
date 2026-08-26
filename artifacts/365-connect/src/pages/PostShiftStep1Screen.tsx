/**
 * Step 1 of 5 — Job Type + Title
 * Pick one primary job type from the canonical 14, then name the shift.
 */
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { ChevronLeft, Check } from 'lucide-react';
import { JOB_TEMPLATES } from '@/data/postShiftTemplates';
import { getDraft, setDraft, initDraftLocation } from '@/store/postShiftStore';
import { useProfile } from '@/hooks/useProfile';
import { BottomTabNav } from '@/components/BottomTabNav';

// ─── Shared wizard primitives ─────────────────────────────────────────────────
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

const INPUT_CLS =
  'w-full bg-white border border-[#E5E7EB] rounded-[10px] px-3 h-[46px] ' +
  'text-[#111827] text-[14px] font-medium placeholder:text-[#9CA3AF] ' +
  'focus:outline-none focus:border-[#0A1628] transition-colors';

// ─── Job-type tile ────────────────────────────────────────────────────────────
function JobTile({
  id, label, Icon, selected, onToggle,
}: {
  id: string; label: string;
  Icon: React.ComponentType<{ size: number; className?: string }>;
  selected: boolean; onToggle: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.93 }}
      onClick={onToggle}
      aria-label={`${selected ? 'Deselect' : 'Select'} ${label}`}
      aria-pressed={selected}
      className={`relative flex flex-col items-center justify-center gap-2.5 rounded-[12px] py-5 px-2
        border-2 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0A1628]/30
        ${selected
          ? 'bg-[#0A1628]/5 border-[#0A1628]'
          : 'bg-white border-[#E5E7EB] active:border-[#9CA3AF]'}`}
    >
      {selected && (
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#0A1628] flex items-center justify-center"
        >
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
        {label}
      </span>
    </motion.button>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export function PostShiftStep1Screen() {
  const [, navigate] = useLocation();
  const profile = useProfile();

  // Seed the wizard's default location from the user's profile coords as soon
  // as the profile loads.  initDraftLocation is idempotent and no-ops if the
  // user's draft already has a non-Miami location set.
  useEffect(() => {
    if (!profile.isLoading) {
      void initDraftLocation(profile.lat ?? null, profile.lng ?? null);
    }
  }, [profile.isLoading, profile.lat, profile.lng]);

  // Restore from draft (back-navigation preserves state)
  const initial      = getDraft();
  const [jobType, setJobType] = useState(initial.job_type);
  const [title,   setTitle]   = useState(initial.title);
  const [titleErr, setTitleErr] = useState('');

  const canContinue = jobType !== '' && title.trim().length >= 3;

  function handleContinue() {
    if (!jobType) return;
    const t = title.trim();
    if (t.length < 3) { setTitleErr('Title must be at least 3 characters'); return; }
    // Preserve the rest of the draft (event type, edit context) — the fresh
    // start happens once, on the Event Type step.
    setDraft({ job_type: jobType, title: t });
    navigate('/post-shift/step2');
  }

  return (
    <div className="min-h-[100dvh] bg-[#F7F8FA] flex flex-col pb-[72px]">

      {/* Header */}
      <div className="bg-white px-5 pt-5 pb-4 border-b border-[#E5E7EB] sticky top-0 z-30">
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button" aria-label="Back to event type"
            onClick={() => navigate('/post-shift/event')}
            className="w-9 h-9 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft size={18} aria-hidden className="text-[#111827]" />
          </button>
          <div className="flex-1"><StepBar current={2} total={6} /></div>
          <span className="text-[#6B7280] text-[12px] font-semibold flex-shrink-0">2 of 6</span>
        </div>
        <h1 className="text-[#111827] font-bold text-[22px] tracking-tight">Who do you need?</h1>
        <p className="text-[#6B7280] text-[13px] mt-0.5">Select a job type and name this shift</p>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-36">

        {/* Job type grid */}
        <p className="text-[#6B7280] text-[11px] font-semibold uppercase tracking-wider mb-3">
          Job Type <span className="normal-case text-[#EF4444]">*</span>
        </p>
        <div
          className="grid grid-cols-2 gap-3 mb-6"
          role="radiogroup"
          aria-label="Select job type"
        >
          {JOB_TEMPLATES.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.025, duration: 0.22, ease: 'easeOut' }}
            >
              <JobTile
                id={t.id}
                label={t.label}
                Icon={t.Icon}
                selected={jobType === t.label}
                onToggle={() => setJobType(prev => prev === t.label ? '' : t.label)}
              />
            </motion.div>
          ))}
        </div>

        {/* Shift title */}
        <div className="bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-4">
          <p className="text-[#6B7280] text-[11px] font-semibold uppercase tracking-wider mb-1.5">
            Shift Title <span className="normal-case text-[#EF4444]">*</span>
          </p>
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setTitleErr(''); }}
            placeholder="e.g. Saturday Night Bar Service"
            aria-label="Shift title"
            aria-invalid={!!titleErr}
            maxLength={80}
            className={INPUT_CLS + (titleErr ? ' border-[#EF4444]' : '')}
          />
          {titleErr && <p className="text-[#EF4444] text-[11px] mt-1.5">{titleErr}</p>}
          <p className="text-[#9CA3AF] text-[11px] mt-1.5">{title.length}/80</p>
        </div>

      </div>

      {/* Fixed CTA */}
      <div className="fixed bottom-[56px] left-1/2 -translate-x-1/2 w-full max-w-[390px] px-5 pb-4 pt-4
        bg-gradient-to-t from-[#F7F8FA] via-[#F7F8FA]/95 to-transparent z-20">
        {jobType && title.trim().length < 3 ? (
          <motion.p
            key="need-title"
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="text-center text-[#6B7280] text-[12px] mb-2"
          >
            Add a <span className="text-[#0A1628] font-bold">shift title</span> above to continue
          </motion.p>
        ) : jobType ? (
          <motion.p
            key={jobType}
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="text-center text-[#6B7280] text-[12px] mb-2"
          >
            <span className="text-[#0A1628] font-bold">{jobType}</span> selected
          </motion.p>
        ) : null}
        <motion.button
          type="button" whileTap={{ scale: 0.97 }}
          onClick={handleContinue}
          disabled={!canContinue}
          aria-disabled={!canContinue}
          aria-label="Continue to location"
          className={`w-full h-[52px] rounded-[12px] font-bold text-[16px] transition-all duration-200 ${
            canContinue
              ? 'bg-[#0A1628] text-white'
              : 'bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed'
          }`}
        >
          Continue
        </motion.button>
      </div>

      <BottomTabNav />
    </div>
  );
}
