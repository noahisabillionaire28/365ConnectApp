import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, ChevronDown, Users, DollarSign,
  Calendar, XCircle, RefreshCw, ChevronRight,
} from 'lucide-react';
import { isAdminAuthenticated } from '@/store/adminStore';
import { AdminNav } from '@/components/AdminNav';
import {
  ADMIN_SHIFTS, ADMIN_USERS,
  type AdminShift, type ShiftStatus,
} from '@/data/mockAdmin';

/* ─── Status badge ───────────────────────────────────────────────────────── */
const STATUS_META: Record<ShiftStatus, { label: string; cls: string }> = {
  'open':        { label: 'Open',        cls: 'bg-primary/15    border-primary/30    text-primary'    },
  'filled':      { label: 'Filled',      cls: 'bg-blue-500/15   border-blue-500/30   text-blue-400'   },
  'in-progress': { label: 'In Progress', cls: 'bg-amber-500/15  border-amber-500/30  text-amber-400'  },
  'completed':   { label: 'Completed',   cls: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' },
  'cancelled':   { label: 'Cancelled',   cls: 'bg-red-500/15    border-red-500/30    text-red-400'    },
};

function ShiftStatusBadge({ status }: { status: ShiftStatus }) {
  const { label, cls } = STATUS_META[status];
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border flex-shrink-0 ${cls}`}>
      {label}
    </span>
  );
}

/* ─── Applicants sheet ───────────────────────────────────────────────────── */
function ApplicantsSheet({
  shift, onClose,
}: {
  shift: AdminShift;
  onClose: () => void;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 360, damping: 38 }}
        className="fixed bottom-0 left-0 right-0 max-h-[80dvh] bg-[#050505] border-t border-[#1A1A1A] rounded-t-[24px] z-50 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={`Applicants for ${shift.jobType}`}
      >
        <div aria-hidden className="w-10 h-1 rounded-full bg-[#222] mx-auto mt-3 mb-4 flex-shrink-0" />
        <div className="px-5 pb-6 overflow-y-auto flex-1">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-white font-bold text-[18px]">{shift.jobType}</h2>
              <p className="text-[#444] text-[13px]">{shift.companyName} · {shift.date}</p>
            </div>
            <button
              type="button"
              aria-label="Close applicants panel"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#111] border border-[#1E1E1E] flex items-center justify-center"
            >
              <X size={14} aria-hidden className="text-[#555]" />
            </button>
          </div>

          <p className="text-[#333] text-[11px] font-bold uppercase tracking-wider mb-3">
            {shift.applicants.length} Applicant{shift.applicants.length !== 1 ? 's' : ''}
          </p>

          {shift.applicants.length === 0 ? (
            <p className="text-[#333] text-[14px] text-center py-8">No applicants yet.</p>
          ) : (
            <div className="flex flex-col gap-2.5" role="list" aria-label="Applicants">
              {shift.applicants.map((a) => {
                const user = ADMIN_USERS.find((u) => u.id === a.id);
                return (
                  <div
                    key={a.id}
                    role="listitem"
                    className="flex items-center gap-3 bg-[#0A0A0A] border border-[#141414] rounded-[14px] px-4 py-3"
                  >
                    <img
                      src={a.photoUrl}
                      alt={a.name}
                      loading="lazy"
                      decoding="async"
                      className="w-10 h-10 rounded-full object-cover border border-[#1A1A1A] flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-[14px] font-semibold truncate">{a.name}</p>
                      <p className="text-[#444] text-[12px]">
                        {user ? `${user.shiftsCompleted} shifts · ★${user.rating}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-primary font-bold text-[14px]">{a.matchPct}%</span>
                      <span className="text-[#333] text-[10px]">match</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

/* ─── Shift card ─────────────────────────────────────────────────────────── */
function ShiftCard({
  shift, onCancel, onViewApplicants,
}: {
  shift: AdminShift;
  onCancel: (id: string) => void;
  onViewApplicants: (s: AdminShift) => void;
}) {
  const canCancel = shift.status !== 'cancelled' && shift.status !== 'completed';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.22 }}
      className="bg-[#080808] border border-[#141414] rounded-[16px] p-4 mb-3"
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex-1 min-w-0 pr-2">
          <p className="text-white font-bold text-[15px] leading-tight">{shift.jobType}</p>
          <p className="text-[#444] text-[13px] mt-0.5">{shift.companyName}</p>
        </div>
        <ShiftStatusBadge status={shift.status} />
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-4 text-[12px] text-[#444] mb-3.5">
        <span className="flex items-center gap-1">
          <Calendar size={11} aria-hidden className="text-[#333]" />
          {shift.date}
        </span>
        <span className="flex items-center gap-1">
          <DollarSign size={11} aria-hidden className="text-[#333]" />
          ${shift.payRate}/hr
        </span>
        <span className="flex items-center gap-1">
          <Users size={11} aria-hidden className="text-[#333]" />
          {shift.workersNeeded} needed
        </span>
      </div>

      {/* Fee row */}
      {shift.platformFee > 0 && (
        <div className="flex items-center justify-between mb-3.5 pb-3.5 border-b border-[#0D0D0D]">
          <p className="text-[#333] text-[12px]">Platform fee (8%)</p>
          <p className="text-primary font-bold text-[13px]">${shift.platformFee}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          aria-label={`View ${shift.applicants.length} applicants for ${shift.jobType}`}
          onClick={() => onViewApplicants(shift)}
          className="flex-1 h-[38px] rounded-[10px] bg-[#111] border border-[#1E1E1E] text-white text-[12px] font-semibold flex items-center justify-center gap-1.5"
        >
          <Users size={13} aria-hidden />
          {shift.applicants.length} Applicants
        </button>
        {canCancel && (
          <button
            type="button"
            aria-label={`Cancel ${shift.jobType} shift`}
            onClick={() => onCancel(shift.id)}
            className="h-[38px] px-3.5 rounded-[10px] bg-red-500/10 border border-red-500/25 text-red-400 text-[12px] font-semibold flex items-center justify-center gap-1"
          >
            <XCircle size={13} aria-hidden />
            Cancel
          </button>
        )}
        {shift.status === 'open' && (
          <button
            type="button"
            aria-label={`Reassign ${shift.jobType} shift`}
            className="h-[38px] px-3.5 rounded-[10px] bg-blue-500/10 border border-blue-500/25 text-blue-400 text-[12px] font-semibold flex items-center justify-center gap-1"
          >
            <RefreshCw size={12} aria-hidden />
            Reassign
          </button>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Filter chips ───────────────────────────────────────────────────────── */
type ShiftFilter = 'all' | ShiftStatus;

const SHIFT_FILTERS: { key: ShiftFilter; label: string }[] = [
  { key: 'all',         label: 'All'         },
  { key: 'open',        label: 'Open'        },
  { key: 'filled',      label: 'Filled'      },
  { key: 'in-progress', label: 'In Progress' },
  { key: 'completed',   label: 'Completed'   },
  { key: 'cancelled',   label: 'Cancelled'   },
];

/* ─── AdminShifts ────────────────────────────────────────────────────────── */
export function AdminShifts() {
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isAdminAuthenticated()) navigate('/admin/login');
  }, [navigate]);

  const [shifts,          setShifts]          = useState<AdminShift[]>(ADMIN_SHIFTS);
  const [filter,          setFilter]          = useState<ShiftFilter>('all');
  const [search,          setSearch]          = useState('');
  const [applicantsShift, setApplicantsShift] = useState<AdminShift | null>(null);

  const filtered = useMemo(() => {
    return shifts.filter((s) => {
      const matchFilter = filter === 'all' || s.status === filter;
      const matchSearch =
        !search.trim() ||
        s.jobType.toLowerCase().includes(search.toLowerCase()) ||
        s.companyName.toLowerCase().includes(search.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [shifts, filter, search]);

  function handleCancel(id: string) {
    setShifts((prev) => prev.map((s) => s.id === id ? { ...s, status: 'cancelled' } : s));
  }

  if (!isAdminAuthenticated()) return null;

  return (
    <div className="min-h-[100dvh] bg-black flex flex-col">
      <AdminNav />

      {/* Sticky search + filter */}
      <div className="sticky top-[96px] z-30 bg-black border-b border-[#0D0D0D] px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 bg-[#0A0A0A] border border-[#1A1A1A] rounded-[12px] px-3 h-[40px] mb-3">
          <Search size={14} aria-hidden className="text-[#333] flex-shrink-0" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search shifts…"
            aria-label="Search shifts by role or venue"
            className="flex-1 bg-transparent text-white text-[14px] placeholder:text-[#222] focus:outline-none"
          />
          {search && (
            <button type="button" aria-label="Clear search" onClick={() => setSearch('')}>
              <X size={13} aria-hidden className="text-[#444]" />
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar" role="group" aria-label="Filter shifts by status">
          {SHIFT_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              aria-label={`Filter shifts by ${label}`}
              onClick={() => setFilter(key)}
              className={`flex-shrink-0 h-[32px] px-3.5 rounded-full text-[12px] font-semibold border transition-all ${
                filter === key
                  ? 'bg-primary/15 border-primary/40 text-primary'
                  : 'bg-[#0A0A0A] border-[#1A1A1A] text-[#444]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[#2A2A2A] text-[11px] font-medium mt-2">{filtered.length} shift{filtered.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Shift cards */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-12" role="list" aria-label="Shift list">
        <AnimatePresence>
          {filtered.map((shift) => (
            <div key={shift.id} role="listitem">
              <ShiftCard
                shift={shift}
                onCancel={handleCancel}
                onViewApplicants={setApplicantsShift}
              />
            </div>
          ))}
        </AnimatePresence>
        {filtered.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <p className="text-[#222] text-[14px]">No shifts match this filter.</p>
          </div>
        )}
      </div>

      {/* Applicants sheet */}
      <AnimatePresence>
        {applicantsShift && (
          <ApplicantsSheet
            key={applicantsShift.id}
            shift={applicantsShift}
            onClose={() => setApplicantsShift(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
