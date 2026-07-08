import { useState } from 'react';
import { useLocation } from 'wouter';
import {
  Briefcase, Calendar, Clock, MapPin, DollarSign,
  Users, Shirt, User, CheckCircle2,
} from 'lucide-react';
import {
  StepHeader, SectionRow,
} from '@/components/WizardShared';
import { motion } from 'framer-motion';
import { getStafferDraft, resetStafferDraft } from '@/store/stafferPostShiftStore';
import { durationLabel, buildIsoDateTimes } from '@/store/postShiftStore';
import { usePostShift } from '@/hooks/usePostShift';
import { supabase } from '@/lib/supabase';

/* ── Helpers ──────────────────────────────────────────────────────────────── */
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

/* ── Screen ───────────────────────────────────────────────────────────────── */
export function StafferPostStep7Screen() {
  const [, navigate]      = useLocation();
  const draft             = getStafferDraft();
  const postMutation      = usePostShift();
  const [postError, setPostError] = useState<string | null>(null);

  const durLabel = durationLabel(draft.startTime, draft.endTime);

  /* Readiness checks */
  const checks = [
    { label: 'Job title entered',      done: draft.title.trim().length >= 2 },
    { label: 'Job type(s) selected',   done: draft.jobTypes.length > 0 },
    { label: 'Date and time set',      done: !!draft.date && !!draft.startTime },
    { label: 'Location provided',      done: !!draft.location.trim() },
    { label: 'Pay rate entered',       done: draft.payRate > 0 },
    { label: 'Contact name provided',  done: !!draft.contactName.trim() },
  ];
  const allReady = checks.every((c) => c.done);

  async function handlePost() {
    setPostError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPostError('You must be signed in to post a shift.'); return; }

    const { startIso, endIso } = buildIsoDateTimes(draft.date, draft.startTime, draft.endTime);
    if (!startIso || !endIso) {
      setPostError('Invalid date or time — go back and fix Step 3.');
      return;
    }

    try {
      await postMutation.mutateAsync({
        client_id:        user.id,
        title:            draft.title,
        job_type:         draft.jobTypes[0] ?? 'Event Staff',
        job_types:        draft.jobTypes,
        description:      draft.description   || undefined,
        location:         draft.location      || undefined,
        lat:              draft.lat           || undefined,
        lng:              draft.lng           || undefined,
        pay_rate:         draft.payRate,
        start_time:       startIso,
        end_time:         endIso,
        spots:            draft.workersNeeded,
        dress_code:       draft.dressCode     || undefined,
        point_of_contact: draft.contactName   || undefined,
        contact_phone:    draft.contactPhone  || undefined,
        repeat_type:      'once',
      });
      resetStafferDraft();
      navigate('/jobs');
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Failed to post shift. Try again.');
    }
  }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <StepHeader
        current={7} total={7}
        title="Review & Post"
        subtitle="Confirm your shift details before going live"
        onBack={() => navigate('/staffer-shift/step6')}
      />

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-36">

        {/* Summary card */}
        <section className="bg-[#FAFAFA] border border-[#DBDBDB] rounded-[12px] px-4 py-2 mb-5" aria-label="Shift summary">
          <SectionRow
            icon={<Briefcase size={13} aria-hidden className="text-[#737373]" />}
            label="Title"
            value={draft.title || '—'}
          />
          <SectionRow
            icon={<Briefcase size={13} aria-hidden className="text-[#737373]" />}
            label="Job type(s)"
            value={draft.jobTypes.join(' · ') || '—'}
          />
          <SectionRow
            icon={<Calendar size={13} aria-hidden className="text-[#737373]" />}
            label="Date"
            value={draft.date ? fmtDate(draft.date) : '—'}
          />
          <SectionRow
            icon={<Clock size={13} aria-hidden className="text-[#737373]" />}
            label="Time"
            value={draft.startTime
              ? `${fmtTime(draft.startTime)} – ${fmtTime(draft.endTime)}`
              : '—'}
            sub={durLabel !== '—' ? `${durLabel} shift` : undefined}
          />
          <SectionRow
            icon={<MapPin size={13} aria-hidden className="text-[#737373]" />}
            label="Location"
            value={draft.location || '—'}
          />
          <SectionRow
            icon={<DollarSign size={13} aria-hidden className="text-[#737373]" />}
            label="Pay rate"
            value={draft.payRate ? `$${draft.payRate}/hr` : '—'}
          />
          <SectionRow
            icon={<Users size={13} aria-hidden className="text-[#737373]" />}
            label="Workers needed"
            value={String(draft.workersNeeded)}
          />
          {draft.dressCode && (
            <SectionRow
              icon={<Shirt size={13} aria-hidden className="text-[#737373]" />}
              label="Dress code"
              value={draft.dressCode}
            />
          )}
          <SectionRow
            icon={<User size={13} aria-hidden className="text-[#737373]" />}
            label="Contact"
            value={draft.contactName || '—'}
            sub={draft.contactPhone || undefined}
          />
        </section>

        {/* Readiness checklist */}
        <section className="bg-[#FAFAFA] border border-[#DBDBDB] rounded-[12px] px-5 py-4 mb-5" aria-label="Readiness checklist">
          <p className="text-[#737373] text-[10px] font-bold uppercase tracking-[0.2em] mb-3">Checklist</p>
          {checks.map((item) => (
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

      {/* Post button */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] px-5 pb-9 pt-4 bg-gradient-to-t from-white via-white/95 to-transparent z-10 border-t border-[#DBDBDB]">
        <motion.button
          type="button" whileTap={{ scale: postMutation.isPending ? 1 : 0.97 }}
          onClick={handlePost}
          disabled={postMutation.isPending || !allReady}
          aria-label="Post shift and make it live"
          aria-busy={postMutation.isPending}
          className={`w-full h-[52px] rounded-[8px] font-bold text-[16px] transition-all flex items-center justify-center gap-2.5 ${
            postMutation.isPending
              ? 'bg-black/40 text-white/60 cursor-not-allowed'
              : !allReady
              ? 'bg-[#EFEFEF] text-[#AAAAAA] cursor-not-allowed border border-[#DBDBDB]'
              : 'bg-black text-white'
          }`}
        >
          {postMutation.isPending ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden />
              Posting…
            </>
          ) : 'Post Shift →'}
        </motion.button>
        <p className="text-center text-[#AAAAAA] text-[11px] mt-2">
          Your shift goes live immediately and appears on the jobs map
        </p>
      </div>
    </div>
  );
}
