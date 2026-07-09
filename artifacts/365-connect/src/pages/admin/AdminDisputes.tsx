import { useState } from 'react';
import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, CheckCircle2, ShieldAlert, Ban, Clock,
  CheckCheck, AlertCircle,
} from 'lucide-react';
import { isAdminAuthenticated, initAdminSession } from '@/store/adminStore';
import { useAdminDisputes, useUpdateDispute } from '@/hooks/useAdminData';
import type { AdminDisputeRow } from '@/lib/adminApi';

/* ── Status & type metadata ─────────────────────────────────────────────── */
type DisputeStatus = AdminDisputeRow['status'];

const STATUS_META: Record<DisputeStatus, {
  label: string; cls: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = {
  open:     { label: 'Open',     cls: 'bg-red-50     border-red-200    text-red-600',     icon: AlertTriangle },
  resolved: { label: 'Resolved', cls: 'bg-emerald-50  border-emerald-200 text-emerald-600', icon: CheckCheck   },
  warned:   { label: 'Warned',   cls: 'bg-amber-50   border-amber-200  text-amber-600',   icon: ShieldAlert   },
  banned:   { label: 'Banned',   cls: 'bg-red-50     border-red-300    text-red-700',     icon: Ban           },
};

const TYPE_LABELS: Record<string, string> = {
  'no-show':     'No-show',
  'late-cancel': 'Late Cancellation',
  'fake-review': 'Fake Review',
  'dress-code':  'Dress Code Violation',
  'payment':     'Payment Dispute',
  'harassment':  'Harassment',
};

/* ── Confirm overlay ─────────────────────────────────────────────────────── */
function ActionConfirm({
  action, onConfirm, onCancel,
}: {
  action: 'resolve' | 'warn' | 'ban'; onConfirm: () => void; onCancel: () => void;
}) {
  const META = {
    resolve: { title: 'Resolve dispute?',     body: 'Mark as resolved — no further action.',               btnLabel: 'Resolve',      btnClass: 'bg-emerald-500 text-white' },
    warn:    { title: 'Issue a warning?',     body: 'A formal warning is recorded on the user\'s profile.', btnLabel: 'Send Warning', btnClass: 'bg-amber-500 text-black'  },
    ban:     { title: 'Ban this user?',       body: 'Account will be suspended immediately.',               btnLabel: 'Ban User',     btnClass: 'bg-red-500 text-white'    },
  };
  const m = META[action];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-end justify-center px-4 pb-8"
      role="dialog" aria-modal="true" aria-label={m.title} onClick={onCancel}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }} transition={{ type: 'spring', stiffness: 360, damping: 36 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[400px] bg-white border border-[#DBDBDB] rounded-[20px] px-5 py-5"
      >
        <p className="text-black font-bold text-[17px] mb-1.5">{m.title}</p>
        <p className="text-[#737373] text-[14px] mb-5 leading-relaxed">{m.body}</p>
        <div className="flex gap-3">
          <button type="button" aria-label="Cancel" onClick={onCancel}
            className="flex-1 h-[48px] rounded-[8px] bg-white border border-[#DBDBDB] text-black font-semibold text-[14px]">
            Cancel
          </button>
          <button type="button" onClick={onConfirm}
            className={`flex-1 h-[48px] rounded-[8px] font-bold text-[14px] ${m.btnClass}`}>
            {m.btnLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Skeleton ────────────────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="bg-white border border-[#DBDBDB] rounded-[12px] p-4 mb-3 animate-pulse">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 flex flex-col gap-1.5 pr-2">
          <div className="h-3.5 w-28 bg-[#E5E7EB] rounded-full" />
          <div className="h-2.5 w-40 bg-[#E5E7EB] rounded-full" />
        </div>
        <div className="h-5 w-16 bg-[#E5E7EB] rounded-full" />
      </div>
      <div className="h-16 bg-[#E5E7EB] rounded-[8px] mb-3" />
      <div className="flex gap-2">
        <div className="flex-1 h-[38px] bg-[#E5E7EB] rounded-[8px]" />
        <div className="flex-1 h-[38px] bg-[#E5E7EB] rounded-[8px]" />
        <div className="flex-1 h-[38px] bg-[#E5E7EB] rounded-[8px]" />
      </div>
    </div>
  );
}

/* ── Dispute card ────────────────────────────────────────────────────────── */
function DisputeCard({ dispute }: { dispute: AdminDisputeRow }) {
  const updateDispute = useUpdateDispute();
  const [pendingAction, setPendingAction] = useState<'resolve' | 'warn' | 'ban' | null>(null);

  const meta   = STATUS_META[dispute.status];
  const Icon   = meta.icon;
  const isOpen = dispute.status === 'open';

  const typeLabel = TYPE_LABELS[dispute.type] ?? dispute.type;

  const reportedAt = new Date(dispute.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  function confirm() {
    if (!pendingAction) return;
    const statusMap = { resolve: 'resolved', warn: 'warned', ban: 'banned' } as const;
    updateDispute.mutate({ id: dispute.id, status: statusMap[pendingAction] });
    setPendingAction(null);
  }

  return (
    <>
      <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.22 }}
        className={`border rounded-[12px] p-4 mb-3 ${
          isOpen ? 'bg-white border-red-200' : 'bg-[#FAFAFA] border-[#DBDBDB]'
        }`} role="listitem"
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <p className="text-black font-bold text-[15px]">
                {dispute.reported_user_id
                  ? `User #${dispute.reported_user_id.slice(0, 8)}…`
                  : 'Unknown User'}
              </p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${meta.cls}`}>
                <Icon size={9} aria-hidden />
                {meta.label}
              </span>
            </div>
            <p className="text-[#737373] text-[12px]">
              {typeLabel}
              {dispute.reported_by_user_id && ` · Reported by #${dispute.reported_by_user_id.slice(0, 8)}…`}
            </p>
          </div>
        </div>

        <div className={`rounded-[8px] px-3.5 py-2.5 mb-3 ${
          isOpen ? 'bg-red-50 border border-red-200' : 'bg-[#FAFAFA] border border-[#DBDBDB]'
        }`}>
          <p className={`text-[13px] leading-relaxed ${isOpen ? 'text-[#737373]' : 'text-[#AAAAAA]'}`}>
            {dispute.reason}
          </p>
        </div>

        {dispute.resolution_note && !isOpen && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-[8px] px-3.5 py-2.5 mb-3">
            <p className="text-emerald-600 text-[11px] font-bold uppercase tracking-wider mb-0.5">Resolution Note</p>
            <p className="text-emerald-700 text-[12px]">{dispute.resolution_note}</p>
          </div>
        )}

        <div className="flex items-center gap-1.5 mb-3">
          <Clock size={11} aria-hidden className="text-[#AAAAAA]" />
          <p className="text-[#AAAAAA] text-[11px]">{reportedAt}</p>
        </div>

        {isOpen && (
          <div className="flex gap-2">
            <motion.button type="button" whileTap={{ scale: 0.95 }}
              disabled={updateDispute.isPending}
              aria-label="Resolve dispute"
              onClick={() => setPendingAction('resolve')}
              className="flex-1 h-[38px] rounded-[8px] bg-emerald-50 border border-emerald-200 text-emerald-600 text-[12px] font-bold flex items-center justify-center gap-1.5">
              <CheckCircle2 size={13} aria-hidden /> Resolve
            </motion.button>
            <motion.button type="button" whileTap={{ scale: 0.95 }}
              disabled={updateDispute.isPending}
              aria-label="Issue warning"
              onClick={() => setPendingAction('warn')}
              className="flex-1 h-[38px] rounded-[8px] bg-amber-50 border border-amber-200 text-amber-600 text-[12px] font-bold flex items-center justify-center gap-1.5">
              <ShieldAlert size={13} aria-hidden /> Warn
            </motion.button>
            <motion.button type="button" whileTap={{ scale: 0.95 }}
              disabled={updateDispute.isPending}
              aria-label="Ban user"
              onClick={() => setPendingAction('ban')}
              className="flex-1 h-[38px] rounded-[8px] bg-red-50 border border-red-200 text-red-600 text-[12px] font-bold flex items-center justify-center gap-1.5">
              <Ban size={13} aria-hidden /> Ban
            </motion.button>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {pendingAction && (
          <ActionConfirm key={pendingAction} action={pendingAction}
            onConfirm={confirm} onCancel={() => setPendingAction(null)} />
        )}
      </AnimatePresence>
    </>
  );
}

/* ── Filter types ────────────────────────────────────────────────────────── */
type DisputeFilter = 'all' | DisputeStatus;

const FILTERS: { key: DisputeFilter; label: string }[] = [
  { key: 'all',      label: 'All'      },
  { key: 'open',     label: 'Open'     },
  { key: 'warned',   label: 'Warned'   },
  { key: 'resolved', label: 'Resolved' },
  { key: 'banned',   label: 'Banned'   },
];

/* ── AdminDisputes ───────────────────────────────────────────────────────── */
export function AdminDisputes() {
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<DisputeFilter>('all');

  useEffect(() => { initAdminSession().then((ok) => { if (!ok) navigate('/admin/login'); }); }, [navigate]);

  const { data: disputes = [], isLoading, isError } = useAdminDisputes();

  const filtered   = filter === 'all' ? disputes : disputes.filter((d) => d.status === filter);
  const openCount  = disputes.filter((d) => d.status === 'open').length;

  if (!isAdminAuthenticated()) return null;

  return (
    <div className="min-h-[100dvh] bg-[#FAFAFA] flex flex-col pt-[60px]">

      <div className="sticky top-[60px] z-30 bg-white border-b border-[#DBDBDB] px-4 pt-4 pb-3">
        {openCount > 0 && (
          <div role="status" aria-label={`${openCount} open disputes`}
            className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-[8px] px-3.5 py-2.5 mb-3">
            <AlertTriangle size={14} aria-hidden className="text-red-500 flex-shrink-0" />
            <p className="text-red-600 text-[13px] font-semibold">
              {openCount} open dispute{openCount !== 1 ? 's' : ''} require attention
            </p>
          </div>
        )}
        <div className="flex gap-2 overflow-x-auto no-scrollbar" role="group" aria-label="Filter disputes">
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
        {!isLoading && (
          <p className="text-[#737373] text-[11px] font-medium mt-2">
            {filtered.length} case{filtered.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-12" role="list" aria-label="Dispute cases">
        {isLoading && Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}

        {isError && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <AlertCircle size={32} aria-hidden className="text-red-400" />
            <p className="text-[#737373] text-[14px]">Could not load disputes.</p>
          </div>
        )}

        {!isLoading && !isError && (
          <AnimatePresence>
            {filtered.map((d) => <DisputeCard key={d.id} dispute={d} />)}
          </AnimatePresence>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <CheckCircle2 size={32} aria-hidden className="text-[#DBDBDB]" />
            <p className="text-[#AAAAAA] text-[14px]">
              {filter === 'open' ? 'No open disputes — all clear.' : 'No cases in this category.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
