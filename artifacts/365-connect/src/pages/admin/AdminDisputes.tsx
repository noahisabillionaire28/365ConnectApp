import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle2, ShieldAlert, Ban, Clock, CheckCheck } from 'lucide-react';
import { isAdminAuthenticated } from '@/store/adminStore';
import { AdminNav } from '@/components/AdminNav';
import { ADMIN_DISPUTES, type AdminDispute, type DisputeStatus, type DisputeType } from '@/data/mockAdmin';

/* ── Status & type metadata ─────────────────────────────────────────────── */
const STATUS_META: Record<DisputeStatus, {
  label: string; cls: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = {
  open:     { label: 'Open',     cls: 'bg-red-50     border-red-200    text-red-600',     icon: AlertTriangle },
  resolved: { label: 'Resolved', cls: 'bg-emerald-50  border-emerald-200 text-emerald-600', icon: CheckCheck   },
  warned:   { label: 'Warned',   cls: 'bg-amber-50   border-amber-200  text-amber-600',   icon: ShieldAlert   },
  banned:   { label: 'Banned',   cls: 'bg-red-50     border-red-300    text-red-700',     icon: Ban           },
};

const TYPE_LABELS: Record<DisputeType, string> = {
  'no-show':     'No-show',
  'late-cancel': 'Late Cancellation',
  'fake-review': 'Fake Review',
  'dress-code':  'Dress Code Violation',
  'payment':     'Payment Dispute',
  'harassment':  'Harassment',
};

/* ── Confirm overlay ─────────────────────────────────────────────────────── */
function ActionConfirm({ action, disputeUserName, onConfirm, onCancel }: {
  action: 'resolve' | 'warn' | 'ban'; disputeUserName: string; onConfirm: () => void; onCancel: () => void;
}) {
  const META = {
    resolve: {
      title: 'Resolve this dispute?',
      body: `Mark the case against ${disputeUserName} as resolved. No further action will be taken.`,
      btnLabel: 'Resolve', btnClass: 'bg-emerald-500 text-white',
    },
    warn: {
      title: `Warn ${disputeUserName}?`,
      body: `A formal warning will be issued. This is recorded on their profile. A second warning may result in suspension.`,
      btnLabel: 'Send Warning', btnClass: 'bg-amber-500 text-black',
    },
    ban: {
      title: `Ban ${disputeUserName}?`,
      body: `This will immediately suspend their account. They will see "Account Suspended" when they try to log in.`,
      btnLabel: 'Ban User', btnClass: 'bg-red-500 text-white',
    },
  };
  const m = META[action];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-end justify-center px-4 pb-8"
      role="dialog" aria-modal="true" aria-label={m.title} onClick={onCancel}>
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }} transition={{ type: 'spring', stiffness: 360, damping: 36 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[400px] bg-white border border-[#DBDBDB] rounded-[20px] px-5 py-5">
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

/* ── Dispute card ────────────────────────────────────────────────────────── */
function DisputeCard({ dispute, onAction }: {
  dispute: AdminDispute; onAction: (id: string, action: 'resolve' | 'warn' | 'ban') => void;
}) {
  const statusMeta = STATUS_META[dispute.status];
  const StatusIcon = statusMeta.icon;
  const isOpen = dispute.status === 'open';

  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.22 }}
      className={`border rounded-[12px] p-4 mb-3 ${
        isOpen ? 'bg-white border-red-200' : 'bg-[#FAFAFA] border-[#DBDBDB]'
      }`} role="listitem">

      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-black font-bold text-[15px]">{dispute.reportedUserName}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusMeta.cls} flex items-center gap-1`}>
              <StatusIcon size={9} aria-hidden />
              {statusMeta.label}
            </span>
          </div>
          <p className="text-[#737373] text-[12px]">
            {TYPE_LABELS[dispute.type]} · Reported by {dispute.reportedByName}
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

      <div className="flex items-center gap-1.5 mb-3">
        <Clock size={11} aria-hidden className="text-[#AAAAAA]" />
        <p className="text-[#AAAAAA] text-[11px]">{dispute.timestamp}</p>
      </div>

      {isOpen && (
        <div className="flex gap-2">
          <motion.button type="button" whileTap={{ scale: 0.95 }}
            aria-label={`Resolve dispute against ${dispute.reportedUserName}`}
            onClick={() => onAction(dispute.id, 'resolve')}
            className="flex-1 h-[38px] rounded-[8px] bg-emerald-50 border border-emerald-200 text-emerald-600 text-[12px] font-bold flex items-center justify-center gap-1.5">
            <CheckCircle2 size={13} aria-hidden />
            Resolve
          </motion.button>
          <motion.button type="button" whileTap={{ scale: 0.95 }}
            aria-label={`Issue warning to ${dispute.reportedUserName}`}
            onClick={() => onAction(dispute.id, 'warn')}
            className="flex-1 h-[38px] rounded-[8px] bg-amber-50 border border-amber-200 text-amber-600 text-[12px] font-bold flex items-center justify-center gap-1.5">
            <ShieldAlert size={13} aria-hidden />
            Warn
          </motion.button>
          <motion.button type="button" whileTap={{ scale: 0.95 }}
            aria-label={`Ban ${dispute.reportedUserName}`}
            onClick={() => onAction(dispute.id, 'ban')}
            className="flex-1 h-[38px] rounded-[8px] bg-red-50 border border-red-200 text-red-600 text-[12px] font-bold flex items-center justify-center gap-1.5">
            <Ban size={13} aria-hidden />
            Ban
          </motion.button>
        </div>
      )}
    </motion.div>
  );
}

