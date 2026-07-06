import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { ChevronLeft, DollarSign, Shirt, FileText, User, Phone, MessageSquare } from 'lucide-react';
import { getDraft, setDraft } from '@/store/postShiftStore';

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
        <div key={i} className={`h-[3px] rounded-full flex-1 transition-all duration-300 ${
          i < current ? 'bg-primary' : 'bg-[#2A2A2A]'
        }`} />
      ))}
    </div>
  );
}

function FormLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[#555] text-[11px] font-semibold uppercase tracking-wider mb-1.5">
      {children}
    </p>
  );
}

function FormSection({ icon, title, children }: {
  icon: React.ReactNode; title: string; children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-[7px] bg-[#161616] flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <h2 className="text-white font-bold text-[15px]">{title}</h2>
      </div>
      <div className="bg-[#0C0C0C] border border-[#1E1E1E] rounded-[16px] px-4 py-4 flex flex-col gap-4">
        {children}
      </div>
    </div>
  );
}

const INPUT_CLS = `
  w-full bg-[#141414] border border-[#252525] rounded-[10px] px-3 h-[44px]
  text-white text-[14px] font-medium placeholder:text-[#3A3A3A]
  focus:outline-none focus:border-primary/50 focus:bg-[#161616] transition-colors
`;

const TEXTAREA_CLS = `
  w-full bg-[#141414] border border-[#252525] rounded-[10px] px-3 py-3
  text-white text-[14px] font-medium placeholder:text-[#3A3A3A]
  focus:outline-none focus:border-primary/50 focus:bg-[#161616] transition-colors
  resize-none leading-relaxed
`;

/* ─── PostShiftStep4Screen ───────────────────────────────────────────────── */
export function PostShiftStep4Screen() {
  const [, navigate] = useLocation();
  const initial      = getDraft();

  const [payRateStr,          setPayRateStr]          = useState(String(initial.payRate || 35));
  const [dressCode,           setDressCode]           = useState(initial.dressCode           || '');
  const [description,         setDescription]         = useState(initial.description         || '');
  const [contactName,         setContactName]         = useState(initial.contactName         || '');
  const [contactPhone,        setContactPhone]        = useState(initial.contactPhone        || '');
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
    setDraft({
      payRate: Number(payRateStr),
      dressCode,
      description,
      contactName,
      contactPhone,
      specialInstructions,
    });
    navigate('/post-shift/step5');
  }

  return (
    <div className="min-h-[100dvh] bg-black flex flex-col">

      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-[#111]">
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            aria-label="Back to location"
            onClick={() => navigate('/post-shift/step3')}
            className="w-9 h-9 rounded-full bg-[#111] border border-[#222] flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft size={18} aria-hidden className="text-[#888]" />
          </button>
          <div className="flex-1"><StepBar current={4} total={5} /></div>
          <span className="text-[#555] text-[12px] font-medium flex-shrink-0">4 of 5</span>
        </div>
        <h1 className="text-white font-bold text-[22px] tracking-tight">Shift Details</h1>
        <p className="text-[#555] text-[13px] mt-1">
          Pay, dress code, and who to contact on-site
        </p>
      </div>

      {/* Scrollable form */}
      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-36">

        {/* Pay Rate */}
        <FormSection icon={<DollarSign size={13} aria-hidden className="text-primary" />} title="Compensation">
          <div>
            <FormLabel>Pay rate per hour</FormLabel>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-bold text-[15px]">$</span>
              <input
                type="text"
                inputMode="numeric"
                value={payRateStr}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^0-9]/g, '');
                  const clean  = digits.replace(/^0+(\d)/, '$1');
                  setPayRateStr(clean);
                  setErrors((p) => ({ ...p, payRate: '' }));
                }}
                placeholder="35"
                aria-label="Pay rate per hour in dollars"
                aria-invalid={!!errors.payRate}
                className={INPUT_CLS + ' pl-7' + (errors.payRate ? ' border-red-500/60' : '')}
              />
            </div>
            {errors.payRate && <p className="text-red-400 text-[11px] mt-1">{errors.payRate}</p>}
            <p className="text-[#444] text-[11px] mt-1.5">
              Workers receive 92% after the 8% platform fee
            </p>
          </div>
        </FormSection>

        {/* Dress Code */}
        <FormSection icon={<Shirt size={13} aria-hidden className="text-primary" />} title="Dress Code">
          <div>
            <FormLabel>Attire requirements</FormLabel>
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

        {/* Description */}
        <FormSection icon={<FileText size={13} aria-hidden className="text-primary" />} title="Shift Description">
          <div>
            <FormLabel>Tell workers about this shift</FormLabel>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the event, responsibilities, expectations, and any special requirements…"
              aria-label="Shift description"
              rows={5}
              className={TEXTAREA_CLS}
            />
          </div>
        </FormSection>

        {/* Point of Contact */}
        <FormSection icon={<User size={13} aria-hidden className="text-primary" />} title="Point of Contact">
          <div>
            <FormLabel>Full name <span className="normal-case text-red-400">*</span></FormLabel>
            <input
              type="text"
              value={contactName}
              onChange={(e) => { setContactName(e.target.value); setErrors((p) => ({ ...p, contactName: '' })); }}
              placeholder="e.g. Samantha Cruz"
              aria-label="Point of contact name"
              aria-invalid={!!errors.contactName}
              className={INPUT_CLS + (errors.contactName ? ' border-red-500/60' : '')}
            />
            {errors.contactName && <p className="text-red-400 text-[11px] mt-1">{errors.contactName}</p>}
          </div>
          <div>
            <FormLabel>Phone number</FormLabel>
            <div className="relative">
              <Phone size={14} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" />
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="(305) 555-0100"
                aria-label="Point of contact phone number"
                className={INPUT_CLS + ' pl-9'}
              />
            </div>
          </div>
        </FormSection>

        {/* Special instructions */}
        <FormSection icon={<MessageSquare size={13} aria-hidden className="text-primary" />} title="Special Instructions">
          <div>
            <FormLabel>Optional — anything workers should know</FormLabel>
            <textarea
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="e.g. 'Bring your own apron. Meet with event captain 30 min before service.'"
              aria-label="Special instructions for workers"
              rows={3}
              className={TEXTAREA_CLS}
            />
          </div>
        </FormSection>
      </div>

      {/* Fixed CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] px-5 pb-9 pt-4 bg-gradient-to-t from-black via-black/95 to-transparent z-10">
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={handleContinue}
          aria-label="Review and post shift"
          className="w-full h-[54px] rounded-[14px] bg-primary text-black font-bold text-[16px]"
        >
          Review Shift
        </motion.button>
      </div>
    </div>
  );
}
