import { useState } from 'react';
import { useLocation } from 'wouter';
import { DollarSign, Users, Plus, Minus } from 'lucide-react';
import {
  StepHeader, CTABar, FormSection, FormLabel, INPUT_CLS,
} from '@/components/WizardShared';
import { getStafferDraft, setStafferDraft } from '@/store/stafferPostShiftStore';

export function StafferPostStep5Screen() {
  const [, navigate] = useLocation();
  const initial = getStafferDraft();

  const [payRateStr,     setPayRateStr]     = useState(String(initial.payRate || 35));
  const [workersNeeded,  setWorkersNeeded]  = useState(initial.workersNeeded || 1);
  const [errors,         setErrors]         = useState<Record<string, string>>({});

  function updateWorkers(delta: number) {
    setWorkersNeeded((n) => Math.max(1, Math.min(50, n + delta)));
  }

  function validate() {
    const e: Record<string, string> = {};
    const payNum = Number(payRateStr);
    if (!payRateStr || isNaN(payNum) || payNum < 1) e.payRate = 'Enter a valid pay rate';
    else if (payNum > 500)                          e.payRate = 'Pay rate cannot exceed $500/hr';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleContinue() {
    if (!validate()) return;
    setStafferDraft({ payRate: Number(payRateStr), workersNeeded });
    navigate('/staffer-shift/step6');
  }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <StepHeader
        current={5} total={7}
        title="Pay & headcount"
        subtitle="Set the hourly rate and total workers needed"
        onBack={() => navigate('/staffer-shift/step4')}
      />

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-36">
        {/* Pay rate */}
        <FormSection icon={<DollarSign size={13} aria-hidden className="text-black" />} title="Compensation">
          <div>
            <FormLabel>Pay rate per hour <span className="normal-case text-red-500">*</span></FormLabel>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-black font-bold text-[15px]">$</span>
              <input
                type="text" inputMode="numeric" value={payRateStr}
                onChange={(e) => {
                  const c = e.target.value.replace(/[^0-9]/g, '').replace(/^0+(\d)/, '$1');
                  setPayRateStr(c);
                  setErrors((p) => ({ ...p, payRate: '' }));
                }}
                placeholder="35"
                aria-label="Pay rate per hour in dollars" aria-invalid={!!errors.payRate}
                className={INPUT_CLS + ' pl-7' + (errors.payRate ? ' border-red-400' : '')}
              />
            </div>
            {errors.payRate
              ? <p className="text-red-500 text-[11px] mt-1">{errors.payRate}</p>
              : <p className="text-[#AAAAAA] text-[11px] mt-1.5">Workers receive 92% after the 8% platform fee</p>}
          </div>
        </FormSection>

        {/* Workers needed */}
        <FormSection icon={<Users size={13} aria-hidden className="text-black" />} title="Workers Needed">
          <div>
            <FormLabel>Total workers for this shift</FormLabel>
            <div className="flex items-center justify-between bg-white border border-[#DBDBDB] rounded-[8px] px-4 h-[52px]">
              <button type="button" aria-label="Decrease worker count" onClick={() => updateWorkers(-1)}
                className="w-8 h-8 rounded-[8px] bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center active:border-black">
                <Minus size={14} aria-hidden className="text-[#737373]" />
              </button>
              <span className="text-black font-bold text-[22px] tabular-nums" aria-live="polite">
                {workersNeeded}
              </span>
              <button type="button" aria-label="Increase worker count" onClick={() => updateWorkers(1)}
                className="w-8 h-8 rounded-[8px] bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center active:border-black">
                <Plus size={14} aria-hidden className="text-black" />
              </button>
            </div>
            <p className="text-[#AAAAAA] text-[11px] mt-1.5 text-center">
              {workersNeeded} worker{workersNeeded !== 1 ? 's' : ''} · max 50
            </p>
          </div>
        </FormSection>
      </div>

      <CTABar label="Continue" onPress={handleContinue} />
    </div>
  );
}
