import { useState } from 'react';
import { useLocation } from 'wouter';
import { Shirt, User, Phone } from 'lucide-react';
import {
  StepHeader, CTABar, FormSection, FormLabel,
  INPUT_CLS, TEXTAREA_CLS,
} from '@/components/WizardShared';
import { getStafferDraft, setStafferDraft } from '@/store/stafferPostShiftStore';

export function StafferPostStep6Screen() {
  const [, navigate] = useLocation();
  const initial = getStafferDraft();

  const [dressCode,    setDressCode]    = useState(initial.dressCode || '');
  const [contactName,  setContactName]  = useState(initial.contactName || '');
  const [contactPhone, setContactPhone] = useState(initial.contactPhone || '');
  const [errors,       setErrors]       = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!contactName.trim()) e.contactName = 'Contact name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleContinue() {
    if (!validate()) return;
    setStafferDraft({
      dressCode:    dressCode.trim(),
      contactName:  contactName.trim(),
      contactPhone: contactPhone.trim(),
    });
    navigate('/staffer-shift/step7');
  }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <StepHeader
        current={6} total={7}
        title="Dress code & contact"
        subtitle="Tell workers what to wear and who to reach on-site"
        onBack={() => navigate('/staffer-shift/step5')}
      />

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-36">
        <FormSection icon={<Shirt size={13} aria-hidden className="text-black" />} title="Dress Code">
          <div>
            <FormLabel>Attire requirements (optional)</FormLabel>
            <textarea
              value={dressCode}
              onChange={(e) => setDressCode(e.target.value)}
              placeholder="e.g. All Black — black dress shirt, black slacks, black non-slip shoes…"
              aria-label="Dress code requirements"
              rows={3}
              className={TEXTAREA_CLS}
            />
          </div>
        </FormSection>

        <FormSection icon={<User size={13} aria-hidden className="text-black" />} title="Point of Contact">
          <div>
            <FormLabel>Full name <span className="normal-case text-red-500">*</span></FormLabel>
            <input
              type="text" value={contactName}
              onChange={(e) => { setContactName(e.target.value); setErrors((p) => ({ ...p, contactName: '' })); }}
              placeholder="e.g. Samantha Cruz"
              aria-label="Point of contact full name" aria-invalid={!!errors.contactName}
              className={INPUT_CLS + (errors.contactName ? ' border-red-400' : '')}
            />
            {errors.contactName && (
              <p className="text-red-500 text-[11px] mt-1">{errors.contactName}</p>
            )}
          </div>
          <div>
            <FormLabel>Phone number (optional)</FormLabel>
            <div className="relative">
              <Phone size={14} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737373]" />
              <input
                type="tel" value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="(305) 555-0100"
                aria-label="Point of contact phone number"
                className={INPUT_CLS + ' pl-9'}
              />
            </div>
          </div>
        </FormSection>
      </div>

      <CTABar label="Review Shift" onPress={handleContinue} />
    </div>
  );
}
