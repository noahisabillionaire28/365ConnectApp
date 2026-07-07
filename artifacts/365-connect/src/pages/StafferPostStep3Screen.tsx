import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Calendar, Clock } from 'lucide-react';
import {
  StepHeader, CTABar, FormSection, FormLabel, INPUT_CLS,
} from '@/components/WizardShared';
import { getStafferDraft, setStafferDraft } from '@/store/stafferPostShiftStore';
import { durationLabel } from '@/store/postShiftStore';

export function StafferPostStep3Screen() {
  const [, navigate] = useLocation();
  const initial = getStafferDraft();

  const [date,      setDate]      = useState(initial.date);
  const [startTime, setStartTime] = useState(initial.startTime || '18:00');
  const [endTime,   setEndTime]   = useState(initial.endTime   || '23:00');
  const [errors,    setErrors]    = useState<Record<string, string>>({});

  // Default to today if no date set yet
  useEffect(() => {
    if (!date) setDate(new Date().toISOString().split('T')[0]);
  }, []);

  function validate() {
    const e: Record<string, string> = {};
    if (!date) e.date = 'Date is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleContinue() {
    if (!validate()) return;
    setStafferDraft({ date, startTime, endTime });
    navigate('/staffer-shift/step4');
  }

  const duration = durationLabel(startTime, endTime);

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <StepHeader
        current={3} total={7}
        title="When is it?"
        subtitle="Set the date and shift hours"
        onBack={() => navigate('/staffer-shift/step2')}
      />

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-36">
        <FormSection icon={<Calendar size={13} aria-hidden className="text-black" />} title="Date">
          <div>
            <FormLabel>Shift date <span className="normal-case text-red-500">*</span></FormLabel>
            <input
              type="date" value={date}
              onChange={(e) => { setDate(e.target.value); setErrors((p) => ({ ...p, date: '' })); }}
              aria-label="Shift date" aria-invalid={!!errors.date}
              className={INPUT_CLS + (errors.date ? ' border-red-400' : '')}
              style={{ colorScheme: 'light' }}
            />
            {errors.date && <p className="text-red-500 text-[11px] mt-1">{errors.date}</p>}
          </div>
        </FormSection>

        <FormSection icon={<Clock size={13} aria-hidden className="text-black" />} title="Shift Hours">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FormLabel>Start time</FormLabel>
              <input type="time" value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                aria-label="Shift start time"
                className={INPUT_CLS} style={{ colorScheme: 'light' }} />
            </div>
            <div>
              <FormLabel>End time</FormLabel>
              <input type="time" value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                aria-label="Shift end time"
                className={INPUT_CLS} style={{ colorScheme: 'light' }} />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Clock size={13} aria-hidden className="text-[#737373]" />
            <span className="text-[#737373] text-[13px]">Duration:</span>
            <span className="text-black font-bold text-[14px]" aria-live="polite">{duration}</span>
          </div>
        </FormSection>
      </div>

      <CTABar label="Continue" onPress={handleContinue} />
    </div>
  );
}
