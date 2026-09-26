/**
 * Step 1 of 7 — Shift name
 * The very first thing we ask (Nowsta-style): what is this shift called?
 * Starts a fresh draft for a new post; preserves it when editing or when the
 * user comes back here from a later step.
 */
import { useState, useEffect } from 'react';
import { useLocation, useSearch } from 'wouter';
import { motion } from 'framer-motion';
import { ChevronLeft, Sparkles, LayoutTemplate, ChevronRight } from 'lucide-react';
import { getDraft, setDraft, resetDraft, getEditShiftId, setEditShiftId, loadDraftFromTemplate } from '@/store/postShiftStore';
import { BottomTabNav } from '@/components/BottomTabNav';
import { useRole } from '@/contexts/RoleContext';
import { useToast } from '@/contexts/ToastContext';
import { useTemplates, templateSummary, templateUsage } from '@/hooks/useTemplates';

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

const EXAMPLES = ['Saturday Wedding Reception', 'Corporate Holiday Party', 'Friday Night Bar Service', 'Brand Launch Event'];

export function PostShiftNameScreen() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { role, roleLoading } = useRole();

  // Only clients/staffers may post shifts.
  useEffect(() => {
    if (!roleLoading && role === 'worker') navigate('/home');
  }, [role, roleLoading, navigate]);

  // Fresh draft for a brand-new post. Keep it when editing an existing shift or
  // when the user pressed Back from the next step (?keep=1).
  useEffect(() => {
    if (!getEditShiftId() && !search.includes('keep=1')) resetDraft();
    setTitle(getDraft().title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [title, setTitle] = useState(getDraft().title);
  const [err, setErr] = useState('');
  const isEditing = !!getEditShiftId();
  const canContinue = title.trim().length >= 3;
  const { showToast } = useToast();
  // Saved templates: a fresh post can start from one and skip to the date step.
  const { templates, use: useTemplate, using } = useTemplates(!isEditing && !roleLoading && role !== 'worker');
  const [usingId, setUsingId] = useState<string | null>(null);

  function handleContinue() {
    const t = title.trim();
    if (t.length < 3) { setErr('Give the shift a name of at least 3 characters.'); return; }
    setDraft({ title: t });
    navigate('/post-shift/event');
  }

  async function handleUseTemplate(id: string) {
    if (using) return;
    setUsingId(id);
    try {
      const t = await useTemplate(id);
      loadDraftFromTemplate(t.payload);
      navigate('/post-shift/step3');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not load that template.', 'error');
    } finally {
      setUsingId(null);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[#F7F8FA] flex flex-col pb-[72px]">
      <div className="bg-white px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-4 border-b border-[#E5E7EB] sticky top-0 z-30">
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button" aria-label={isEditing ? 'Cancel editing' : 'Cancel — go back to home'}
            onClick={() => {
              const editId = getEditShiftId();
              if (editId) { setEditShiftId(null); resetDraft(); navigate(`/shift/${editId}`); }
              else navigate('/home');
            }}
            className="w-9 h-9 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft size={18} aria-hidden className="text-[#111827]" />
          </button>
          <div className="flex-1"><StepBar current={1} total={7} /></div>
          <span className="text-[#6B7280] text-[12px] font-semibold flex-shrink-0">1 of 7</span>
        </div>
        <h1 className="text-[#111827] font-bold text-[22px] tracking-tight">
          {isEditing ? 'Update the shift name' : "What's the name of your shift?"}
        </h1>
        <p className="text-[#6B7280] text-[13px] mt-0.5">This is what workers see first, so make it clear.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-36">
        <div className="bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-4">
          <p className="text-[#6B7280] text-[11px] font-semibold uppercase tracking-wider mb-1.5">
            Shift name <span className="normal-case text-[#EF4444]">*</span>
          </p>
          <input
            type="text"
            autoFocus
            value={title}
            onChange={(e) => { setTitle(e.target.value); setErr(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleContinue(); }}
            placeholder="e.g. Saturday Wedding Reception"
            aria-label="Shift name"
            aria-invalid={!!err}
            maxLength={80}
            className={`w-full bg-white border rounded-[10px] px-3 h-[50px] text-[#111827] text-[16px] font-semibold placeholder:text-[#9CA3AF] placeholder:font-medium focus:outline-none focus:border-[#0A1628] transition-colors ${
              err ? 'border-[#EF4444]' : 'border-[#E5E7EB]'}`}
          />
          {err && <p className="text-[#EF4444] text-[11px] mt-1.5">{err}</p>}
          <p className="text-[#9CA3AF] text-[11px] mt-1.5">{title.length}/80</p>
        </div>

        <p className="text-[#6B7280] text-[11px] font-semibold uppercase tracking-wider mt-6 mb-2 flex items-center gap-1.5">
          <Sparkles size={12} aria-hidden /> Ideas
        </p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => { setTitle(ex); setErr(''); }}
              className="h-9 px-3.5 rounded-full bg-white border border-[#E5E7EB] text-[#111827] text-[13px] font-semibold active:bg-[#F3F4F6]">
              {ex}
            </button>
          ))}
        </div>

        {/* Start from a template — everything but the dates is filled in */}
        {!isEditing && templates.length > 0 && (
          <section aria-label="Start from a template" data-testid="template-list">
            <p className="text-[#6B7280] text-[11px] font-semibold uppercase tracking-wider mt-6 mb-2 flex items-center gap-1.5">
              <LayoutTemplate size={12} aria-hidden /> Start from a template
            </p>
            <div className="bg-white border border-[#E5E7EB] rounded-[12px] overflow-hidden">
              {templates.map((t) => (
                <button key={t.id} type="button"
                  onClick={() => void handleUseTemplate(t.id)}
                  disabled={using}
                  aria-label={`Start from template ${t.name}`}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b border-[#F3F4F6] last:border-0 text-left active:bg-[#F9FAFB] disabled:opacity-60">
                  <div className="flex-1 min-w-0">
                    <p className="text-[#111827] text-[14px] font-semibold truncate">{t.name}</p>
                    <p className="text-[#6B7280] text-[12px] truncate">{templateSummary(t.payload)}</p>
                    <p className="text-[#9CA3AF] text-[11px]">{templateUsage(t)}</p>
                  </div>
                  {usingId === t.id
                    ? <div className="w-4 h-4 rounded-full border-2 border-[#E5E7EB] border-t-[#0A1628] animate-spin" aria-hidden />
                    : <ChevronRight size={16} aria-hidden className="text-[#D1D5DB] flex-shrink-0" />}
                </button>
              ))}
            </div>
            <p className="text-[#9CA3AF] text-[11px] mt-1.5 px-1">Loads the details; you only pick the date and time.</p>
          </section>
        )}
      </div>

      <div className="fixed bottom-[56px] left-1/2 -translate-x-1/2 w-full max-w-app px-5 pb-4 pt-4 bg-gradient-to-t from-[#F7F8FA] via-[#F7F8FA]/95 to-transparent z-20">
        <motion.button
          type="button" whileTap={{ scale: 0.97 }}
          onClick={handleContinue}
          disabled={!canContinue}
          aria-disabled={!canContinue}
          aria-label="Continue to event type"
          className={`w-full h-[52px] rounded-[12px] font-bold text-[16px] transition-all duration-200 ${
            canContinue ? 'bg-[#0A1628] text-white' : 'bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed'}`}
        >
          Continue
        </motion.button>
      </div>

      <BottomTabNav />
    </div>
  );
}
