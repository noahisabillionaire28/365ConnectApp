import { useState, useMemo } from 'react';
import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, TrendingUp, AlertCircle, Zap } from 'lucide-react';
import { isAdminAuthenticated, initAdminSession } from '@/store/adminStore';
import { useAdminPayments, useAdminStats } from '@/hooks/useAdminData';
import type { AdminPaymentRow } from '@/lib/adminApi';

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function fmtUsd(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

/* ── Status chip ─────────────────────────────────────────────────────────── */
const STATUS_CLS: Record<string, string> = {
  completed:  'bg-emerald-50 border-emerald-200 text-emerald-600',
  simulated:  'bg-blue-50    border-blue-200    text-blue-600',
  pending:    'bg-amber-50   border-amber-200   text-amber-600',
  failed:     'bg-red-50     border-red-200     text-red-600',
};

function StatusChip({ status }: { status: string }) {
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border flex-shrink-0 ${STATUS_CLS[status] ?? STATUS_CLS.pending}`}>
      {status}
    </span>
  );
}

/* ── Skeleton ────────────────────────────────────────────────────────────── */
function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#DBDBDB] animate-pulse">
      <div className="w-9 h-9 rounded-full bg-[#E5E7EB] flex-shrink-0" />
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="h-3 w-28 bg-[#E5E7EB] rounded-full" />
        <div className="h-2.5 w-20 bg-[#E5E7EB] rounded-full" />
      </div>
      <div className="h-5 w-16 bg-[#E5E7EB] rounded-full" />
    </div>
  );
}

function SkeletonStat() {
  return (
    <div className="bg-white border border-[#DBDBDB] rounded-[12px] p-4 flex flex-col gap-2 animate-pulse">
      <div className="h-2.5 w-20 bg-[#E5E7EB] rounded-full" />
      <div className="h-7 w-24 bg-[#E5E7EB] rounded-[6px]" />
      <div className="h-2.5 w-16 bg-[#E5E7EB] rounded-full" />
    </div>
  );
}

/* ── Payment row ─────────────────────────────────────────────────────────── */
function PaymentRow({ payment }: { payment: AdminPaymentRow }) {
  const isSubscription = payment.payment_type === 'pro_subscription';
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="flex items-center gap-3 px-4 py-3.5 border-b border-[#DBDBDB] last:border-none"
    >
      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
        isSubscription ? 'bg-[#FFD700]/15 border border-[#FFD700]/30' : 'bg-emerald-50 border border-emerald-200'
      }`}>
        {isSubscription
          ? <Zap      size={15} aria-hidden className="text-[#FFD700]" />
          : <DollarSign size={15} aria-hidden className="text-emerald-600" />}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-black font-semibold text-[13px] truncate">
          {isSubscription ? 'Pro Subscription' : 'Shift Earnings'}
        </p>
        <p className="text-[#737373] text-[11px] mt-0.5">
          {fmtDate(payment.created_at)}
          {payment.fee > 0 && ` · ${fmtUsd(payment.fee)} fee`}
        </p>
      </div>

      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <p className="text-black font-bold text-[14px]">{fmtUsd(payment.amount)}</p>
        <StatusChip status={payment.status} />
      </div>
    </motion.div>
  );
}

/* ── Filter options ──────────────────────────────────────────────────────── */
type RevFilter = 'all' | 'shift_payment' | 'pro_subscription';

const FILTERS: { key: RevFilter; label: string }[] = [
  { key: 'all',              label: 'All'           },
  { key: 'shift_payment',    label: 'Shift Earnings' },
  { key: 'pro_subscription', label: 'Subscriptions' },
];

/* ── AdminRevenue ────────────────────────────────────────────────────────── */
export function AdminRevenue() {
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<RevFilter>('all');
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    initAdminSession().then((ok) => {
      setAuthReady(true);
      if (!ok) navigate('/admin/login');
    });
  }, [navigate]);

  const { data: payments = [], isLoading, isError } = useAdminPayments();
  const { data: stats }                              = useAdminStats();

  const filtered = useMemo(() =>
    filter === 'all' ? payments : payments.filter((p) => p.payment_type === filter),
    [payments, filter],
  );

  if (!authReady) return (
    <div className="min-h-[100dvh] bg-[#FAFAFA] flex items-center justify-center pt-[60px]">
      <div className="w-8 h-8 rounded-full border-2 border-black border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-[#FAFAFA] flex flex-col pt-[60px]">

      <div className="px-4 pt-6 pb-4">
        <h1 className="text-black font-bold text-[22px] tracking-tight">Revenue</h1>
        <p className="text-[#737373] text-[13px] mt-0.5">Platform earnings and payment history</p>
      </div>

      {/* Summary cards */}
      <div className="px-4 pb-4 grid grid-cols-2 gap-3">
        {!stats ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonStat key={i} />)
        ) : (
          <>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-[#DBDBDB] rounded-[12px] p-4">
              <p className="text-[#737373] text-[10px] font-bold uppercase tracking-wider mb-1">Gross Revenue</p>
              <p className="text-black font-bold text-[22px]">{fmtUsd(stats.totalRevenue)}</p>
              <p className="text-[#737373] text-[11px] mt-0.5">completed shift payments</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="bg-white border border-[#DBDBDB] rounded-[12px] p-4">
              <p className="text-[#737373] text-[10px] font-bold uppercase tracking-wider mb-1">Platform Fees</p>
              <p className="text-[#10B981] font-bold text-[22px]">{fmtUsd(stats.platformFeeRev)}</p>
              <p className="text-[#737373] text-[11px] mt-0.5">8% of gross</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="col-span-2 bg-white border border-[#DBDBDB] rounded-[12px] p-4 flex items-center gap-3">
              <TrendingUp size={20} aria-hidden className="text-black flex-shrink-0" />
              <div>
                <p className="text-[#737373] text-[10px] font-bold uppercase tracking-wider">Total Transactions</p>
                <p className="text-black font-bold text-[18px] mt-0.5">{payments.length}</p>
              </div>
            </motion.div>
          </>
        )}
      </div>

      {/* Filter chips */}
      <div className="px-4 pb-3 flex gap-2 overflow-x-auto no-scrollbar" role="group" aria-label="Filter payments">
        {FILTERS.map(({ key, label }) => (
          <button key={key} type="button" aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={`flex-shrink-0 h-[32px] px-3.5 rounded-full text-[12px] font-semibold border transition-all ${
              filter === key ? 'bg-black text-white border-black' : 'bg-white border-[#DBDBDB] text-[#737373]'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 bg-white border-t border-[#DBDBDB]" role="list" aria-label="Payment list">
        {isLoading && Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}

        {isError && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 px-8">
            <AlertCircle size={32} aria-hidden className="text-red-400" />
            <p className="text-[#737373] text-[14px] text-center">Could not load payments.</p>
          </div>
        )}

        {!isLoading && !isError && (
          <AnimatePresence>
            {filtered.map((p, i) => (
              <motion.div key={p.id} role="listitem"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}>
                <PaymentRow payment={p} />
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <DollarSign size={32} aria-hidden className="text-[#DBDBDB]" />
            <p className="text-[#AAAAAA] text-[14px]">No payments recorded yet.</p>
          </div>
        )}
        <div className="h-10" />
      </div>
    </div>
  );
}
