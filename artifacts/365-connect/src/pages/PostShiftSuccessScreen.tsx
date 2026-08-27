/**
 * Post-shift success screen — shown after a new shift is posted.
 * Reads ?id=<shiftId> and offers View Shift / Back to Home.
 */
import { useLocation, useSearch } from 'wouter';
import { motion } from 'framer-motion';
import { CheckCircle2, Eye, Home } from 'lucide-react';

export function PostShiftSuccessScreen() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const shiftId = new URLSearchParams(search).get('id');

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
        Your shift is live. Workers nearby will start seeing it and applying soon.
      </p>

      <div className="w-full max-w-[320px] flex flex-col gap-3">
        {shiftId && (
          <motion.button
            type="button" whileTap={{ scale: 0.97 }}
            onClick={() => navigate(`/shift/${shiftId}`)}
            className="w-full h-[52px] rounded-[12px] bg-[#0A1628] text-white font-bold text-[16px] flex items-center justify-center gap-2"
          >
            <Eye size={17} aria-hidden />
            View Shift
          </motion.button>
        )}
        <motion.button
          type="button" whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/home')}
          className="w-full h-[52px] rounded-[12px] bg-white border border-[#E5E7EB] text-[#111827] font-bold text-[16px] flex items-center justify-center gap-2"
        >
          <Home size={17} aria-hidden />
          Back to Home
        </motion.button>
      </div>
    </div>
  );
}
