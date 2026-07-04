import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-black px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="text-center max-w-[300px]"
      >
        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
          <AlertCircle size={28} className="text-primary" aria-hidden />
        </div>

        <p className="text-primary font-bold text-[11px] uppercase tracking-[0.22em] mb-2">
          404
        </p>
        <h1 className="text-white font-bold text-[28px] tracking-tight leading-tight mb-3">
          Page not found
        </h1>
        <p className="text-[#444] text-[15px] leading-relaxed mb-8">
          This page doesn't exist or has been moved.
        </p>

        <button
          type="button"
          onClick={() => navigate('/home')}
          className="inline-flex items-center gap-2 h-[50px] px-7 rounded-[14px] bg-primary text-black font-bold text-[15px]"
        >
          <ArrowLeft size={16} aria-hidden />
          Back to Home
        </button>
      </motion.div>
    </div>
  );
}
