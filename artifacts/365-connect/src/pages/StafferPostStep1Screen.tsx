import { useState } from 'react';
import { useLocation } from 'wouter';
import { FileText, AlignLeft } from 'lucide-react';
import {
  StepHeader, CTABar, FormSection, FormLabel,
  INPUT_CLS, TEXTAREA_CLS,
} from '@/components/WizardShared';
import { getStafferDraft, setStafferDraft } from '@/store/stafferPostShiftStore';

export function StafferPostStep1Screen() {
  const [, navigate] = useLocation();
  // Read draft AFTER the FAB has already called resetStafferDraft(),
  // so back-navigation from Step 2 → Step 1 preserves entered data.
  const initial = getStafferDraft();

  const [title,       setTitle]       = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [errors,      setErrors]      = useState<Record<string, string>>({});

  const canContinue = title.trim().length >= 2;

  function validate() {
    const e: Record<string, string> = {};
    if (title.trim().length < 2) e.title = 'Title must be at least 2 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleContinue() {
    if (!validate()) return;
    setStafferDraft({ title: title.trim(), description: description.trim() });
    navigate('/staffer-shift/step2');
  }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <StepHeader
        current={1} total={7}
        title="What's the job?"
        subtitle="Give this shift a clear title and optional description"
        onBack={() => navigate('/jobs')}
      />

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-36">
        <FormSection icon={<FileText size={13} aria-hidden className="text-black" />} title="Job Title">
          <div>
            <FormLabel>Title <span className="normal-case text-red-500">*</span></FormLabel>
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setErrors((p) => ({ ...p, title: '' })); }}
              placeholder="e.g. Head Bartender — Saturday Night"
              aria-label="Job title" aria-invalid={!!errors.title}
              maxLength={100}
              className={INPUT_CLS + (errors.title ? ' border-red-400' : '')}
            />
            {errors.title
              ? <p className="text-red-500 text-[11px] mt-1">{errors.title}</p>
              : <p className="text-[#AAAAAA] text-[11px] mt-1">{title.length}/100</p>}
          </div>
        </FormSection>

        <FormSection icon={<AlignLeft size={13} aria-hidden className="text-black" />} title="Description">
          <div>
            <FormLabel>Optional — describe the shift, expectations, requirements</FormLabel>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. High-volume cocktail bar during a Saturday rooftop event. Must be comfortable with craft cocktails and high-paced service. TIPS certification preferred…"
              aria-label="Shift description"
              rows={6}
              maxLength={1000}
              className={TEXTAREA_CLS}
            />
            <p className="text-[#AAAAAA] text-[11px] mt-1">{description.length}/1000</p>
          </div>
        </FormSection>
      </div>

      <CTABar label="Continue" onPress={handleContinue} disabled={!canContinue} />
    </div>
  );
}
