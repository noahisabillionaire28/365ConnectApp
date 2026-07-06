import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { ChevronLeft, Check } from 'lucide-react';
import { JOB_TEMPLATES, type JobTemplate } from '@/data/postShiftTemplates';
import { setDraft, resetDraft } from '@/store/postShiftStore';

/* ─── Step bar ───────────────────────────────────────────────────────────── */
function StepBar({ current, total }: { current: number; total: number }) {
  return (
    <div
      className="flex items-center gap-1.5"
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuetext={`Step ${current} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-[3px] rounded-full transition-all duration-300 ${
            i < current ? 'bg-primary flex-[2]' : 'bg-[#2A2A2A] flex-1'
          }`}
        />
      ))}
    </div>
  );
}

/* ─── Job type tile ──────────────────────────────────────────────────────── */
function TemplateTile({
  template,
  selected,
  onToggle,
}: {
  template: JobTemplate;
  selected: boolean;
  onToggle: () => void;
}) {
  const Icon = template.Icon;
  return (
    <motion.button
      type="button"
      aria-label={`${selected ? 'Deselect' : 'Select'} ${template.label}`}
      aria-pressed={selected}
      whileTap={{ scale: 0.94 }}
      onClick={onToggle}
      className={`
        relative flex flex-col items-center justify-center gap-2.5 rounded-[16px] py-5 px-3
        border-2 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60
        ${selected
          ? 'bg-primary/10 border-primary shadow-[0_0_14px_rgba(255,215,0,0.18)]'
          : 'bg-[#0E0E0E] border-[#1E1E1E] active:border-[#3A3A3A]'}
      `}
    >
      {/* Check badge */}
      {selected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
        >
          <Check size={11} aria-hidden className="text-black" strokeWidth={3} />
        </motion.div>
      )}

      <div
        className={`w-11 h-11 rounded-[12px] flex items-center justify-center ${
          selected ? 'bg-primary/20' : 'bg-[#161616]'
        }`}
      >
        <Icon size={22} aria-hidden className={selected ? 'text-primary' : 'text-[#666]'} />
      </div>
      <span
        className={`text-[12px] font-semibold text-center leading-tight ${
          selected ? 'text-primary' : 'text-[#888]'
        }`}
      >
        {template.label}
      </span>
    </motion.button>
  );
}

/* ─── PostShiftStep1Screen ───────────────────────────────────────────────── */
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

    // Build initial workerCounts (default 1 per type) and prefill from first template
    const workerCounts: Record<string, number> = {};
    for (const t of selectedTemplates) workerCounts[t.label] = t.workersNeeded;

    resetDraft();
    setDraft({
      jobTypes:    selectedTemplates.map((t) => t.label),
      workerCounts,
      // Pre-fill details from first selected template
      payRate:     firstTemplate.payRate,
      dressCode:   firstTemplate.dressCode,
      description: firstTemplate.description,
    });
    navigate('/post-shift/step2');
  }

  return (
    <div className="min-h-[100dvh] bg-black flex flex-col">

      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-[#111]">
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            aria-label="Cancel and go home"
            onClick={() => navigate('/home')}
            className="w-9 h-9 rounded-full bg-[#111] border border-[#222] flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft size={18} aria-hidden className="text-[#888]" />
          </button>
          <div className="flex-1"><StepBar current={1} total={5} /></div>
          <span className="text-[#555] text-[12px] font-medium flex-shrink-0">1 of 5</span>
        </div>
        <h1 className="text-white font-bold text-[22px] tracking-tight">Who do you need?</h1>
        <p className="text-[#555] text-[13px] mt-1">Select one or more job types</p>
      </div>

      {/* Scrollable grid */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-32">
        <div
          className="grid grid-cols-2 gap-3"
          role="group"
          aria-label="Job type selection — multiple allowed"
        >
          {JOB_TEMPLATES.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.24, ease: 'easeOut' }}
            >
              <TemplateTile
                template={t}
                selected={selectedIds.has(t.id)}
                onToggle={() => toggle(t.id)}
              />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Fixed CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] px-5 pb-9 pt-4 bg-gradient-to-t from-black via-black/95 to-transparent z-10">
        {count > 0 && (
          <motion.p
            key={count}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center text-[#666] text-[12px] mb-2"
          >
            <span className="text-primary font-bold">{count}</span> position{count !== 1 ? 's' : ''} selected
            {count > 0 && ` · ${selectedTemplates.map((t) => t.label).join(', ')}`}
          </motion.p>
        )}
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={handleContinue}
          disabled={!canContinue}
          aria-label="Continue to schedule"
          aria-disabled={!canContinue}
          className={`w-full h-[54px] rounded-[14px] font-bold text-[16px] transition-all duration-200 ${
            canContinue
              ? 'bg-primary text-black'
              : 'bg-[#141414] text-[#3A3A3A] cursor-not-allowed border border-[#1E1E1E]'
          }`}
        >
          Continue
        </motion.button>
      </div>
    </div>
  );
}
