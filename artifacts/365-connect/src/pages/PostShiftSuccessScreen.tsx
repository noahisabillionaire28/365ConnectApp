/**
 * Post-shift success screen — shown after a new shift (or series) is posted.
 * Reads ?id=<shiftId> (and ?series=<seriesId>&count=N for a recurring post)
 * and offers the next best action for the poster's role: an agency assigns
 * from its roster, a client invites workers. The details just posted can be
 * saved as a template from here.
 */
import { useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { motion } from 'framer-motion';
import { CheckCircle2, Eye, Briefcase, UserPlus, Send, BookmarkPlus } from 'lucide-react';
import { useRole } from '@/contexts/RoleContext';
import { useSeriesShifts } from '@/hooks/useShiftSeries';
import { getLastPosted } from '@/store/postShiftStore';
import { TemplateNameSheet } from '@/components/TemplateNameSheet';
import { formatTime, friendlyDate } from '@/lib/supabase';

export function PostShiftSuccessScreen() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const shiftId = params.get('id');
  const seriesId = params.get('series');
  const count = Math.max(1, parseInt(params.get('count') ?? '1', 10) || 1);
  const { role } = useRole();
  const isStaffer = role === 'staffer';
  const { shifts: seriesShifts } = useSeriesShifts(seriesId);
  const lastPosted = getLastPosted();
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);
  const isSeries = !!seriesId && count > 1;

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col items-center justify-center px-6 py-10 text-center">
      <TemplateNameSheet
        open={templateOpen}
        payload={lastPosted}
        defaultName={lastPosted?.title || 'My shift'}
        onClose={() => setTemplateOpen(false)}
        onSaved={() => setTemplateSaved(true)}
      />
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        className="w-20 h-20 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-6"
      >
        <CheckCircle2 size={44} className="text-emerald-500" />
      </motion.div>

      <h1 className="text-[#111827] font-bold text-[24px] tracking-tight mb-2">
        {isSeries ? `${count} shifts posted!` : 'Shift posted!'}
      </h1>
      <p className="text-[#6B7280] text-[14px] leading-relaxed max-w-[280px] mb-6">
        {isSeries
          ? (isStaffer
            ? 'Every date is live as its own shift. Fill them fastest by assigning people from your roster.'
            : 'Every date is live as its own shift. Workers nearby will start seeing them and applying soon.')
          : (isStaffer
            ? 'Your shift is live. Fill it fastest by assigning people from your roster.'
            : 'Your shift is live. Workers nearby will start seeing it and applying soon.')}
      </p>

      {isSeries && seriesShifts.length > 0 && (
        <div className="w-full max-w-[320px] bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-2 mb-6 text-left" data-testid="series-dates">
          {seriesShifts.map((s) => (
            <button key={s.id} type="button" onClick={() => navigate(`/shift/${s.id}`)}
              className="w-full flex items-center justify-between py-2.5 border-b border-[#F3F4F6] last:border-0 text-left">
              <span className="text-[#111827] text-[14px] font-semibold">{friendlyDate(s.start_time, s.timezone)}</span>
              <span className="text-[#6B7280] text-[12px]">{formatTime(s.start_time, s.timezone)} – {formatTime(s.end_time, s.timezone)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="w-full max-w-[320px] flex flex-col gap-3">
        {shiftId && isStaffer && (
          <motion.button
            type="button" whileTap={{ scale: 0.97 }}
            onClick={() => navigate(`/shift/${shiftId}/assign`)}
            className="w-full h-[52px] rounded-[12px] bg-[#0A1628] text-white font-bold text-[16px] flex items-center justify-center gap-2"
          >
            <UserPlus size={17} aria-hidden />
            {isSeries ? 'Assign the first shift' : 'Assign from Roster'}
          </motion.button>
        )}
        {shiftId && !isStaffer && (
          <motion.button
            type="button" whileTap={{ scale: 0.97 }}
            onClick={() => navigate(`/shift/${shiftId}/applicants`)}
            className="w-full h-[52px] rounded-[12px] bg-[#0A1628] text-white font-bold text-[16px] flex items-center justify-center gap-2"
          >
            <Send size={17} aria-hidden />
            Invite Workers
          </motion.button>
        )}
        {shiftId && (
          <motion.button
            type="button" whileTap={{ scale: 0.97 }}
            onClick={() => navigate(`/shift/${shiftId}`)}
            className="w-full h-[52px] rounded-[12px] bg-white border border-[#E5E7EB] text-[#111827] font-bold text-[16px] flex items-center justify-center gap-2"
          >
            <Eye size={17} aria-hidden />
            {isSeries ? 'View first shift' : 'View Shift'}
          </motion.button>
        )}
        <motion.button
          type="button" whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/home?tab=my-shifts')}
          className="w-full h-[52px] rounded-[12px] bg-white border border-[#E5E7EB] text-[#111827] font-bold text-[16px] flex items-center justify-center gap-2"
        >
          <Briefcase size={17} aria-hidden />
          Go to My Shifts
        </motion.button>
        {lastPosted && (
          <button
            type="button"
            onClick={() => setTemplateOpen(true)}
            disabled={templateSaved}
            aria-label="Save these shift details as a template"
            className="w-full h-[46px] rounded-[12px] text-[#0A1628] font-semibold text-[14px] flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <BookmarkPlus size={16} aria-hidden />
            {templateSaved ? 'Saved as template' : 'Save as template'}
          </button>
        )}
      </div>
    </div>
  );
}
