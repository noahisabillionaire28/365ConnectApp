/**
 * Earnings & Payments — /earnings
 * Every finished shift as a row with its pay timeline (Worked → Approved →
 * Paid) and a stage chip, filterable by where it is; the summary at the top
 * splits the money into paid, approved-awaiting-payment and pending approval.
 * Also lists payments the user sent as a client and Pro subscription charges.
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
  ChevronLeft, DollarSign, CheckCircle2, Clock3,
  AlertCircle, Zap, CreditCard, TrendingUp, ChevronRight,
} from 'lucide-react';
import { usePayments, type PaymentRow } from '@/hooks/usePayments';
import { PayTimeline, StageChip, stageBucket } from '@/components/PayTimeline';
import { BottomTabNav } from '@/components/BottomTabNav';
import { useAuth } from '@/contexts/AuthContext';
import { confirmShiftPayment } from '@/lib/checkout';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtAmount(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

type Bucket = 'worked' | 'approved' | 'paid';
type Filter = 'all' | Bucket;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'worked',   label: 'Pending approval' },
  { key: 'approved', label: 'Approved' },
  { key: 'paid',     label: 'Paid' },
];

/** Which bucket an earned row sits in (null for money out and subscriptions). */
function rowBucket(p: PaymentRow): Bucket | null {
  if (p.direction === 'out' || p.payment_type === 'pro_subscription') return null;
  if (p.payment_type === 'timesheet') return stageBucket(p.stage);
  return p.status === 'completed' ? 'paid' : null;
}

// ─── Status chip (non-timesheet rows) ────────────────────────────────────────
function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    completed:  { label: 'Completed',  cls: 'bg-[#ECFDF5] text-[#065F46] border-[#10B981]/30', icon: <CheckCircle2 size={11} aria-hidden className="text-[#10B981]" /> },
    simulated:  { label: 'Simulated',  cls: 'bg-[#FFF7ED] text-[#92400E] border-[#FED7AA]',    icon: <Zap size={11} aria-hidden className="text-[#F59E0B]" /> },
    pending:    { label: 'Pending',    cls: 'bg-[#F3F4F6] text-[#6B7280] border-[#E5E7EB]',    icon: <Clock3 size={11} aria-hidden className="text-[#9CA3AF]" /> },
    failed:     { label: 'Failed',     cls: 'bg-red-50 text-[#DC2626] border-red-200',          icon: <AlertCircle size={11} aria-hidden className="text-[#EF4444]" /> },
  };
  const cfg = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${cfg.cls}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─── Payment type label ───────────────────────────────────────────────────────
function typeLabel(row: PaymentRow): string {
  if (row.payment_type === 'pro_subscription') return 'Pro subscription';
  if (row.direction === 'out') return 'Shift payment sent';
  const title = row.shift_title || row.company_name;
  const hours = typeof row.hours === 'number' && row.hours > 0 ? ` · ${row.hours.toFixed(1)}h` : '';
  if (row.payment_type === 'timesheet') return `${title ?? 'Shift'}${hours}`;
  return title ? `Shift earnings · ${title}` : 'Shift earnings';
}

