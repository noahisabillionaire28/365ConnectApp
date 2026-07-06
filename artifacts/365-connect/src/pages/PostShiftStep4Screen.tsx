import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { ChevronLeft, DollarSign, Shirt, FileText, User, Phone, MessageSquare } from 'lucide-react';
import { getDraft, setDraft } from '@/store/postShiftStore';

function StepBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5" role="progressbar"
      aria-valuenow={current} aria-valuemin={1} aria-valuemax={total}
      aria-valuetext={`Step ${current} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`h-[3px] rounded-full flex-1 transition-all duration-300 ${
          i < current ? 'bg-black' : 'bg-[#DBDBDB]'
        }`} />
      ))}
    </div>
  );
}

function FormLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[#737373] text-[11px] font-semibold uppercase tracking-wider mb-1.5">{children}</p>;
}

function FormSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-[7px] bg-[#F5F5F5] border border-[#DBDBDB] flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <h2 className="text-black font-bold text-[15px]">{title}</h2>
      </div>
      <div className="bg-[#FAFAFA] border border-[#DBDBDB] rounded-[12px] px-4 py-4 flex flex-col gap-4">
        {children}
      </div>
    </div>
  );
}

const INPUT_CLS = `
  w-full bg-white border border-[#DBDBDB] rounded-[8px] px-3 h-[44px]
  text-black text-[14px] font-medium placeholder:text-[#AAAAAA]
  focus:outline-none focus:border-black transition-colors
`;

const TEXTAREA_CLS = `
  w-full bg-white border border-[#DBDBDB] rounded-[8px] px-3 py-3
  text-black text-[14px] font-medium placeholder:text-[#AAAAAA]
  focus:outline-none focus:border-black transition-colors
  resize-none leading-relaxed
`;

export function PostShiftStep4Screen() {
  const [, navigate] = useLocation();
  const initial = getDraft();

  const [payRateStr,          setPayRateStr]          = useState(String(initial.payRate || 35));
  const [dressCode,           setDressCode]           = useState(initial.dressCode || '');
  const [description,         setDescription]         = useState(initial.description || '');
  const [contactName,         setContactName]         = useState(initial.contactName || '');
  const [contactPhone,        setContactPhone]        = useState(initial.contactPhone || '');
  const [specialInstructions, setSpecialInstructions] = useState(initial.specialInstructions || '');
  const [errors,              setErrors]              = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    const payNum = Number(payRateStr);
    if (!payRateStr || isNaN(payNum) || payNum < 1) e.payRate = 'Enter a valid pay rate';
    else if (payNum > 500)                          e.payRate = 'Pay rate cannot exceed $500/hr';
    if (!contactName.trim())                        e.contactName = 'Contact name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleContinue() {
    if (!validate()) return;
    setDraft({ payRate: Number(payRateStr), dressCode, description, contactName, contactPhone, specialInstructions });
    navigate('/post-shift/step5');
  }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <div className="px-5 pt-5 pb-4 border-b border-[#DBDBDB]">
        <div className="flex items-center gap-3 mb-4">
          <button type="button" aria-label="Back to location" onClick={() => navigate('/post-shift/step3')}
            className="w-9 h-9 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center flex-shrink-0">
            <ChevronLeft size={18} aria-hidden className="text-black" />
          </button>
          <div className="flex-1"><StepBar current={4} total={5} /></div>
          <span className="text-[#737373] text-[12px] font-medium flex-shrink-0">4 of 5</span>
        </div>
        <h1 className="text-black font-bold text-[22px] tracking-tight">Shift Details</h1>
        <p className="text-[#737373] text-[13px] mt-1">Pay, dress code, and who to contact on-site</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-36">
        <FormSection icon={<DollarSign size={13} aria-hidden className="text-black" />} title="Compensation">
          <div>
            <FormLabel>Pay rate per hour</FormLabel>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-black font-bold text-[15px]">$</span>
              <input type="text" inputMode="numeric" value={payRateStr}
                onChange={(e) => { const c = e.target.value.replace(/[^0-9]/g, '').replace(/^0+(\d)/, '$1'); setPayRateStr(c); setErrors((p) => ({ ...p, payRate: '' })); }}
                placeholder="35" aria-label="Pay rate per hour in dollars" aria-invalid={!!errors.payRate}
                className={INPUT_CLS + ' pl-7' + (errors.payRate ? ' border-red-400' : '')} />
            </div>
            {errors.payRate && <p className="text-red-500 text-[11px] mt-1">{errors.payRate}</p>}
            <p className="text-[#AAAAAA] text-[11px] mt-1.5">Workers receive 92% after the 8% platform fee</p>
          </div>
        </FormSection>

        <FormSection icon={<Shirt size={13} aria-hidden className="text-black" />} title="Dress Code">
          <div>
            <FormLabel>Attire requirements</FormLabel>
            <textarea value={dressCode} onChange={(e) => setDressCode(e.target.value)}
              placeholder="e.g. All Black — black dress shirt, black slacks, black non-slip shoes…"
              aria-label="Dress code requirements" rows={3} className={TEXTAREA_CLS} />
          </div>
        </FormSection>

        <FormSection icon={<FileText size={13} aria-hidden className="text-black" />} title="Shift Description">
          <div>
            <FormLabel>Tell workers about this shift</FormLabel>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the event, responsibilities, expectations, and any special requirements…"
              aria-label="Shift description" rows={5} className={TEXTAREA_CLS} />
          </div>
        </FormSection>

        <FormSection icon={<User size={13} aria-hidden className="text-black" />} title="Point of Contact">
          <div>
            <FormLabel>Full name <span className="normal-case text-red-500">*</span></FormLabel>
            <input type="text" value={contactName}
              onChange={(e) => { setContactName(e.target.value); setErrors((p) => ({ ...p, contactName: '' })); }}
              placeholder="e.g. Samantha Cruz" aria-label="Point of contact name" aria-invalid={!!errors.contactName}
              className={INPUT_CLS + (errors.contactName ? ' border-red-400' : '')} />
            {errors.contactName && <p className="text-red-500 text-[11px] mt-1">{errors.contactName}</p>}
          </div>
          <div>
            <FormLabel>Phone number</FormLabel>
            <div className="relative">
              <Phone size={14} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737373]" />
              <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)}
                placeholder="(305) 555-0100" aria-label="Point of contact phone number"
                className={INPUT_CLS + ' pl-9'} />
            </div>
          </div>
        </FormSection>

        <FormSection icon={<MessageSquare size={13} aria-hidden className="text-black" />} title="Special Instructions">
          <div>
            <FormLabel>Optional — anything workers should know</FormLabel>
            <textarea value={specialInstructions} onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="e.g. 'Bring your own apron. Meet with event captain 30 min before service.'"
              aria-label="Special instructions for workers" rows={3} className={TEXTAREA_CLS} />
          </div>
        </FormSection>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] px-5 pb-9 pt-4 bg-gradient-to-t from-white via-white/95 to-transparent z-10 border-t border-[#DBDBDB]">
        <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={handleContinue}
          aria-label="Review and post shift"
          className="w-full h-[52px] rounded-[8px] bg-black text-white font-bold text-[16px]">
          Review Shift
        </motion.button>
      </div>
    </div>
  );
}
