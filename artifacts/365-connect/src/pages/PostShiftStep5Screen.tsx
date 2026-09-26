/**
 * Step 7 of 7 — Review & Post
 * Summary of all wizard data, platform fee breakdown, and the Post Shift button
 * that writes a real row to the shifts table and navigates to the new shift detail.
 */
import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
  ChevronLeft, Briefcase, MapPin, Calendar, Clock,
  Users, DollarSign, FileText, CheckCircle2, AlertCircle, PartyPopper, Repeat2,
} from 'lucide-react';
import {
  getDraft, resetDraft, getEditShiftId, getEditInSeries, rememberLastPosted, draftToTemplatePayload,
  durationHours, durationLabel, fmt12h, fmtDate, buildIso,
} from '@/store/postShiftStore';
import { browserTimeZone } from '@/lib/timezone';
import { expandOccurrences, summarizeSeries, describeRule, shortDate } from '@/lib/recurrence';
import { usePostShift } from '@/hooks/usePostShift';
import { usePostShiftSeries } from '@/hooks/useShiftSeries';
import { useUpdateShift } from '@/hooks/useUpdateShift';
import { useAuth } from '@/contexts/AuthContext';
import { BottomTabNav } from '@/components/BottomTabNav';
import { useToast } from '@/contexts/ToastContext';

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

