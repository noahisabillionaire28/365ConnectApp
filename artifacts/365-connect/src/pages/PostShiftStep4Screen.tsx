/**
 * Step 4 of 5 — Pay Rate + Description & Requirements
 */
import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { ChevronLeft, DollarSign, FileText, ListChecks } from 'lucide-react';
import { getDraft, setDraft } from '@/store/postShiftStore';
import { BottomTabNav } from '@/components/BottomTabNav';

// ─── Wizard primitives ────────────────────────────────────────────────────────
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[#6B7280] text-[11px] font-semibold uppercase tracking-wider mb-1.5">
      {children}
    </p>
  );
}

const INPUT_CLS =
  'w-full bg-white border border-[#E5E7EB] rounded-[10px] px-3 h-[46px] ' +
  'text-[#111827] text-[14px] font-medium placeholder:text-[#9CA3AF] ' +
  'focus:outline-none focus:border-[#0A1628] transition-colors';

const TEXTAREA_CLS =
  'w-full bg-white border border-[#E5E7EB] rounded-[10px] px-3 py-3 ' +
  'text-[#111827] text-[14px] font-medium placeholder:text-[#9CA3AF] ' +
  'focus:outline-none focus:border-[#0A1628] transition-colors resize-none leading-relaxed';

// ─── Screen ───────────────────────────────────────────────────────────────────
export function PostShiftStep4Screen() {
  const [, navigate] = useLocation();
  const initial      = getDraft();

  const [payRateStr,   setPayRateStr]   = useState(initial.pay_rate > 0 ? String(initial.pay_rate) : '');
  const [description,  setDescription]  = useState(initial.description);
  // requirements stored as newline-separated string in the textarea
  const [reqText,      setReqText]      = useState(initial.requirements.join('\n'));
  const [errors,       setErrors]       = useState<Record<string, string>>({});

  const payNum = Number(payRateStr);

  function validate() {
    const e: Record<string, string> = {};
    if (!payRateStr || isNaN(payNum) || payNum < 1)
      e.payRate = 'Enter a valid hourly pay rate (minimum $1)';
    else if (payNum > 999)
      e.payRate = 'Pay rate cannot exceed $999/hr';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleContinue() {
    if (!validate()) return;
    const requirements = reqText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    setDraft({
      pay_rate:     payNum,
      description:  description.trim(),
      requirements,
    });
    navigate('/post-shift/step5');
  }

  return (
    <div className="min-h-[100dvh] bg-[#F7F8FA] flex flex-col pb-[72px]">

      {/* Header */}
      <div className="bg-white px-5 pt-5 pb-4 border-b border-[#E5E7EB] sticky top-0 z-30">
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button" aria-label="Back to schedule"
            onClick={() => navigate('/post-shift/step3')}
            className="w-9 h-9 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft size={18} aria-hidden className="text-[#111827]" />
          </button>
          <div className="flex-1"><StepBar current={5} total={6} /></div>
          <span className="text-[#6B7280] text-[12px] font-semibold flex-shrink-0">5 of 6</span>
        </div>
        <h1 className="text-[#111827] font-bold text-[22px] tracking-tight">Pay & details</h1>
        <p className="text-[#6B7280] text-[13px] mt-0.5">Set the rate and describe the role</p>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-36">

        {/* Pay rate */}
        <div className="bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-[7px] bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center">
              <DollarSign size={13} aria-hidden className="text-[#0A1628]" />
            </div>
            <h2 className="text-[#111827] font-bold text-[15px]">Pay Rate</h2>
          </div>
          <FieldLabel>
            Hourly rate (USD) <span className="normal-case text-[#EF4444]">*</span>
          </FieldLabel>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] text-[14px] font-semibold pointer-events-none">
              $
            </span>
            <input
              type="number"
              inputMode="decimal"
              value={payRateStr}
              onChange={(e) => { setPayRateStr(e.target.value); setErrors((p) => ({ ...p, payRate: '' })); }}
              placeholder="0.00"
              aria-label="Hourly pay rate in USD"
              aria-invalid={!!errors.payRate}
              min={1}
              max={999}
              step={0.5}
              className={INPUT_CLS + ' pl-7' + (errors.payRate ? ' border-[#EF4444]' : '')}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-[12px] font-medium pointer-events-none">
              / hr
            </span>
          </div>
          {errors.payRate && <p className="text-[#EF4444] text-[11px] mt-1.5">{errors.payRate}</p>}
          {payNum > 0 && !errors.payRate && (
            <p className="text-[#10B981] text-[11px] mt-1.5 font-medium">
              ${payNum.toFixed(2)}/hr
            </p>
          )}
        </div>

        {/* Description */}
        <div className="bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-[7px] bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center">
              <FileText size={13} aria-hidden className="text-[#6B7280]" />
            </div>
            <h2 className="text-[#111827] font-bold text-[15px]">Description</h2>
          </div>
          <FieldLabel>Tell workers about this shift</FieldLabel>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the event, venue, responsibilities, and what a typical shift looks like…"
            aria-label="Shift description"
            rows={5}
            className={TEXTAREA_CLS}
          />
          <p className="text-[#9CA3AF] text-[11px] mt-1.5 text-right">{description.length} chars</p>
        </div>

        {/* Requirements */}
        <div className="bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-[7px] bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center">
              <ListChecks size={13} aria-hidden className="text-[#6B7280]" />
            </div>
            <h2 className="text-[#111827] font-bold text-[15px]">Requirements</h2>
          </div>
          <FieldLabel>Optional — one per line</FieldLabel>
          <textarea
            value={reqText}
            onChange={(e) => setReqText(e.target.value)}
            placeholder={`Must be 21+\nTIPS certified\nAll-black dress code\nNon-slip shoes required`}
            aria-label="Shift requirements, one per line"
            rows={5}
            className={TEXTAREA_CLS}
          />
          {reqText.trim() && (
            <p className="text-[#6B7280] text-[11px] mt-1.5">
              {reqText.split('\n').filter((l) => l.trim()).length} requirement
              {reqText.split('\n').filter((l) => l.trim()).length !== 1 ? 's' : ''} listed
            </p>
          )}
        </div>

      </div>

      {/* Fixed CTA */}
      <div className="fixed bottom-[56px] left-1/2 -translate-x-1/2 w-full max-w-[390px] px-5 pb-4 pt-4
        bg-gradient-to-t from-[#F7F8FA] via-[#F7F8FA]/95 to-transparent z-20">
        <motion.button
          type="button" whileTap={{ scale: 0.97 }}
          onClick={handleContinue}
          aria-label="Review shift before posting"
          className="w-full h-[52px] rounded-[12px] bg-[#0A1628] text-white font-bold text-[16px]"
        >
          Review Shift
        </motion.button>
      </div>

      <BottomTabNav />
    </div>
  );
}
