import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
  ChevronLeft, Briefcase, Calendar, MapPin, DollarSign,
  Users, Clock, Shirt, User, CheckCircle2, Repeat2,
} from 'lucide-react';
import { getDraft, resetDraft, totalWorkers, durationHours, durationLabel, buildIsoDateTimes } from '@/store/postShiftStore';
import { usePostShift } from '@/hooks/usePostShift';
import { supabase } from '@/lib/supabase';
import { JOB_TEMPLATES } from '@/data/postShiftTemplates';

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

function SectionRow({ icon, label, value, sub }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[#DBDBDB] last:border-0">
      <div className="w-7 h-7 rounded-[8px] bg-[#F5F5F5] border border-[#DBDBDB] flex items-center justify-center flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[#737373] text-[11px] font-semibold uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-black text-[14px] font-medium leading-snug">{value}</p>
        {sub && <p className="text-[#737373] text-[12px] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function CostRow({ label, value, highlight, sub }: { label: string; value: string; highlight?: boolean; sub?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${sub ? 'opacity-60' : ''}`}>
      <p className={`text-[${sub ? '12' : '14'}px] ${highlight ? 'text-black font-bold text-[16px]' : 'text-[#737373]'}`}>
        {label}
      </p>
      <p className={`font-${highlight ? 'bold' : 'medium'} text-[${highlight ? '20' : '14'}px] ${highlight ? 'text-black' : 'text-[#737373]'}`}>
        {value}
      </p>
    </div>
  );
}

export function PostShiftStep5Screen() {
  const [, navigate]      = useLocation();
  const draft             = getDraft();
  const postShiftMutation = usePostShift();
  const [postError, setPostError] = useState<string | null>(null);

  const totalW      = totalWorkers(draft.workerCounts);
  const durHours    = durationHours(draft.startTime, draft.endTime);
  const durLabel    = durationLabel(draft.startTime, draft.endTime);
  const grossCost   = draft.payRate * totalW * durHours;
  const platformFee = grossCost * 0.08;
  const totalCost   = grossCost + platformFee;

  function fmtTime(hhmm: string) {
    if (!hhmm) return '';
    const [h, m] = hhmm.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12  = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  function fmtDate(iso: string) {
    if (!iso) return '';
    const d = new Date(`${iso}T12:00:00`);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  const repeatLabel: Record<string, string> = { once: 'One-time', weekly: 'Weekly', custom: 'Custom' };

  async function handlePost() {
    setPostError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPostError('You must be signed in to post a shift.'); return; }

    const { startIso, endIso } = buildIsoDateTimes(draft.date, draft.startTime, draft.endTime);
    if (!startIso || !endIso) { setPostError('Invalid date or time — please go back and fix Step 2.'); return; }

    const primaryType    = draft.jobTypes[0] ?? 'Event Staff';
    const template       = JOB_TEMPLATES.find((t) => t.label === primaryType);
    const dressCodeItems = template?.dressCodeItems ?? [];

    try {
      await postShiftMutation.mutateAsync({
        client_id:   user.id,
        title:       draft.jobTypes.length === 1
          ? `${primaryType}${draft.location ? ` — ${draft.location.split(',')[0]}` : ''}`
          : `${draft.jobTypes.join(' + ')} — ${draft.location.split(',')[0] || 'Event'}`,
        job_type:    primaryType,
        job_types:   draft.jobTypes,
        company_name: undefined,
        description:  draft.description   || undefined,
        location:     draft.location      || undefined,
        lat:          draft.lat           || undefined,
        lng:          draft.lng           || undefined,
        unit_info:    draft.unit          || undefined,
        parking_notes: draft.parkingNotes || undefined,
        hourly_rate:  draft.payRate,
        start_time:   startIso,
        end_time:     endIso,
        spots:        totalW,
        dress_code:   draft.dressCode     || undefined,
        dress_code_items: dressCodeItems,
        point_of_contact: draft.contactName || undefined,
        contact_phone: draft.contactPhone  || undefined,
        special_instructions: draft.specialInstructions || undefined,
        repeat_type:  draft.repeat,
      });
      resetDraft();
      navigate('/jobs');
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Failed to post shift. Try again.');
    }
  }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <div className="px-5 pt-5 pb-4 border-b border-[#DBDBDB]">
        <div className="flex items-center gap-3 mb-4">
          <button type="button" aria-label="Back to shift details" onClick={() => navigate('/post-shift/step4')}
            className="w-9 h-9 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center flex-shrink-0">
            <ChevronLeft size={18} aria-hidden className="text-black" />
          </button>
          <div className="flex-1"><StepBar current={5} total={5} /></div>
          <span className="text-[#737373] text-[12px] font-medium flex-shrink-0">5 of 5</span>
        </div>
        <h1 className="text-black font-bold text-[22px] tracking-tight">Review & Post</h1>
        <p className="text-[#737373] text-[13px] mt-1">Confirm your shift details before going live</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-36">
        {/* Shift summary card */}
        <section className="bg-[#FAFAFA] border border-[#DBDBDB] rounded-[12px] px-4 py-2 mb-5" aria-label="Shift summary">
          <SectionRow icon={<Briefcase size={13} aria-hidden className="text-[#737373]" />} label="Roles"
            value={draft.jobTypes.join(' · ') || '—'}
            sub={Object.entries(draft.workerCounts).map(([t, n]) => `${n}× ${t}`).join('  ') || undefined} />
          <SectionRow icon={<Calendar size={13} aria-hidden className="text-[#737373]" />} label="Date"
            value={draft.date ? fmtDate(draft.date) : '—'} />
          <SectionRow icon={<Clock size={13} aria-hidden className="text-[#737373]" />} label="Time"
            value={draft.startTime ? `${fmtTime(draft.startTime)} – ${fmtTime(draft.endTime)}` : '—'}
            sub={durLabel !== '—' ? `${durLabel} shift` : undefined} />
          <SectionRow icon={<Repeat2 size={13} aria-hidden className="text-[#737373]" />} label="Repeat"
            value={repeatLabel[draft.repeat] ?? 'One-time'} />
          <SectionRow icon={<MapPin size={13} aria-hidden className="text-[#737373]" />} label="Location"
            value={draft.location || '—'} sub={draft.unit || undefined} />
          <SectionRow icon={<DollarSign size={13} aria-hidden className="text-[#737373]" />} label="Pay Rate"
            value={draft.payRate ? `$${draft.payRate}/hr` : '—'} />
          <SectionRow icon={<Users size={13} aria-hidden className="text-[#737373]" />} label="Total Workers"
            value={String(totalW)} />
          {draft.dressCode && (
            <SectionRow icon={<Shirt size={13} aria-hidden className="text-[#737373]" />} label="Dress Code"
              value={draft.dressCode} />
          )}
          <SectionRow icon={<User size={13} aria-hidden className="text-[#737373]" />} label="Contact"
            value={draft.contactName || '—'} sub={draft.contactPhone || undefined} />
        </section>

        {/* Cost breakdown */}
        <section className="bg-[#FAFAFA] border border-[#DBDBDB] rounded-[12px] px-5 py-4 mb-5" aria-label="Estimated cost">
          <p className="text-[#737373] text-[10px] font-bold uppercase tracking-[0.2em] mb-4">Estimated Cost</p>
          <div className="flex flex-col gap-3">
            <CostRow label={`$${draft.payRate}/hr × ${totalW} worker${totalW !== 1 ? 's' : ''} × ${durLabel}`}
              value={`$${grossCost.toFixed(2)}`} />
            <CostRow label="365 Platform Fee (8%)" value={`+$${platformFee.toFixed(2)}`} sub />
            <div className="h-px bg-[#DBDBDB] my-1" />
            <CostRow label="Total Estimated Cost" value={`$${totalCost.toFixed(2)}`} highlight />
          </div>
          <p className="text-[#AAAAAA] text-[11px] mt-4 leading-relaxed">
            Final cost may vary if shift hours change. Workers are paid after successful clock-out confirmation.
          </p>
        </section>

        {/* Readiness checklist */}
        <section className="bg-[#FAFAFA] border border-[#DBDBDB] rounded-[12px] px-5 py-4 mb-6" aria-label="Readiness checklist">
          {[
            { label: 'Job type(s) selected',  done: draft.jobTypes.length > 0 },
            { label: 'Date and time set',      done: !!draft.date && !!draft.startTime },
            { label: 'Location provided',      done: !!draft.location.trim() },
            { label: 'Pay rate entered',       done: draft.payRate > 0 },
            { label: 'Contact name provided',  done: !!draft.contactName.trim() },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3 py-1.5">
              <CheckCircle2 size={15} aria-hidden
                className={item.done ? 'text-emerald-500' : 'text-[#DBDBDB]'} />
              <span className={`text-[13px] ${item.done ? 'text-[#737373]' : 'text-[#AAAAAA]'}`}>
                {item.label}
              </span>
            </div>
          ))}
        </section>

        {postError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-[12px] px-4 py-3" role="alert">
            <p className="text-red-600 text-[13px] font-medium">{postError}</p>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] px-5 pb-9 pt-4 bg-gradient-to-t from-white via-white/95 to-transparent z-10 border-t border-[#DBDBDB]">
        <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={handlePost}
          disabled={postShiftMutation.isPending}
          aria-label="Post shift and make it live" aria-busy={postShiftMutation.isPending}
          className={`w-full h-[52px] rounded-[8px] font-bold text-[16px] transition-all flex items-center justify-center gap-2.5 ${
            postShiftMutation.isPending ? 'bg-black/40 text-white/60 cursor-not-allowed' : 'bg-black text-white'
          }`}>
          {postShiftMutation.isPending ? (
            <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden />Posting…</>
          ) : 'Post Shift →'}
        </motion.button>
        <p className="text-center text-[#AAAAAA] text-[11px] mt-2">Your shift goes live immediately</p>
      </div>
    </div>
  );
}
