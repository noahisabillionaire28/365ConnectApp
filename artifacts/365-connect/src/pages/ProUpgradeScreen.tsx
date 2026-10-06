/**
 * Pro Upgrade Screen — /pro-upgrade
 *
 * Shows the planned $17/mo Pro plan and its benefits. Pro cannot be bought
 * yet: the primary action says so plainly, and the price, renewal and
 * cancellation terms are shown up front so nothing is hidden when it goes
 * live. In development builds (VITE_APP_ENV=development) a clearly labelled
 * "simulate" button writes a status:'simulated' payment row so the Pro state
 * can be exercised; it never charges anyone.
 */
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { isIOS } from '@/lib/native';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Zap, CheckCircle2, BadgeCheck,
  TrendingUp, MessageSquare, Star, Compass, Shield, Info,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { PAYMENTS_QUERY_KEY } from '@/hooks/usePayments';
import { BottomTabNav } from '@/components/BottomTabNav';

/** Purchasing is not wired up (no Stripe subscription, no App Store product). */
export const PRO_PURCHASE_LIVE = false;
export const PRO_PRICE_LABEL = '$17/month';
const SIMULATE_ALLOWED = import.meta.env.VITE_APP_ENV === 'development';

// ─── Pro benefits list ────────────────────────────────────────────────────────
const PRO_BENEFITS = [
  {
    icon: TrendingUp,
    title: 'Priority applications',
    body: "Your applications are listed first in a poster's review queue. Posters still choose whom to book.",
  },
  {
    icon: BadgeCheck,
    title: 'Pro badge on your profile',
    body: 'A gold Pro badge shows you subscribe to Pro. It is not an identity, licence or background check.',
  },
  {
    icon: Star,
    title: 'Featured in Explore',
    body: 'Pro profiles are sorted first when posters browse workers in their area.',
  },
  {
    icon: MessageSquare,
    title: 'Message first',
    body: 'Send a first message to a poster before applying to one of their shifts.',
  },
  {
    icon: Compass,
    title: 'Shift analytics',
    body: 'See how your match insights are built and your earnings trend across shifts.',
  },
  {
    icon: Shield,
    title: 'Priority support',
    body: 'Your questions go to the front of our support queue.',
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
      <div className="w-10 h-10 rounded-[10px] bg-[#FFD700]/15 border border-[#FFD700]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
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
      <p className={`text-[11px] font-bold uppercase tracking-wider ${highlight ? 'text-[#B8860B]' : 'text-[#6B7280]'}`}>
        {label}
      </p>
      <div className="flex items-baseline gap-1">
        <span className={`font-bold text-[28px] ${highlight ? 'text-[#111827]' : 'text-[#6B7280]'}`}>{price}</span>
        {period && <span className="text-[#6B7280] text-[12px]">{period}</span>}
      </div>
      {current && (
        <span className="text-[#6B7280] text-[11px] font-medium">Current plan</span>
      )}
    </div>
  );
}

