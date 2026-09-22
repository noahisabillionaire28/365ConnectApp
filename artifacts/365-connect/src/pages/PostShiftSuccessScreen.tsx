/**
 * Post-shift success screen — shown after a new shift is posted.
 * Reads ?id=<shiftId> and offers the next best action for the poster's role:
 * an agency assigns from its roster, a client invites workers.
 */
import { useLocation, useSearch } from 'wouter';
import { motion } from 'framer-motion';
import { CheckCircle2, Eye, Briefcase, UserPlus, Send } from 'lucide-react';
import { useRole } from '@/contexts/RoleContext';

export function PostShiftSuccessScreen() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const shiftId = new URLSearchParams(search).get('id');
  const { role } = useRole();
  const isStaffer = role === 'staffer';

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col items-center justify-center px-6 py-10 text-center">
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        className="w-20 h-20 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-6"
      >
        <CheckCircle2 size={44} className="text-emerald-500" />
      </motion.div>

      <h1 className="text-[#111827] font-bold text-[24px] tracking-tight mb-2">Shift posted!</h1>
      <p className="text-[#6B7280] text-[14px] leading-relaxed max-w-[280px] mb-8">
        {isStaffer
          ? 'Your shift is live. Fill it fastest by assigning people from your roster.'
          : 'Your shift is live. Workers nearby will start seeing it and applying soon.'}
      </p>

      <div className="w-full max-w-[320px] flex flex-col gap-3">
        {shiftId && isStaffer && (
          <motion.button
            type="button" whileTap={{ scale: 0.97 }}
            onClick={() => navigate(`/shift/${shiftId}/assign`)}
            className="w-full h-[52px] rounded-[12px] bg-[#0A1628] text-white font-bold text-[16px] flex items-center justify-center gap-2"
          >
            <UserPlus size={17} aria-hidden />
            Assign from Roster
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
            View Shift
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
      </div>
    </div>
  );
}
