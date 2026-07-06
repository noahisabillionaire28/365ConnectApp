import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { ChevronLeft, Check } from 'lucide-react';
import { JOB_TEMPLATES, type JobTemplate } from '@/data/postShiftTemplates';
import { setDraft, resetDraft } from '@/store/postShiftStore';

function StepBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5" role="progressbar"
      aria-valuenow={current} aria-valuemin={1} aria-valuemax={total}
      aria-valuetext={`Step ${current} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`h-[3px] rounded-full transition-all duration-300 ${
          i < current ? 'bg-black flex-[2]' : 'bg-[#DBDBDB] flex-1'
        }`} />
      ))}
    </div>
  );
}

function TemplateTile({ template, selected, onToggle }: {
  template: JobTemplate; selected: boolean; onToggle: () => void;
}) {
  const Icon = template.Icon;
  return (
    <motion.button type="button"
      aria-label={`${selected ? 'Deselect' : 'Select'} ${template.label}`}
      aria-pressed={selected} whileTap={{ scale: 0.94 }} onClick={onToggle}
      className={`relative flex flex-col items-center justify-center gap-2.5 rounded-[12px] py-5 px-3
        border-2 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/30
        ${selected ? 'bg-black/5 border-black' : 'bg-white border-[#DBDBDB] active:border-[#AAAAAA]'}`}>

      {selected && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-black flex items-center justify-center">
          <Check size={11} aria-hidden className="text-white" strokeWidth={3} />
        </motion.div>
      )}

      <div className={`w-11 h-11 rounded-[10px] flex items-center justify-center ${
        selected ? 'bg-black/10' : 'bg-[#FAFAFA]'
      }`}>
        <Icon size={22} aria-hidden className={selected ? 'text-black' : 'text-[#737373]'} />
      </div>
      <span className={`text-[12px] font-semibold text-center leading-tight ${
        selected ? 'text-black' : 'text-[#737373]'
      }`}>
        {template.label}
      </span>
    </motion.button>
  );
}

export function PostShiftStep1Screen() {
  const [, navigate]    = useLocation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
    const firstTemplate = selectedTemplates[0];
    const workerCounts: Record<string, number> = {};
    for (const t of selectedTemplates) workerCounts[t.label] = t.workersNeeded;
    resetDraft();
    setDraft({
      jobTypes: selectedTemplates.map((t) => t.label),
      workerCounts,
      payRate:     firstTemplate.payRate,
      dressCode:   firstTemplate.dressCode,
      description: firstTemplate.description,
    });
    navigate('/post-shift/step2');
  }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">

      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-[#DBDBDB] bg-white">
        <div className="flex items-center gap-3 mb-4">
          <button type="button" aria-label="Cancel and go home" onClick={() => navigate('/home')}
            className="w-9 h-9 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center flex-shrink-0">
            <ChevronLeft size={18} aria-hidden className="text-black" />
          </button>
          <div className="flex-1"><StepBar current={1} total={5} /></div>
          <span className="text-[#737373] text-[12px] font-medium flex-shrink-0">1 of 5</span>
        </div>
        <h1 className="text-black font-bold text-[22px] tracking-tight">Who do you need?</h1>
        <p className="text-[#737373] text-[13px] mt-1">Select one or more job types</p>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-32">
        <div className="grid grid-cols-2 gap-3" role="group" aria-label="Job type selection — multiple allowed">
          {JOB_TEMPLATES.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.24, ease: 'easeOut' }}>
              <TemplateTile template={t} selected={selectedIds.has(t.id)} onToggle={() => toggle(t.id)} />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Fixed CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] px-5 pb-9 pt-4 bg-gradient-to-t from-white via-white/95 to-transparent z-10 border-t border-[#DBDBDB]">
        {count > 0 && (
          <motion.p key={count} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }}
            className="text-center text-[#737373] text-[12px] mb-2">
            <span className="text-black font-bold">{count}</span> position{count !== 1 ? 's' : ''} selected
            {count > 0 && ` · ${selectedTemplates.map((t) => t.label).join(', ')}`}
          </motion.p>
        )}
        <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={handleContinue}
          disabled={!canContinue} aria-label="Continue to schedule" aria-disabled={!canContinue}
          className={`w-full h-[52px] rounded-[8px] font-bold text-[16px] transition-all duration-200 ${
            canContinue ? 'bg-black text-white' : 'bg-[#EFEFEF] text-[#AAAAAA] cursor-not-allowed border border-[#DBDBDB]'
          }`}>
          Continue
        </motion.button>
      </div>
    </div>
  );
}
