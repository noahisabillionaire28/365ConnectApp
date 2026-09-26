/**
 * The worker's pay timeline for one shift: Worked → Approved → Paid.
 *
 * Full mode (the shift page's "Your hours" card) shows a check or pending dot
 * per step with the instant it happened under it, in the shift's own zone
 * ("Sat 11:42 PM"), and the amount on the Paid step. Compact mode (Earnings
 * rows) is just the three dots and labels. When the poster changed the hours
 * and the worker has not answered yet, the Approved step reads "Review" in
 * amber — the Looks right / Dispute buttons live next to the card, not here.
 */
import { Check, AlertCircle } from 'lucide-react';
import type { PayTimeline as PayTimelineData, PayStage } from '@/hooks/usePayments';
import { formatDayTime } from '@/lib/timezone';

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

type StepState = 'done' | 'attention' | 'pending';
type Step = { key: string; label: string; state: StepState; sub: string; subTone?: 'muted' | 'strong' | 'amber' | 'red' };

/** The three steps for a timeline, with each one's state and the line under it. */
export function timelineSteps(t: PayTimelineData, tz?: string | null): Step[] {
  const worked: Step = t.workedAt
    ? { key: 'worked', label: 'Worked', state: 'done', sub: formatDayTime(t.workedAt, tz) }
    : { key: 'worked', label: 'Worked', state: 'pending', sub: t.stage === 'in_progress' ? 'In progress' : 'Not yet' };

  let approved: Step;
  if (!t.approvedAt) {
    approved = { key: 'approved', label: 'Approved', state: 'pending', sub: 'Pending' };
  } else if (t.workerAck === 'disputed') {
    approved = { key: 'approved', label: 'Approved', state: 'attention', sub: 'Disputed', subTone: 'red' };
  } else if (t.hoursChanged && !t.workerAck) {
    approved = { key: 'approved', label: 'Approved', state: 'attention', sub: 'Review', subTone: 'amber' };
  } else {
    approved = { key: 'approved', label: 'Approved', state: 'done', sub: formatDayTime(t.approvedAt, tz) };
  }

  const paid: Step = t.paidAt
    ? {
        key: 'paid', label: 'Paid', state: 'done', subTone: 'strong',
        sub: `${t.paidAmount != null ? usd(t.paidAmount) : ''}${t.paidAmount != null ? ' · ' : ''}${t.paidMethod === 'manual' ? 'Paid outside the app' : formatDayTime(t.paidAt, tz)}`,
      }
    : { key: 'paid', label: 'Paid', state: 'pending', sub: 'Not yet paid' };

  return [worked, approved, paid];
}

/** The chip label for where a timesheet is now. */
export function stageLabel(t: PayTimelineData): { label: string; tone: 'muted' | 'blue' | 'green' | 'amber' | 'red' } {
  if (t.stage === 'paid') return { label: 'Paid', tone: 'green' };
  if (t.stage === 'approved') {
    if (t.workerAck === 'disputed') return { label: 'Disputed', tone: 'red' };
    if (t.hoursChanged && !t.workerAck) return { label: 'Review hours', tone: 'amber' };
    return { label: 'Approved · awaiting payment', tone: 'blue' };
  }
  if (t.stage === 'worked') return { label: 'Pending approval', tone: 'muted' };
  return { label: 'In progress', tone: 'muted' };
}

const CHIP: Record<ReturnType<typeof stageLabel>['tone'], string> = {
  muted: 'bg-[#F3F4F6] text-[#6B7280] border-[#E5E7EB]',
  blue:  'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',
  green: 'bg-emerald-50 text-[#15803D] border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  red:   'bg-red-50 text-[#DC2626] border-red-200',
};

export function StageChip({ timeline }: { timeline: PayTimelineData }) {
  const { label, tone } = stageLabel(timeline);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${CHIP[tone]}`}>
      {label}
    </span>
  );
}

/** A filter bucket for Earnings; 'approved' means approved and not yet paid. */
export function stageBucket(stage: PayStage | undefined): 'worked' | 'approved' | 'paid' | null {
  if (stage === 'paid' || stage === 'approved' || stage === 'worked') return stage;
  return null;
}

function Dot({ state, size }: { state: StepState; size: number }) {
  const icon = Math.round(size * 0.6);
  if (state === 'done') {
    return (
      <span aria-hidden style={{ width: size, height: size }}
        className="rounded-full bg-[#15803D] text-white flex items-center justify-center flex-shrink-0">
        <Check size={icon} strokeWidth={3} />
      </span>
    );
  }
  if (state === 'attention') {
    return (
      <span aria-hidden style={{ width: size, height: size }}
        className="rounded-full bg-amber-500 text-white flex items-center justify-center flex-shrink-0">
        <AlertCircle size={icon} strokeWidth={3} />
      </span>
    );
  }
  return (
    <span aria-hidden style={{ width: size, height: size }}
      className="rounded-full bg-white border-2 border-[#D1D5DB] flex-shrink-0" />
  );
}

const SUB_TONE = {
  muted: 'text-[#9CA3AF]',
  strong: 'text-[#111827] font-semibold',
  amber: 'text-amber-700 font-bold',
  red: 'text-red-600 font-bold',
};

export function PayTimeline({ timeline, tz, compact = false }: {
  timeline: PayTimelineData;
  /** The shift's IANA zone — stamps are shown in it. */
  tz?: string | null;
  /** Dots and labels only (Earnings rows). */
  compact?: boolean;
}) {
  const steps = timelineSteps(timeline, tz);
  const size = compact ? 14 : 20;
  const stateWord = (s: StepState) => (s === 'done' ? 'done' : s === 'attention' ? 'needs your review' : 'pending');
  return (
    <ol className="flex items-start w-full" aria-label="Pay timeline">
      {steps.map((s, i) => {
        const prevDone = i > 0 && steps[i - 1].state !== 'pending';
        const lineIn = i > 0 ? (prevDone && s.state !== 'pending' ? 'bg-[#15803D]' : 'bg-[#E5E7EB]') : 'bg-transparent';
        const nextReached = i < steps.length - 1 && s.state !== 'pending' && steps[i + 1].state !== 'pending';
        const lineOut = i < steps.length - 1 ? (nextReached ? 'bg-[#15803D]' : 'bg-[#E5E7EB]') : 'bg-transparent';
        return (
          <li key={s.key} className="flex-1 min-w-0 flex flex-col items-center"
            aria-label={`${s.label}: ${stateWord(s.state)}${!compact && s.sub ? `, ${s.sub}` : ''}`}>
            <div className="flex items-center w-full">
              <span aria-hidden className={`flex-1 h-[2px] ${lineIn}`} />
              <Dot state={s.state} size={size} />
              <span aria-hidden className={`flex-1 h-[2px] ${lineOut}`} />
            </div>
            <p className={`${compact ? 'text-[10px] mt-1' : 'text-[12px] mt-1.5'} font-semibold leading-tight ${
              s.state === 'pending' ? 'text-[#9CA3AF]' : s.state === 'attention' ? 'text-amber-700' : 'text-[#111827]'}`}>
              {s.label}
            </p>
            {!compact && (
              <p className={`text-[11px] mt-0.5 leading-snug text-center px-1 ${SUB_TONE[s.subTone ?? 'muted']}`}>
                {s.sub}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
