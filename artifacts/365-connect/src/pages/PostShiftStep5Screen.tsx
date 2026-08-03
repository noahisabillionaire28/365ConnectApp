/**
 * Step 5 of 5 — Review & Post
 * Summary of all wizard data, platform fee breakdown, and the Post Shift button
 * that writes a real row to the shifts table and navigates to the new shift detail.
 */
import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
  ChevronLeft, Briefcase, MapPin, Calendar, Clock,
  Users, DollarSign, FileText, CheckCircle2, AlertCircle,
} from 'lucide-react';
import {
  getDraft, resetDraft, getEditShiftId,
  durationHours, durationLabel, fmt12h, fmtDate, buildIso,
} from '@/store/postShiftStore';
import { usePostShift } from '@/hooks/usePostShift';
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
  const updateMutation    = useUpdateShift();
  const editId            = getEditShiftId();
  const isEditing         = !!editId;
  const { showToast }     = useToast();
  const [postError, setPostError] = useState<string | null>(null);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const durHrs   = durationHours(draft.start_time, draft.end_time);
  const durLabel = durationLabel(draft.start_time, draft.end_time);
  const grossCost    = draft.pay_rate * draft.spots_available * durHrs;
  const platformFee  = grossCost * 0.08;
  const totalCost    = grossCost + platformFee;

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

    const start_time = buildIso(draft.date, draft.start_time);
    const end_time   = buildIso(draft.date, draft.end_time, draft.start_time);

    if (!start_time || !end_time) {
      setPostError('Invalid date or time — please go back and fix Step 3.');
      return;
    }

    try {
      if (isEditing && editId) {
        await updateMutation.mutateAsync({
          id:              editId,
          title:           draft.title,
          job_type:        draft.job_type,
          job_types:       [draft.job_type],
          location:        draft.location  || undefined,
          lat:             draft.lat       || undefined,
          lng:             draft.lng       || undefined,
          unit_info:       draft.unit_info || undefined,
          start_time,
          end_time,
          spots_available: draft.spots_available,
          pay_rate:        draft.pay_rate,
          description:     draft.description || undefined,
          requirements:    draft.requirements.length ? draft.requirements : undefined,
        });
        resetDraft();
        showToast('Shift updated!');
        navigate(`/shift/${editId}`);
      } else {
        const data = await postMutation.mutateAsync({
          client_id:       user.id,
          title:           draft.title,
          job_type:        draft.job_type,
          job_types:       [draft.job_type],
          location:        draft.location  || undefined,
          lat:             draft.lat       || undefined,
          lng:             draft.lng       || undefined,
          unit_info:       draft.unit_info || undefined,
          start_time,
          end_time,
          spots_available: draft.spots_available,
          pay_rate:        draft.pay_rate,
          description:     draft.description || undefined,
          requirements:    draft.requirements.length ? draft.requirements : undefined,
        });
        resetDraft();
        showToast('Shift posted! Workers will start applying soon.');
        if (data) navigate(`/shift/${data.id}`);
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
          <div className="flex-1"><StepBar current={5} total={5} /></div>
          <span className="text-[#6B7280] text-[12px] font-semibold flex-shrink-0">5 of 5</span>
        </div>
        <h1 className="text-[#111827] font-bold text-[22px] tracking-tight">
          {isEditing ? 'Review changes' : 'Review & post'}
        </h1>
        <p className="text-[#6B7280] text-[13px] mt-0.5">
          {isEditing ? 'Confirm your edits before saving' : 'Confirm your shift details before going live'}
        </p>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-40">

        {/* Summary card */}
        <div className="bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-1 mb-4">
          <SummaryRow
            icon={<Briefcase size={15} aria-hidden className="text-[#0A1628]" />}
            label="Job type"
            value={draft.job_type || '—'}
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
            label="Date"
            value={draft.date ? fmtDate(draft.date) : '—'}
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
            value={String(draft.spots_available)}
          />
          <SummaryRow
            icon={<DollarSign size={15} aria-hidden className="text-[#0A1628]" />}
            label="Pay rate"
            value={draft.pay_rate > 0 ? `$${draft.pay_rate.toFixed(2)}/hr` : '—'}
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
              label={`${draft.spots_available} worker${draft.spots_available !== 1 ? 's' : ''} × ${durLabel} × $${draft.pay_rate}/hr`}
              value={`$${grossCost.toFixed(2)}`}
              muted
            />
            <CostRow label="Platform fee (8%)" value={`$${platformFee.toFixed(2)}`} muted />
            <div className="border-t border-[#E5E7EB] my-2" />
            <CostRow label="Total Estimated Cost" value={`$${totalCost.toFixed(2)}`} highlight />
            <p className="text-[#9CA3AF] text-[11px] mt-3 leading-relaxed">
              Estimated total based on listed hours. Final cost may vary if shift hours change.
              Workers are paid after successful clock-out confirmation.
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
      <div className="fixed bottom-[56px] left-1/2 -translate-x-1/2 w-full max-w-[390px] px-5 pb-4 pt-4
        bg-gradient-to-t from-[#F7F8FA] via-[#F7F8FA]/95 to-transparent z-20">
        <motion.button
          type="button" whileTap={{ scale: 0.97 }}
          onClick={handlePost}
          disabled={(isEditing ? updateMutation.isPending : postMutation.isPending) || !allReady}
          aria-disabled={(isEditing ? updateMutation.isPending : postMutation.isPending) || !allReady}
          aria-label={isEditing ? 'Save shift changes' : 'Post this shift and make it live'}
          aria-busy={isEditing ? updateMutation.isPending : postMutation.isPending}
          className={`w-full h-[52px] rounded-[12px] font-bold text-[16px] transition-all flex items-center justify-center gap-2.5 ${
            (isEditing ? updateMutation.isPending : postMutation.isPending) || !allReady
              ? 'bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed'
              : 'bg-[#0A1628] text-white'
          }`}
        >
          {(isEditing ? updateMutation.isPending : postMutation.isPending) ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden />
              {isEditing ? 'Saving…' : 'Posting…'}
            </>
          ) : (
            isEditing ? 'Save Changes →' : 'Post Shift →'
          )}
        </motion.button>
        <p className="text-center text-[#9CA3AF] text-[11px] mt-2">
          {isEditing ? 'Changes apply immediately' : 'Your shift goes live immediately'}
        </p>
      </div>

      <BottomTabNav />
    </div>
  );
}