function typeIcon(row: PaymentRow) {
  if (row.payment_type === 'pro_subscription') {
    return <Zap size={15} aria-hidden className="text-[#B8860B]" />;
  }
  return <DollarSign size={15} aria-hidden className="text-[#0A1628]" />;
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function PaymentSkeleton() {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-4 flex items-center gap-3 animate-pulse">
      <div className="w-10 h-10 rounded-[10px] bg-[#F3F4F6] flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="w-28 h-3.5 rounded-full bg-[#F3F4F6]" />
        <div className="w-20 h-3 rounded-full bg-[#F3F4F6]" />
      </div>
      <div className="w-16 h-5 rounded-full bg-[#F3F4F6]" />
    </div>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────
function SummaryCard({ payments }: { payments: PaymentRow[] }) {
  // Only money EARNED (as a worker) counts — payments the user sent as a
  // client (direction === 'out') are money going out, not earnings.
  const sum = (b: Bucket) => payments
    .filter((p) => rowBucket(p) === b)
    .reduce((acc, p) => acc + (b === 'paid' ? p.net_amount : p.amount), 0);
  const paid = sum('paid');
  const approved = sum('approved');
  const pending = sum('worked');

  return (
    <div className="bg-[#0A1628] rounded-[14px] px-5 py-5 mb-4">
      <p className="text-white/60 text-[11px] font-semibold uppercase tracking-wider mb-1">Paid</p>
      <p className="text-white font-bold text-[36px] tracking-tight mb-4" aria-label={`Paid ${fmtAmount(paid)}`}>{fmtAmount(paid)}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/10 rounded-[10px] px-3 py-2.5">
          <p className="text-white/60 text-[10px] font-semibold uppercase tracking-wider mb-0.5">Approved · awaiting payment</p>
          <p className="text-white font-bold text-[18px]">{fmtAmount(approved)}</p>
        </div>
        <div className="bg-white/10 rounded-[10px] px-3 py-2.5">
          <p className="text-white/60 text-[10px] font-semibold uppercase tracking-wider mb-0.5">Pending approval</p>
          <p className="text-white font-bold text-[18px]">{fmtAmount(pending)}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Filter row ───────────────────────────────────────────────────────────────
function FilterRow({ value, onChange }: { value: Filter; onChange: (f: Filter) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-4 px-4" role="group" aria-label="Filter shifts">
      {FILTERS.map((f) => {
        const active = f.key === value;
        return (
          <button key={f.key} type="button" aria-pressed={active} onClick={() => onChange(f.key)}
            className={`h-8 px-3.5 rounded-full border text-[12px] font-semibold whitespace-nowrap flex-shrink-0 ${
              active ? 'bg-[#0A1628] border-[#0A1628] text-white' : 'bg-white border-[#E5E7EB] text-[#374151]'}`}>
            {f.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Payment row card ─────────────────────────────────────────────────────────
function PaymentCard({ payment, index, onOpen }: { payment: PaymentRow; index: number; onOpen?: () => void }) {
  const isSubscription = payment.payment_type === 'pro_subscription';
  const isOutgoing     = payment.direction === 'out';
  const clickable      = !!onOpen && !!payment.shift_id && !isSubscription;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.22, ease: 'easeOut' }}
      className="bg-white border border-[#E5E7EB] rounded-[12px]"
    >
      <button type="button" disabled={!clickable} onClick={onOpen}
        aria-label={clickable ? `${typeLabel(payment)} — open shift` : undefined}
        className="w-full text-left px-4 py-4 flex flex-col gap-3 active:bg-[#FAFAFA] disabled:active:bg-white rounded-[12px]">
        <div className="flex items-center gap-3.5">
          {/* Icon */}
          <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0 ${
            isSubscription ? 'bg-[#FFD700]/15 border border-[#FFD700]/30' : 'bg-[#F0F4FF] border border-[#D1D9F0]'
          }`}>
            {typeIcon(payment)}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-[#111827] text-[14px] font-semibold leading-snug truncate">{typeLabel(payment)}</p>
            <p className="text-[#9CA3AF] text-[11px] mt-0.5">{fmtDate(payment.created_at)}</p>
            <div className="mt-1.5">
              {payment.timeline ? <StageChip timeline={payment.timeline} /> : <StatusChip status={payment.status} />}
            </div>
          </div>

          {/* Amounts */}
          <div className="text-right flex-shrink-0 flex items-center gap-1.5">
            <div>
              <p className={`font-bold text-[15px] ${isOutgoing ? 'text-[#B45309]' : 'text-[#111827]'}`}>
                {isSubscription || isOutgoing ? `−${fmtAmount(payment.amount)}` : `+${fmtAmount(payment.net_amount)}`}
              </p>
              {!isSubscription && !isOutgoing && payment.fee > 0 && (
                <p className="text-[#9CA3AF] text-[11px] mt-0.5">
                  gross {fmtAmount(payment.amount)}
                </p>
              )}
            </div>
            {clickable && <ChevronRight size={15} aria-hidden className="text-[#D1D5DB]" />}
          </div>
        </div>

        {/* Mini pay timeline for a timesheet row */}
        {payment.timeline && (
          <div className="px-1">
            <PayTimeline timeline={payment.timeline} compact />
          </div>
        )}
      </button>
    </motion.div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center mb-4">
        <TrendingUp size={26} aria-hidden className="text-[#9CA3AF]" />
      </div>
      <h3 className="text-[#111827] font-bold text-[17px] mb-2">No payments yet</h3>
      <p className="text-[#6B7280] text-[13px] leading-relaxed max-w-[220px]">
        Complete your first shift to see earnings here. Payments are recorded after clock-out.
      </p>
    </div>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export function EarningsScreen() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { data: payments = [], isLoading, isError, refetch } = usePayments();
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  // Returning from Stripe Checkout (?session_id=…): confirm the session so the
  // payment is recorded, then clean the URL so a refresh doesn't re-confirm.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (!sessionId || !user?.id) return;
    confirmShiftPayment(user.id, sessionId)
      .then(() => { setConfirmMsg('Payment recorded — thank you!'); return refetch(); })
      .catch(() => setConfirmMsg('We could not confirm that payment.'))
      .finally(() => window.history.replaceState({}, '', '/earnings'));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const shiftPayments = payments.filter((p) => p.payment_type !== 'pro_subscription' && p.direction !== 'out');
  const visibleShifts = filter === 'all' ? shiftPayments : shiftPayments.filter((p) => rowBucket(p) === filter);
  const sentPayments  = payments.filter((p) => p.direction === 'out');
  const subscriptions = payments.filter((p) => p.payment_type === 'pro_subscription');
  const filterLabel = FILTERS.find((f) => f.key === filter)?.label ?? '';

  return (
    <div className="min-h-[100dvh] bg-[#F7F8FA] flex flex-col pb-[72px]">

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
            <h1 className="text-[#111827] font-bold text-[20px] tracking-tight">Payments & Earnings</h1>
            <p className="text-[#6B7280] text-[12px]">Every shift, from worked to paid</p>
          </div>
        </div>
      </div>

      {confirmMsg && (
        <div className="mx-4 mt-3 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-[10px] px-3.5 py-2.5">
          <CheckCircle2 size={15} className="text-emerald-600 flex-shrink-0" />
          <p className="text-emerald-700 text-[13px] font-medium">{confirmMsg}</p>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-8">

        {/* Error */}
        {isError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-[12px] px-4 py-3" role="alert">
            <p className="text-[#EF4444] text-[13px] font-medium">Couldn't load payment history. Check your connection.</p>
          </div>
        )}

        {/* Loading skeletons */}
        {isLoading && (
          <div className="space-y-3">
            <div className="h-[140px] bg-[#E5E7EB] rounded-[14px] animate-pulse mb-5" />
            {[1, 2, 3].map((n) => <PaymentSkeleton key={n} />)}
          </div>
        )}

        {/* Populated state */}
        {!isLoading && !isError && payments.length > 0 && (
          <>
            <SummaryCard payments={payments} />

            {shiftPayments.length > 0 && (
              <div className="mb-5">
                <FilterRow value={filter} onChange={setFilter} />
                <p className="text-[#6B7280] text-[11px] font-semibold uppercase tracking-wider mb-3">
                  Shift Earnings
                </p>
                {visibleShifts.length === 0 ? (
                  <p className="text-[#9CA3AF] text-[13px] px-1 py-4 text-center">
                    No shifts {filter === 'paid' ? 'paid' : filter === 'approved' ? 'approved and awaiting payment' : 'pending approval'} right now.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3" aria-label={`${filterLabel} shifts`}>
                    {visibleShifts.map((p, i) => (
                      <PaymentCard key={p.id} payment={p} index={i}
                        onOpen={p.shift_id ? () => navigate(`/shift/${p.shift_id}`) : undefined} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {filter === 'all' && sentPayments.length > 0 && (
              <div className="mb-5">
                <p className="text-[#6B7280] text-[11px] font-semibold uppercase tracking-wider mb-3">
                  Payments Sent
                </p>
                <div className="flex flex-col gap-3">
                  {sentPayments.map((p, i) => (
                    <PaymentCard key={p.id} payment={p} index={shiftPayments.length + i}
                      onOpen={p.shift_id ? () => navigate(`/shift/${p.shift_id}`) : undefined} />
                  ))}
                </div>
              </div>
            )}

            {filter === 'all' && subscriptions.length > 0 && (
              <div className="mb-5">
                <p className="text-[#6B7280] text-[11px] font-semibold uppercase tracking-wider mb-3">
                  Subscriptions
                </p>
                <div className="flex flex-col gap-3">
                  {subscriptions.map((p, i) => (
                    <PaymentCard key={p.id} payment={p} index={shiftPayments.length + i} />
                  ))}
                </div>
              </div>
            )}

            <div className="mt-2 bg-[#F3F4F6] rounded-[10px] px-4 py-3">
              <div className="flex items-center gap-2">
                <CreditCard size={13} aria-hidden className="text-[#9CA3AF]" />
                <p className="text-[#9CA3AF] text-[11px]">
                  Subscription charges are simulated.
                </p>
              </div>
            </div>
          </>
        )}

        {/* Empty state */}
        {!isLoading && !isError && payments.length === 0 && <EmptyState />}
      </div>

      <BottomTabNav />
    </div>
  );
}
