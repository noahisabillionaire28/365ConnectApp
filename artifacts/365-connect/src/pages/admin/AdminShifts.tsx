import { useState, useMemo } from 'react';
import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Users, DollarSign, Calendar, XCircle, AlertCircle } from 'lucide-react';
import { isAdminAuthenticated, initAdminSession } from '@/store/adminStore';
import { useAdminShifts, useCancelShift } from '@/hooks/useAdminData';
import type { AdminShiftRow } from '@/lib/adminApi';

/* ── Status badge ────────────────────────────────────────────────────────── */
type ShiftStatus = AdminShiftRow['status'];

const STATUS_META: Record<ShiftStatus, { label: string; cls: string }> = {
  open:      { label: 'Open',      cls: 'bg-black/5     border-black/15    text-black'       },
  filled:    { label: 'Filled',    cls: 'bg-blue-50     border-blue-200    text-blue-600'    },
  completed: { label: 'Completed', cls: 'bg-emerald-50  border-emerald-200 text-emerald-600' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-50      border-red-200     text-red-600'     },
};

function StatusBadge({ status }: { status: ShiftStatus }) {
  const { label, cls } = STATUS_META[status] ?? STATUS_META.open;
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border flex-shrink-0 ${cls}`}>
      {label}
    </span>
  );
}

/* ── Skeleton card ───────────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="bg-white border border-[#DBDBDB] rounded-[12px] p-4 mb-3 animate-pulse">
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex-1 flex flex-col gap-1.5 pr-2">
          <div className="h-3.5 w-32 bg-[#E5E7EB] rounded-full" />
          <div className="h-2.5 w-24 bg-[#E5E7EB] rounded-full" />
        </div>
        <div className="h-5 w-16 bg-[#E5E7EB] rounded-full" />
      </div>
      <div className="flex items-center gap-4 mb-3.5">
        <div className="h-2.5 w-20 bg-[#E5E7EB] rounded-full" />
        <div className="h-2.5 w-14 bg-[#E5E7EB] rounded-full" />
        <div className="h-2.5 w-16 bg-[#E5E7EB] rounded-full" />
      </div>
      <div className="h-[38px] bg-[#E5E7EB] rounded-[8px]" />
    </div>
  );
}

/* ── Shift card ──────────────────────────────────────────────────────────── */
function ShiftCard({ shift }: { shift: AdminShiftRow }) {
  const cancelShift = useCancelShift();
  const [confirm, setConfirm] = useState(false);

  const canCancel = shift.status !== 'cancelled' && shift.status !== 'completed';

  const displayDate = shift.date
    ? shift.date
    : new Date(shift.start_time).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
      });

  const spotsLeft = Math.max(0, shift.spots_available - shift.spots_filled);
  const gross     = (shift.pay_rate ?? 0) * shift.spots_available;
  const fee       = Math.round(gross * 0.08 * 100) / 100;

  function handleCancel() {
    cancelShift.mutate(shift.id);
    setConfirm(false);
  }

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.22 }}
      className="bg-white border border-[#DBDBDB] rounded-[12px] p-4 mb-3"
    >
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex-1 min-w-0 pr-2">
          <p className="text-black font-bold text-[15px] leading-tight truncate">
            {shift.job_type || shift.title}
          </p>
          <p className="text-[#737373] text-[13px] mt-0.5 truncate">
            {shift.company_name ?? 'Private Client'}
          </p>
        </div>
        <StatusBadge status={shift.status} />
      </div>

      <div className="flex items-center gap-4 text-[12px] text-[#737373] mb-3.5 flex-wrap">
        <span className="flex items-center gap-1">
          <Calendar size={11} aria-hidden className="text-[#AAAAAA]" />
          {displayDate}
        </span>
        {(shift.pay_rate ?? 0) > 0 && (
          <span className="flex items-center gap-1">
            <DollarSign size={11} aria-hidden className="text-[#AAAAAA]" />
            ${shift.pay_rate}/hr
          </span>
        )}
        <span className="flex items-center gap-1">
          <Users size={11} aria-hidden className="text-[#AAAAAA]" />
          {spotsLeft} of {shift.spots_available} open
        </span>
      </div>

      {fee > 0 && (
        <div className="flex items-center justify-between mb-3.5 pb-3.5 border-b border-[#DBDBDB]">
          <p className="text-[#737373] text-[12px]">Est. platform fee (8%)</p>
          <p className="text-black font-bold text-[13px]">${fee.toFixed(2)}</p>
        </div>
      )}

      {canCancel && (
        confirm ? (
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirm(false)}
              aria-label="Cancel — go back"
              className="flex-1 h-[38px] rounded-[8px] bg-white border border-[#DBDBDB] text-[#737373] text-[12px] font-semibold">
              Go Back
            </button>
            <button type="button" disabled={cancelShift.isPending}
              onClick={handleCancel} aria-label="Confirm shift cancellation"
              className="flex-1 h-[38px] rounded-[8px] bg-red-500 text-white text-[12px] font-bold flex items-center justify-center gap-1">
              {cancelShift.isPending ? (
                <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <><XCircle size={13} aria-hidden />Confirm Cancel</>
              )}
            </button>
          </div>
        ) : (
          <button type="button" aria-label={`Cancel ${shift.job_type} shift`}
            onClick={() => setConfirm(true)}
            className="w-full h-[38px] rounded-[8px] bg-red-50 border border-red-200 text-red-600 text-[12px] font-semibold flex items-center justify-center gap-1.5">
            <XCircle size={13} aria-hidden /> Cancel Shift
          </button>
        )
      )}
    </motion.div>
  );
}

/* ── Filter types ────────────────────────────────────────────────────────── */
type ShiftFilter = 'all' | ShiftStatus;

const FILTERS: { key: ShiftFilter; label: string }[] = [
  { key: 'all',       label: 'All'       },
  { key: 'open',      label: 'Open'      },
  { key: 'filled',    label: 'Filled'    },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

/* ── AdminShifts ─────────────────────────────────────────────────────────── */
export function AdminShifts() {
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<ShiftFilter>('all');
  const [search, setSearch] = useState('');

  useEffect(() => { initAdminSession().then((ok) => { if (!ok) navigate('/admin/login'); }); }, [navigate]);

  const { data: shifts = [], isLoading, isError } = useAdminShifts();

  const filtered = useMemo(() => shifts.filter((s) => {
    const matchFilter = filter === 'all' || s.status === filter;
    const matchSearch = !search.trim() ||
      (s.job_type ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (s.company_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (s.title ?? '').toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  }), [shifts, filter, search]);

  if (!isAdminAuthenticated()) return null;

  return (
    <div className="min-h-[100dvh] bg-[#FAFAFA] flex flex-col pt-[60px]">

      <div className="sticky top-[60px] z-30 bg-white border-b border-[#DBDBDB] px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 bg-[#FAFAFA] border border-[#DBDBDB] rounded-[8px] px-3 h-[40px] mb-3">
          <Search size={14} aria-hidden className="text-[#737373] flex-shrink-0" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by role or venue…" aria-label="Search shifts"
            className="flex-1 bg-transparent text-black text-[14px] placeholder:text-[#AAAAAA] focus:outline-none" />
          {search && (
            <button type="button" aria-label="Clear" onClick={() => setSearch('')}>
              <X size={13} aria-hidden className="text-[#737373]" />
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar" role="group" aria-label="Filter shifts">
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
            {filtered.length} of {shifts.length} shift{shifts.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-12" role="list" aria-label="Shift list">
        {isLoading && Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}

        {isError && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 px-8">
            <AlertCircle size={32} aria-hidden className="text-red-400" />
            <p className="text-[#737373] text-[14px] text-center">
              Could not load shifts. Check API server connection.
            </p>
          </div>
        )}

        {!isLoading && !isError && (
          <AnimatePresence>
            {filtered.map((shift) => (
              <div key={shift.id} role="listitem">
                <ShiftCard shift={shift} />
              </div>
            ))}
          </AnimatePresence>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <p className="text-[#AAAAAA] text-[14px]">No shifts match this filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
