import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-white px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="text-center max-w-[300px]"
      >
        <div className="w-16 h-16 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center mx-auto mb-6">
          <AlertCircle size={28} className="text-[#0A1628]" aria-hidden />
        </div>

        <p className="text-[#2563EB] font-bold text-[11px] uppercase tracking-[0.22em] mb-2">
          404
        </p>
        <h1 className="text-[#111827] font-bold text-[28px] tracking-tight leading-tight mb-3">
          Page not found
        </h1>
        <p className="text-[#6B7280] text-[15px] leading-relaxed mb-8">
          This page doesn't exist or has been moved.
        </p>

        <button
          type="button"
          onClick={() => navigate('/home')}
          className="inline-flex items-center gap-2 h-[50px] px-7 rounded-[14px] bg-[#0A1628] text-white font-bold text-[15px]"
        >
          <ArrowLeft size={16} aria-hidden />
          Back to Home
        </button>
      </motion.div>
    </div>
  );
}