// ─── Summary row ──────────────────────────────────────────────────────────────
function SummaryRow({
  icon, label, value, sub,
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-[#F3F4F6] last:border-0">
      <div className="w-8 h-8 rounded-[9px] bg-[#F0F4FF] flex items-center justify-center flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[#9CA3AF] text-[11px] font-semibold uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-[#111827] text-[14px] font-semibold leading-snug break-words">{value}</p>
        {sub && <p className="text-[#6B7280] text-[12px] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Cost row ─────────────────────────────────────────────────────────────────
function CostRow({
  label, value, highlight, muted,
}: {
  label: string; value: string; highlight?: boolean; muted?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${muted ? 'opacity-60' : ''}`}>
      <p className={`text-[14px] ${highlight ? 'text-[#111827] font-bold' : 'text-[#6B7280]'}`}>
        {label}
      </p>
      <p className={`font-bold tabular-nums ${
        highlight ? 'text-[#0A1628] text-[20px]' : 'text-[#6B7280] text-[14px]'
      }`}>
        {value}
      </p>
    </div>
  );
}

// ─── Readiness check item ─────────────────────────────────────────────────────
function ReadinessItem({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      {done
        ? <CheckCircle2 size={15} aria-hidden className="text-[#10B981] flex-shrink-0" />
        : <AlertCircle  size={15} aria-hidden className="text-[#9CA3AF] flex-shrink-0" />}
      <span className={`text-[13px] ${done ? 'text-[#374151]' : 'text-[#9CA3AF]'}`}>{label}</span>
    </div>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export function PostShiftStep5Screen() {
  const [, navigate]      = useLocation();
  const { user }          = useAuth();
  const draft             = getDraft();
  const postMutation      = usePostShift();
  const seriesMutation    = usePostShiftSeries();
  const updateMutation    = useUpdateShift();
  const editId            = getEditShiftId();
  const isEditing         = !!editId;
  const editInSeries      = isEditing && getEditInSeries();
  const { showToast }     = useToast();
  const [postError, setPostError] = useState<string | null>(null);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const durHrs   = durationHours(draft.start_time, draft.end_time);
  const durLabel = durationLabel(draft.start_time, draft.end_time);
  // Recurrence: every date the wizard will create a shift for.
  const occurrences = isEditing ? [draft.date] : expandOccurrences(draft.date, draft.repeat);
  const isSeries    = !isEditing && draft.repeat.type !== 'none' && occurrences.length > 1;
  const shiftCount  = isSeries ? occurrences.length : 1;
  // Hourly shifts multiply by the hours; a day / event rate is flat per worker.
  const hourly       = draft.pay_period === 'hr';
  const perShiftCost = hourly ? draft.pay_rate * draft.spots_available * durHrs : draft.pay_rate * draft.spots_available;
  const grossCost    = perShiftCost * shiftCount;
  const platformFee  = 0; // platform fee removed for now
  const totalCost    = grossCost + platformFee;
  const rateLabel    = hourly ? `$${draft.pay_rate.toFixed(2)}/hr` : `$${draft.pay_rate.toFixed(2)} per ${draft.pay_period}`;
  const isPosting    = isEditing ? updateMutation.isPending : (isSeries ? seriesMutation.isPending : postMutation.isPending);

  const readiness = [
    { label: 'Job type selected',    done: !!draft.job_type },
    { label: 'Shift title entered',  done: draft.title.trim().length >= 3 },
    { label: 'Location provided',    done: !!draft.location.trim() },
    { label: 'Date set',             done: !!draft.date },
    { label: 'Times set',            done: !!draft.start_time && !!draft.end_time && durHrs >= 0.5 },
    { label: 'Pay rate entered',     done: draft.pay_rate > 0 },
  ];
  const allReady = readiness.every((r) => r.done);

  // ── Post shift ───────────────────────────────────────────────────────────────
  async function handlePost() {
    setPostError(null);

    if (!user) {
      setPostError('You must be signed in to post a shift.');
      return;
    }

    // The venue's zone. A new shift uses the poster's device zone (venues are
    // posted locally); an edit keeps the zone the shift was posted with, so
    // editing from another zone never rewrites the venue's wall-clock times.
    const timezone   = (isEditing && draft.timezone) || browserTimeZone();
    const start_time = buildIso(draft.date, draft.start_time, undefined, timezone);
    const end_time   = buildIso(draft.date, draft.end_time, draft.start_time, timezone);

    if (!start_time || !end_time) {
      setPostError('Invalid date or time — please go back and fix Step 3.');
      return;
    }

    // Day-of details only travel when set (templates and re-posts carry them).
    const extras = {
      dress_code_items:     draft.dress_code_items.length ? draft.dress_code_items : undefined,
      point_of_contact:     draft.point_of_contact     || undefined,
      contact_phone:        draft.contact_phone        || undefined,
      parking_notes:        draft.parking_notes        || undefined,
      special_instructions: draft.special_instructions || undefined,
    };
    const fields = {
      title:           draft.title,
      event_type:      draft.event_type || null,
      job_type:        draft.job_type,
      job_types:       draft.job_types.length ? draft.job_types : [draft.job_type],
      location:        draft.location  || undefined,
      lat:             draft.lat       || undefined,
      lng:             draft.lng       || undefined,
      unit_info:       draft.unit_info || undefined,
      start_time,
      end_time,
      timezone,
      spots_available: draft.spots_available,
      pay_rate:        draft.pay_rate,
      pay_period:      draft.pay_period,
      description:     draft.description || undefined,
      requirements:    draft.requirements.length ? draft.requirements : undefined,
      instant_claim:   draft.instant_claim,
      visibility:      draft.visibility,
      ...extras,
    };

    try {
      if (isEditing && editId) {
        await updateMutation.mutateAsync({ id: editId, ...fields });
        resetDraft();
        showToast('Shift updated!');
        navigate(`/shift/${editId}`);
      } else if (isSeries) {
        const { type, weekdays, ends, end_date, count } = draft.repeat;
        const out = await seriesMutation.mutateAsync({
          client_id: user.id,
          ...fields,
          occurrences,
          rule: type === 'none' ? undefined : { type, weekdays, ends, end_date, count },
        });
        rememberLastPosted(draftToTemplatePayload({ ...draft, timezone }));
        resetDraft();
        const first = out.shifts[0];
        navigate(`/post-shift/success?series=${out.series_id}&count=${out.shifts.length}${first ? `&id=${first.id}` : ''}`);
      } else {
        const data = await postMutation.mutateAsync({ client_id: user.id, ...fields });
        rememberLastPosted(draftToTemplatePayload({ ...draft, timezone }));
        resetDraft();
        if (data) navigate(`/post-shift/success?id=${data.id}`);
        else navigate('/home');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setPostError(msg);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[#F7F8FA] flex flex-col pb-[72px]">

      {/* Header */}
      <div className="bg-white px-5 pt-5 pb-4 border-b border-[#E5E7EB] sticky top-0 z-30">
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button" aria-label="Back to pay and details"
            onClick={() => navigate('/post-shift/step4')}
            className="w-9 h-9 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft size={18} aria-hidden className="text-[#111827]" />
          </button>
          <div className="flex-1"><StepBar current={7} total={7} /></div>
          <span className="text-[#6B7280] text-[12px] font-semibold flex-shrink-0">7 of 7</span>
        </div>
        <h1 className="text-[#111827] font-bold text-[22px] tracking-tight">
          {isEditing ? 'Review changes' : 'Review & post'}
        </h1>
        <p className="text-[#6B7280] text-[13px] mt-0.5">
          {isEditing
            ? 'Confirm your edits before saving'
            : isSeries ? `Confirm the details for all ${shiftCount} shifts` : 'Confirm your shift details before going live'}
        </p>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-40">

        {/* An edit inside a recurring series never touches the siblings */}
        {editInSeries && (
          <div className="mb-4 bg-[#F0F4FF] border border-[#D1D9F0] rounded-[12px] px-4 py-3 flex items-start gap-2.5">
            <Repeat2 size={15} aria-hidden className="text-[#0A1628] mt-0.5 flex-shrink-0" />
            <p className="text-[#0A1628] text-[13px] leading-snug">
              <span className="font-bold">Only this shift</span> changes. The other shifts in the series stay as they are.
            </p>
          </div>
        )}

        {/* Series dates */}
        {isSeries && (
          <div className="bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-4 mb-4" data-testid="series-review">
            <div className="flex items-center gap-2 mb-1">
              <Repeat2 size={15} aria-hidden className="text-[#0A1628]" />
              <p className="text-[#111827] font-bold text-[15px]">{summarizeSeries(occurrences)}</p>
            </div>
            <p className="text-[#6B7280] text-[12px] mb-3">
              {describeRule(draft.repeat)} · {draft.spots_available} spot{draft.spots_available === 1 ? '' : 's'} × {shiftCount} dates = {draft.spots_available * shiftCount} spots in total
            </p>
            <div className="flex flex-wrap gap-1.5">
              {occurrences.map((d) => (
                <span key={d} className="h-8 px-3 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] text-[#111827] text-[12px] font-semibold inline-flex items-center">
                  {shortDate(d)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Summary card */}
        <div className="bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-1 mb-4">
          <SummaryRow
            icon={<PartyPopper size={15} aria-hidden className="text-[#0A1628]" />}
            label="Event type"
            value={draft.event_type || '—'}
          />
          <SummaryRow
            icon={<Briefcase size={15} aria-hidden className="text-[#0A1628]" />}
            label={draft.job_types.length > 1 ? 'Job types' : 'Job type'}
            value={(draft.job_types.length ? draft.job_types : [draft.job_type]).filter(Boolean).join(', ') || '—'}
            sub={draft.title || undefined}
          />
          <SummaryRow
            icon={<MapPin size={15} aria-hidden className="text-[#0A1628]" />}
            label="Location"
            value={draft.location || '—'}
            sub={draft.unit_info || undefined}
          />
          <SummaryRow
            icon={<Calendar size={15} aria-hidden className="text-[#0A1628]" />}
            label={isSeries ? 'First date' : 'Date'}
            value={draft.date ? fmtDate(draft.date) : '—'}
            sub={isSeries ? `${shiftCount} dates, ending ${shortDate(occurrences[occurrences.length - 1])}` : undefined}
          />
          <SummaryRow
            icon={<Clock size={15} aria-hidden className="text-[#0A1628]" />}
            label="Time"
            value={draft.start_time && draft.end_time
              ? `${fmt12h(draft.start_time)} – ${fmt12h(draft.end_time)}`
              : '—'}
            sub={durHrs > 0 ? durLabel : undefined}
          />
          <SummaryRow
            icon={<Users size={15} aria-hidden className="text-[#0A1628]" />}
            label="Spots available"
            value={isSeries ? `${draft.spots_available} per shift` : String(draft.spots_available)}
            sub={isSeries ? `${draft.spots_available * shiftCount} across ${shiftCount} dates` : undefined}
          />
          <SummaryRow
            icon={<DollarSign size={15} aria-hidden className="text-[#0A1628]" />}
            label="Pay rate"
            value={draft.pay_rate > 0 ? rateLabel : '—'}
          />
          {draft.description && (
            <SummaryRow
              icon={<FileText size={15} aria-hidden className="text-[#6B7280]" />}
              label="Description"
              value={draft.description.length > 120
                ? draft.description.slice(0, 120) + '…'
                : draft.description}
            />
          )}
        </div>

        {/* Cost estimate */}
        {grossCost > 0 && (
          <div className="bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-4 mb-4">
            <p className="text-[#111827] font-bold text-[15px] mb-3">Estimated Cost</p>
            <CostRow
              label={hourly
                ? `${draft.spots_available} worker${draft.spots_available !== 1 ? 's' : ''} × ${durLabel} × $${draft.pay_rate}/hr`
                : `${draft.spots_available} worker${draft.spots_available !== 1 ? 's' : ''} × $${draft.pay_rate} per ${draft.pay_period}`}
              value={`$${perShiftCost.toFixed(2)}`}
              muted
            />
            {isSeries && (
              <CostRow label={`× ${shiftCount} shifts`} value={`$${grossCost.toFixed(2)}`} muted />
            )}
            <div className="border-t border-[#E5E7EB] my-2" />
            <CostRow label="Total Estimated Cost" value={`$${totalCost.toFixed(2)}`} highlight />
            <p className="text-[#9CA3AF] text-[11px] mt-3 leading-relaxed">
              {hourly
                ? 'Estimated total based on listed hours. Final cost may vary if shift hours change.'
                : 'Flat rate per worker. Final cost depends on how many spots are filled.'}
              {' '}Workers are paid after successful clock-out confirmation.
            </p>
          </div>
        )}

        {/* Readiness checklist */}
        <div className="bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-3 mb-4">
          <p className="text-[#111827] font-bold text-[14px] mb-1">Checklist</p>
          {readiness.map((r) => (
            <ReadinessItem key={r.label} label={r.label} done={r.done} />
          ))}
        </div>

        {/* Error */}
        {postError && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className="mb-4 bg-red-50 border border-red-200 rounded-[12px] px-4 py-3"
            role="alert"
          >
            <p className="text-[#EF4444] text-[13px] font-medium">{postError}</p>
          </motion.div>
        )}

      </div>

      {/* Fixed CTA */}
      <div className="fixed bottom-[56px] left-1/2 -translate-x-1/2 w-full max-w-app px-5 pb-4 pt-4
        bg-gradient-to-t from-[#F7F8FA] via-[#F7F8FA]/95 to-transparent z-20">
        <motion.button
          type="button" whileTap={{ scale: 0.97 }}
          onClick={handlePost}
          disabled={isPosting || !allReady}
          aria-disabled={isPosting || !allReady}
          aria-label={isEditing ? 'Save shift changes' : isSeries ? `Post ${shiftCount} shifts and make them live` : 'Post this shift and make it live'}
          aria-busy={isPosting}
          className={`w-full h-[52px] rounded-[12px] font-bold text-[16px] transition-all flex items-center justify-center gap-2.5 ${
            isPosting || !allReady
              ? 'bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed'
              : 'bg-[#0A1628] text-white'
          }`}
        >
          {isPosting ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden />
              {isEditing ? 'Saving…' : 'Posting…'}
            </>
          ) : (
            isEditing ? 'Save Changes →' : isSeries ? `Post ${shiftCount} shifts →` : 'Post Shift →'
          )}
        </motion.button>
        <p className="text-center text-[#9CA3AF] text-[11px] mt-2">
          {isEditing ? 'Changes apply immediately' : isSeries ? `All ${shiftCount} shifts go live immediately` : 'Your shift goes live immediately'}
        </p>
      </div>

      <BottomTabNav />
    </div>
  );
}
