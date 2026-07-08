/**
 * Pro Upgrade Screen — /pro-upgrade
 * Shows the $17/mo Pro plan, lists benefits, and simulates a subscription
 * by writing a row to the payments table and setting users.is_pro = true.
 */
import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Zap, CheckCircle2, BadgeCheck,
  TrendingUp, MessageSquare, Star, Compass, Shield,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { PAYMENTS_QUERY_KEY } from '@/hooks/usePayments';
import { BottomTabNav } from '@/components/BottomTabNav';

// ─── Pro benefits list ────────────────────────────────────────────────────────
const PRO_BENEFITS = [
  {
    icon: TrendingUp,
    title: 'Priority applications',
    body: "Your applications surface at the top of every client's review queue.",
  },
  {
    icon: BadgeCheck,
    title: 'Pro badge on your profile',
    body: 'A gold verified checkmark signals credibility to every client.',
  },
  {
    icon: Star,
    title: 'Featured in Explore',
    body: 'Get discovered first when clients search for workers in your area.',
  },
  {
    icon: MessageSquare,
    title: 'Direct message boost',
    body: 'Send first-contact messages to clients before applying to shifts.',
  },
  {
    icon: Compass,
    title: 'Advanced shift analytics',
    body: 'See match score breakdowns and earn trend data across your shifts.',
  },
  {
    icon: Shield,
    title: 'Priority support',
    body: 'Skip the queue — get responses from our team within 4 hours.',
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function BenefitRow({
  icon: Icon, title, body,
}: {
  icon: React.ComponentType<{ size: number; className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-3.5 py-3.5 border-b border-[#E5E7EB] last:border-0">
      <div className="w-9 h-9 rounded-[10px] bg-[#FFD700]/15 border border-[#FFD700]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={16} className="text-[#B8860B]" aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[#111827] font-semibold text-[14px] leading-snug">{title}</p>
        <p className="text-[#6B7280] text-[12px] mt-0.5 leading-relaxed">{body}</p>
      </div>
      <CheckCircle2 size={16} aria-hidden className="text-[#10B981] flex-shrink-0 mt-1" />
    </div>
  );
}

function PlanCard({
  label, price, period, current, highlight,
}: {
  label: string; price: string; period: string;
  current?: boolean; highlight?: boolean;
}) {
  return (
    <div className={`flex-1 rounded-[12px] border-2 px-4 py-4 flex flex-col gap-1 relative ${
      highlight ? 'border-[#FFD700] bg-[#FFFBEB]' : 'border-[#E5E7EB] bg-white'
    }`}>
      {highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FFD700] text-[#111827] text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap">
          Recommended
        </div>
      )}
      <p className={`text-[11px] font-bold uppercase tracking-wider ${highlight ? 'text-[#B8860B]' : 'text-[#9CA3AF]'}`}>
        {label}
      </p>
      <div className="flex items-baseline gap-1">
        <span className={`font-bold text-[28px] ${highlight ? 'text-[#111827]' : 'text-[#6B7280]'}`}>{price}</span>
        {period && <span className="text-[#9CA3AF] text-[12px]">{period}</span>}
      </div>
      {current && (
        <span className="text-[#6B7280] text-[11px] font-medium">Current plan</span>
      )}
    </div>
  );
}

// ─── Success overlay ──────────────────────────────────────────────────────────
function SuccessOverlay({ onDone }: { onDone: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center px-8 text-center"
    >
      <motion.div
        initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        className="w-20 h-20 rounded-full bg-[#FFD700]/20 border-2 border-[#FFD700] flex items-center justify-center mb-6"
      >
        <BadgeCheck size={40} className="text-[#B8860B]" aria-hidden />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <h2 className="text-[#111827] font-bold text-[26px] tracking-tight mb-2">You're Pro!</h2>
        <p className="text-[#6B7280] text-[15px] leading-relaxed mb-8">
          Your Pro badge is live. Priority applications and all features are now active.
        </p>
        <p className="text-[#9CA3AF] text-[11px] mb-6">
          This is a simulated subscription — no real charge was made.
        </p>
        <motion.button
          type="button" whileTap={{ scale: 0.97 }}
          onClick={onDone}
          className="w-full max-w-[280px] h-[52px] rounded-[12px] bg-[#0A1628] text-white font-bold text-[16px]"
        >
          View My Profile
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export function ProUpgradeScreen() {
  const [, navigate]    = useLocation();
  const { user }        = useAuth();
  const profile         = useProfile();
  const queryClient     = useQueryClient();

  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  // Already Pro — reflect that gracefully
  const alreadyPro = profile.isPro && !loading && !success;

  async function handleUpgrade() {
    if (!user) { setError('You must be signed in to upgrade.'); return; }
    setLoading(true);
    setError(null);

    try {
      // 1. Write simulated subscription payment row
      const { error: payErr } = await supabase.from('payments').insert({
        worker_id:    user.id,
        shift_id:     null,           // no shift — subscription payment
        payment_type: 'pro_subscription',
        amount:       17.00,
        fee:          0,
        net_amount:   17.00,
        status:       'simulated',
      });
      if (payErr) throw new Error(payErr.message);

      // 2. Set is_pro = true on the user's profile
      const { error: userErr } = await supabase
        .from('users')
        .update({ is_pro: true })
        .eq('id', user.id);
      if (userErr) throw new Error(userErr.message);

      // 3. Invalidate profile and payments queries so UI refreshes
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profile', user.id] }),
        queryClient.invalidateQueries({ queryKey: [...PAYMENTS_QUERY_KEY] }),
      ]);

      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[#F7F8FA] flex flex-col pb-[72px]">

      <AnimatePresence>
        {success && <SuccessOverlay onDone={() => navigate('/profile')} />}
      </AnimatePresence>

      {/* Header */}
      <div className="bg-white px-5 pt-5 pb-4 border-b border-[#E5E7EB] sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            type="button" aria-label="Go back"
            onClick={() => navigate('/profile')}
            className="w-9 h-9 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft size={18} aria-hidden className="text-[#111827]" />
          </button>
          <div>
            <h1 className="text-[#111827] font-bold text-[20px] tracking-tight">Upgrade to Pro</h1>
            <p className="text-[#6B7280] text-[12px]">Simulated payment — no real charge</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-36">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-[#0A1628] to-[#1E3A5F] rounded-[16px] px-5 py-6 mb-5 relative overflow-hidden"
        >
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-[#FFD700]/10 blur-2xl pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-[10px] bg-[#FFD700]/20 border border-[#FFD700]/30 flex items-center justify-center">
                <Zap size={18} className="text-[#FFD700]" aria-hidden />
              </div>
              <span className="text-[#FFD700] font-bold text-[14px] uppercase tracking-wider">365 Connect Pro</span>
            </div>
            <p className="text-white font-bold text-[28px] tracking-tight mb-1">
              Unlock your full potential
            </p>
            <p className="text-white/60 text-[14px] leading-relaxed">
              Get hired faster, earn more, and stand out from the competition.
            </p>
          </div>
        </motion.div>

        {/* Already Pro banner */}
        {alreadyPro && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="mb-5 bg-[#ECFDF5] border border-[#10B981]/30 rounded-[12px] px-4 py-3 flex items-center gap-3"
            role="status"
          >
            <CheckCircle2 size={18} aria-hidden className="text-[#10B981] flex-shrink-0" />
            <p className="text-[#065F46] text-[13px] font-medium">You're already on the Pro plan — all features are active!</p>
          </motion.div>
        )}

        {/* Plan comparison */}
        <div className="mb-5">
          <p className="text-[#6B7280] text-[11px] font-semibold uppercase tracking-wider mb-3">Plans</p>
          <div className="flex gap-3">
            <PlanCard label="Free" price="$0" period="/mo" current={!profile.isPro} />
            <PlanCard label="Pro" price="$17" period="/mo" highlight current={profile.isPro} />
          </div>
        </div>

        {/* Benefits */}
        <div className="bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-1 mb-5">
          <p className="text-[#6B7280] text-[11px] font-semibold uppercase tracking-wider pt-3 pb-1">
            What's included
          </p>
          {PRO_BENEFITS.map((b) => (
            <BenefitRow key={b.title} icon={b.icon} title={b.title} body={b.body} />
          ))}
        </div>

        {/* Disclaimer */}
        <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-[12px] px-4 py-3 mb-4">
          <p className="text-[#92400E] text-[12px] leading-relaxed font-medium">
            ⚠️ <strong>Demo mode:</strong> This simulates a real subscription. No credit card is charged.
            A row is written to the payments table with <code className="text-[11px] bg-[#FEF3C7] rounded px-1">status: 'simulated'</code>.
          </p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="mb-4 bg-red-50 border border-red-200 rounded-[12px] px-4 py-3" role="alert"
          >
            <p className="text-[#EF4444] text-[13px] font-medium">{error}</p>
          </motion.div>
        )}
      </div>

      {/* Fixed CTA */}
      <div className="fixed bottom-[56px] left-1/2 -translate-x-1/2 w-full max-w-[390px] px-5 pb-4 pt-4
        bg-gradient-to-t from-[#F7F8FA] via-[#F7F8FA]/95 to-transparent z-20">
        <motion.button
          type="button" whileTap={{ scale: 0.97 }}
          onClick={alreadyPro ? () => navigate('/profile') : handleUpgrade}
          disabled={loading}
          aria-disabled={loading}
          aria-busy={loading}
          aria-label={alreadyPro ? 'Go to profile' : 'Upgrade to Pro for $17 per month (simulated)'}
          className={`w-full h-[52px] rounded-[12px] font-bold text-[16px] flex items-center justify-center gap-2.5 transition-all ${
            alreadyPro
              ? 'bg-[#0A1628] text-white'
              : 'bg-[#FFD700] text-[#111827]'
          } disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          {loading ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-[#111827]/20 border-t-[#111827] animate-spin" aria-hidden />
              Activating Pro…
            </>
          ) : alreadyPro ? (
            'View Profile'
          ) : (
            <>
              <Zap size={18} aria-hidden />
              Upgrade for $17/mo
            </>
          )}
        </motion.button>
        <p className="text-center text-[#9CA3AF] text-[11px] mt-2">
          Simulated • No real payment processed • Cancel anytime
        </p>
      </div>

      <BottomTabNav />
    </div>
  );
}