/* ── AdminDisputes ───────────────────────────────────────────────────────── */
type DisputeFilter = 'all' | DisputeStatus;

const DISPUTE_FILTERS: { key: DisputeFilter; label: string }[] = [
  { key: 'all',      label: 'All'      },
  { key: 'open',     label: 'Open'     },
  { key: 'warned',   label: 'Warned'   },
  { key: 'resolved', label: 'Resolved' },
  { key: 'banned',   label: 'Banned'   },
];

export function AdminDisputes() {
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isAdminAuthenticated()) navigate('/admin/login');
  }, [navigate]);

  const [disputes,      setDisputes]      = useState<AdminDispute[]>(ADMIN_DISPUTES);
  const [filter,        setFilter]        = useState<DisputeFilter>('all');
  const [pendingAction, setPendingAction] = useState<{ id: string; action: 'resolve' | 'warn' | 'ban' } | null>(null);

  const filtered  = filter === 'all' ? disputes : disputes.filter((d) => d.status === filter);
  const openCount = disputes.filter((d) => d.status === 'open').length;

  function requestAction(id: string, action: 'resolve' | 'warn' | 'ban') { setPendingAction({ id, action }); }

  function confirmAction() {
    if (!pendingAction) return;
    const { id, action } = pendingAction;
    const newStatus: DisputeStatus = action === 'resolve' ? 'resolved' : action === 'warn' ? 'warned' : 'banned';
    setDisputes((prev) => prev.map((d) => (d.id === id ? { ...d, status: newStatus } : d)));
    setPendingAction(null);
  }

  const pendingDispute = pendingAction ? disputes.find((d) => d.id === pendingAction.id) : null;

  if (!isAdminAuthenticated()) return null;

  return (
    <div className="min-h-[100dvh] bg-[#FAFAFA] flex flex-col">
      <AdminNav />

      <div className="sticky top-[96px] z-30 bg-white border-b border-[#DBDBDB] px-4 pt-4 pb-3">
        {openCount > 0 && (
          <div role="status" aria-label={`${openCount} open disputes requiring attention`}
            className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-[8px] px-3.5 py-2.5 mb-3">
            <AlertTriangle size={14} aria-hidden className="text-red-500 flex-shrink-0" />
            <p className="text-red-600 text-[13px] font-semibold">
              {openCount} open dispute{openCount !== 1 ? 's' : ''} require attention
            </p>
          </div>
        )}
        <div className="flex gap-2 overflow-x-auto no-scrollbar" role="group" aria-label="Filter disputes by status">
          {DISPUTE_FILTERS.map(({ key, label }) => (
            <button key={key} type="button" aria-pressed={filter === key}
              aria-label={`Filter disputes by ${label}`} onClick={() => setFilter(key)}
              className={`flex-shrink-0 h-[32px] px-3.5 rounded-full text-[12px] font-semibold border transition-all ${
                filter === key ? 'bg-black text-white border-black' : 'bg-white border-[#DBDBDB] text-[#737373]'
              }`}>
              {label}
            </button>
          ))}
        </div>
        <p className="text-[#737373] text-[11px] font-medium mt-2">
          {filtered.length} case{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-12" role="list" aria-label="Dispute cases">
        <AnimatePresence>
          {filtered.map((dispute) => (
            <DisputeCard key={dispute.id} dispute={dispute} onAction={requestAction} />
          ))}
        </AnimatePresence>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <CheckCircle2 size={32} aria-hidden className="text-[#DBDBDB]" />
            <p className="text-[#AAAAAA] text-[14px]">No cases in this category.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {pendingAction && pendingDispute && (
          <ActionConfirm key={`${pendingAction.id}-${pendingAction.action}`}
            action={pendingAction.action} disputeUserName={pendingDispute.reportedUserName}
            onConfirm={confirmAction} onCancel={() => setPendingAction(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
