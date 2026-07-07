import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { StepHeader, CTABar, JobTypeGrid } from '@/components/WizardShared';
import { JOB_TEMPLATES } from '@/data/postShiftTemplates';
import { getStafferDraft, setStafferDraft } from '@/store/stafferPostShiftStore';

export function StafferPostStep2Screen() {
  const [, navigate] = useLocation();
  const initial      = getStafferDraft();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(
      JOB_TEMPLATES.filter((t) => initial.jobTypes.includes(t.label)).map((t) => t.id),
    ),
  );

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const selectedTemplates = JOB_TEMPLATES.filter((t) => selectedIds.has(t.id));
  const count             = selectedTemplates.length;
  const canContinue       = count > 0;

  function handleContinue() {
    if (!canContinue) return;
    setStafferDraft({ jobTypes: selectedTemplates.map((t) => t.label) });
    navigate('/staffer-shift/step3');
  }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <StepHeader
        current={2} total={7}
        title="Job type(s)"
        subtitle="Select one or more — multiple types allowed"
        onBack={() => navigate('/staffer-shift/step1')}
      />

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-36">
        <JobTypeGrid selectedIds={selectedIds} onToggle={toggle} />
      </div>

      {/* Selection summary + CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] px-5 pb-9 pt-4 bg-gradient-to-t from-white via-white/95 to-transparent z-10 border-t border-[#DBDBDB]">
        {count > 0 && (
          <motion.p key={count} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }}
            className="text-center text-[#737373] text-[12px] mb-2">
            <span className="text-black font-bold">{count}</span> type{count !== 1 ? 's' : ''} selected
            {' · '}{selectedTemplates.map((t) => t.label).join(', ')}
          </motion.p>
        )}
        <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={handleContinue}
          disabled={!canContinue} aria-label="Continue to date and time" aria-disabled={!canContinue}
          className={`w-full h-[52px] rounded-[8px] font-bold text-[16px] transition-all duration-200 ${
            canContinue ? 'bg-black text-white' : 'bg-[#EFEFEF] text-[#AAAAAA] cursor-not-allowed border border-[#DBDBDB]'
          }`}>
          Continue
        </motion.button>
      </div>
    </div>
  );
}