// ─── Success overlay (simulated activation, development only) ─────────────────
function SuccessOverlay({ onDone }: { onDone: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center px-8 text-center"
      role="dialog" aria-modal="true" aria-labelledby="pro-success-title"
    >
      <motion.div
        initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        className="w-20 h-20 rounded-full bg-[#FFD700]/20 border-2 border-[#FFD700] flex items-center justify-center mb-6"
      >
        <BadgeCheck size={40} className="text-[#B8860B]" aria-hidden />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <h2 id="pro-success-title" className="text-[#111827] font-bold text-[26px] tracking-tight mb-2">Pro is on (simulated)</h2>
        <p className="text-[#6B7280] text-[15px] leading-relaxed mb-8">
          Your Pro badge is live for testing. No charge was made and nothing will renew.
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

  // Apple requires digital subscriptions to use in-app purchase. Until that
  // is wired up, the native iOS app never shows this screen.
  useEffect(() => { if (isIOS()) navigate('/profile'); }, [navigate]);

  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const alreadyPro = profile.isPro && !loading && !success;

  async function handleSimulate() {
    if (!user) { setError('You must be signed in to upgrade.'); return; }
    setLoading(true);
    setError(null);
    try {
      // Records a status:'simulated' subscription; the server grants Pro
      // against it. Profiles cannot set is_pro themselves.
      await apiClient(user.id).post('/payments', { payment_type: 'pro_subscription' });
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
            className="w-10 h-10 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft size={18} aria-hidden className="text-[#111827]" />
          </button>
          <div>
            <h1 className="text-[#111827] font-bold text-[20px] tracking-tight">365 Connect Pro</h1>
            <p className="text-[#6B7280] text-[12px]">{PRO_PURCHASE_LIVE ? PRO_PRICE_LABEL : 'Coming soon · not available to buy yet'}</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-40">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-[#0A1628] to-[#1E3A5F] rounded-[16px] px-5 py-6 mb-5 relative overflow-hidden"
        >
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-[#FFD700]/10 blur-2xl pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-10 h-10 rounded-[10px] bg-[#FFD700]/20 border border-[#FFD700]/30 flex items-center justify-center">
                <Zap size={18} className="text-[#FFD700]" aria-hidden />
              </div>
              <span className="text-[#FFD700] font-bold text-[14px] uppercase tracking-wider">365 Connect Pro</span>
            </div>
            <p className="text-white font-bold text-[28px] tracking-tight mb-1">
              Stand out to posters
            </p>
            <p className="text-white/70 text-[14px] leading-relaxed">
              Priority placement and a Pro badge. Pro does not guarantee bookings or earnings.
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
            <p className="text-[#065F46] text-[13px] font-medium">You're on the Pro plan. All Pro features are active.</p>
          </motion.div>
        )}

        {/* Plan comparison */}
        <div className="mb-5">
          <p className="text-[#6B7280] text-[11px] font-semibold uppercase tracking-wider mb-3">Plans</p>
          <div className="flex gap-3">
            <PlanCard label="Free" price="$0" period="/mo" current={!profile.isPro} />
            <PlanCard label="Pro" price="$17" period="/mo" highlight current={profile.isPro} />
          </div>
          <p className="text-[#6B7280] text-[12px] mt-2 leading-relaxed">
            Everything you can do today stays free. 365 Connect charges no fees on shifts or pay, with or without Pro.
          </p>
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

        {/* Price, renewal and cancellation terms — always visible */}
        <section aria-labelledby="pro-terms-heading" className="bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-4 mb-4" data-testid="pro-terms">
          <h2 id="pro-terms-heading" className="text-[#6B7280] text-[11px] font-semibold uppercase tracking-wider mb-2">Price and terms</h2>
          <ul className="flex flex-col gap-1.5 text-[13px] text-[#374151] leading-relaxed list-disc pl-4">
            <li><span className="font-semibold text-[#111827]">{PRO_PRICE_LABEL}</span>, shown and confirmed before you pay. No extra fees.</li>
            <li>Renews monthly until you cancel. Cancel anytime here in Settings or, for an App Store purchase, in your Apple ID subscriptions. You keep Pro until the end of the paid period.</li>
            <li>Full refund of your first purchase if you ask within 14 days. No partial-period refunds after that, except where the law requires.</li>
          </ul>
          <Link href="/refunds" className="inline-flex items-center gap-1.5 min-h-[44px] text-[#0A1628] text-[13px] font-semibold underline underline-offset-2" data-testid="pro-refunds-link">
            Refund &amp; Cancellation Policy
          </Link>
        </section>

        {/* Availability notice */}
        {!PRO_PURCHASE_LIVE && !alreadyPro && (
          <div className="bg-[#F0F7FF] border border-[#BFDBFE] rounded-[12px] px-4 py-3 mb-4 flex items-start gap-2.5" role="status" data-testid="pro-not-live">
            <Info size={16} aria-hidden className="text-[#1D4ED8] flex-shrink-0 mt-0.5" />
            <p className="text-[#1E3A8A] text-[13px] leading-relaxed">
              Pro is not available to buy yet. Nothing on this screen charges you. We will announce it in the app when it opens; you decide then.
            </p>
          </div>
        )}

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
      <div className="fixed bottom-[56px] left-1/2 -translate-x-1/2 w-full max-w-app px-5 pb-4 pt-4
        bg-gradient-to-t from-[#F7F8FA] via-[#F7F8FA]/95 to-transparent z-20">
        {alreadyPro ? (
          <motion.button
            type="button" whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/profile')}
            className="w-full h-[52px] rounded-[12px] font-bold text-[16px] flex items-center justify-center gap-2.5 bg-[#0A1628] text-white"
          >
            View Profile
          </motion.button>
        ) : SIMULATE_ALLOWED ? (
          <>
            <motion.button
              type="button" whileTap={{ scale: 0.97 }}
              onClick={handleSimulate}
              disabled={loading}
              aria-busy={loading}
              className="w-full h-[52px] rounded-[12px] font-bold text-[16px] flex items-center justify-center gap-2.5 bg-[#FFD700] text-[#111827] disabled:opacity-60 disabled:cursor-not-allowed"
              data-testid="pro-simulate"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-[#111827]/20 border-t-[#111827] animate-spin" aria-hidden />
                  Activating…
                </>
              ) : (
                <><Zap size={18} aria-hidden /> Simulate Pro (dev only, no charge)</>
              )}
            </motion.button>
            <p className="text-center text-[#6B7280] text-[11px] mt-2">Development build · writes a simulated payment row · never charges a card</p>
          </>
        ) : (
          <>
            <button type="button" disabled aria-disabled="true"
              className="w-full h-[52px] rounded-[12px] font-bold text-[16px] flex items-center justify-center gap-2.5 bg-[#E5E7EB] text-[#6B7280] cursor-not-allowed"
              data-testid="pro-cta-disabled">
              Not available yet
            </button>
            <p className="text-center text-[#6B7280] text-[11px] mt-2">{PRO_PRICE_LABEL} when it launches · cancel anytime · no fees today</p>
          </>
        )}
      </div>

      <BottomTabNav />
    </div>
  );
}
