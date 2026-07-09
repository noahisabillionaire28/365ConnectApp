import { useState, useMemo } from 'react';
import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, Ban, Flag, ChevronRight, Star, BadgeCheck, AlertCircle,
} from 'lucide-react';
import { isAdminAuthenticated, initAdminSession } from '@/store/adminStore';
import { useAdminUsers, useUpdateUser } from '@/hooks/useAdminData';
import type { AdminUserRow } from '@/lib/adminApi';

/* ── Shared types ────────────────────────────────────────────────────────── */
type FilterOpt = 'all' | 'worker' | 'client' | 'admin' | 'staffer' | 'active' | 'suspended' | 'flagged';

/* ── Badges ──────────────────────────────────────────────────────────────── */
const ROLE_CLS: Record<string, string> = {
  worker:  'bg-blue-50  border-blue-200  text-blue-600',
  client:  'bg-purple-50 border-purple-200 text-purple-600',
  admin:   'bg-black/5   border-black/20  text-black',
  staffer: 'bg-teal-50   border-teal-200  text-teal-600',
};

const STATUS_CLS: Record<string, string> = {
  active:    'bg-emerald-50  border-emerald-200 text-emerald-600',
  suspended: 'bg-red-50      border-red-200    text-red-600',
  flagged:   'bg-amber-50    border-amber-200  text-amber-600',
};

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${ROLE_CLS[role] ?? ROLE_CLS.admin}`}>
      {role}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = status === 'suspended' ? 'Suspended' : status === 'flagged' ? 'Flagged ⚠' : 'Active';
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_CLS[status] ?? STATUS_CLS.active}`}>
      {label}
    </span>
  );
}

/* ── Skeleton row ────────────────────────────────────────────────────────── */
function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#DBDBDB] animate-pulse">
      <div className="w-10 h-10 rounded-full bg-[#E5E7EB] flex-shrink-0" />
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="h-3 w-32 bg-[#E5E7EB] rounded-full" />
        <div className="h-2.5 w-48 bg-[#E5E7EB] rounded-full" />
      </div>
    </div>
  );
}

/* ── Confirm overlay ─────────────────────────────────────────────────────── */
function ConfirmOverlay({
  message, confirmLabel, confirmClass, onConfirm, onCancel,
}: {
  message: string; confirmLabel: string; confirmClass: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-end justify-center px-4 pb-8"
      role="dialog" aria-modal="true" aria-label="Confirm action" onClick={onCancel}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }} transition={{ type: 'spring', stiffness: 360, damping: 36 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[400px] bg-white border border-[#DBDBDB] rounded-[20px] px-5 py-5"
      >
        <p className="text-black text-[16px] font-semibold mb-1.5">Are you sure?</p>
        <p className="text-[#737373] text-[14px] mb-5 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button type="button" aria-label="Cancel" onClick={onCancel}
            className="flex-1 h-[48px] rounded-[8px] bg-white border border-[#DBDBDB] text-black font-semibold text-[14px]">
            Cancel
          </button>
          <button type="button" onClick={onConfirm}
            className={`flex-1 h-[48px] rounded-[8px] font-bold text-[14px] ${confirmClass}`}>
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── User detail sheet ───────────────────────────────────────────────────── */
function UserDetailSheet({
  user, onClose,
}: { user: AdminUserRow; onClose: () => void }) {
  const updateUser = useUpdateUser();
  const [confirmOp, setConfirmOp] = useState<'ban' | 'unban' | 'flag' | 'unflag' | null>(null);
  const [busy, setBusy]           = useState(false);

  const isBanned  = user.status === 'suspended';
  const isFlagged = user.status === 'flagged';
  const joinDate  = new Date(user.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  async function applyUpdate(updates: Parameters<typeof updateUser.mutateAsync>[0]['body']) {
    setBusy(true);
    try { await updateUser.mutateAsync({ id: user.id, body: updates }); }
    finally { setBusy(false); setConfirmOp(null); }
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={onClose} aria-hidden />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 360, damping: 38 }}
        className="fixed bottom-0 left-0 right-0 max-h-[88dvh] bg-white border-t border-[#DBDBDB] rounded-t-[24px] z-50 flex flex-col overflow-hidden"
        role="dialog" aria-modal="true" aria-label={`User: ${user.username ?? user.email}`}
      >
        <div aria-hidden className="w-10 h-1 rounded-full bg-[#DBDBDB] mx-auto mt-3 mb-4 flex-shrink-0" />

        <div className="overflow-y-auto flex-1 px-5 pb-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="relative">
                {user.photo_url ? (
                  <img src={user.photo_url} alt={user.username ?? 'User'} loading="lazy"
                    className="w-14 h-14 rounded-full object-cover border border-[#DBDBDB]" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center">
                    <span className="text-black font-bold text-[18px]">
                      {(user.username ?? user.email ?? 'U').slice(0, 1).toUpperCase()}
                    </span>
                  </div>
                )}
                {isBanned && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center border border-white">
                    <Ban size={10} aria-hidden className="text-white" />
                  </div>
                )}
                {isFlagged && !isBanned && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center border border-white">
                    <Flag size={10} aria-hidden className="text-black" />
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-black font-bold text-[17px]">
                    {user.username ? `@${user.username}` : user.email}
                  </p>
                  {user.is_pro && <BadgeCheck size={16} aria-hidden className="text-[#FFD700]" />}
                </div>
                <p className="text-[#737373] text-[12px]">{user.email}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <RoleBadge role={user.role} />
                  <StatusBadge status={user.status ?? 'active'} />
                </div>
              </div>
            </div>
            <button type="button" aria-label="Close panel" onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center flex-shrink-0">
              <X size={14} aria-hidden className="text-[#737373]" />
            </button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            {[
              { label: 'Joined',  value: joinDate.replace(', 20', ' \'') },
              { label: 'Rating',  value: user.rating > 0 ? user.rating.toFixed(1) : 'N/A' },
              { label: 'Pro',     value: user.is_pro ? 'Yes' : 'No' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[#FAFAFA] border border-[#DBDBDB] rounded-[12px] py-3 px-3 text-center">
                <p className="text-black font-bold text-[14px] leading-tight">{value}</p>
                <p className="text-[#737373] text-[10px] font-semibold uppercase tracking-wide mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <button type="button" disabled={busy}
              aria-label={isFlagged ? 'Remove flag' : 'Flag user with a warning'}
              onClick={() => setConfirmOp(isFlagged ? 'unflag' : 'flag')}
              className="w-full h-[48px] rounded-[8px] bg-amber-50 border border-amber-200 text-amber-600 font-semibold text-[14px] flex items-center justify-center gap-2">
              <Flag size={15} aria-hidden />
              {isFlagged ? 'Remove Flag' : 'Flag User'}
            </button>
            <button type="button" disabled={busy}
              aria-label={isBanned ? 'Restore account' : 'Suspend account'}
              onClick={() => setConfirmOp(isBanned ? 'unban' : 'ban')}
              className="w-full h-[48px] rounded-[8px] bg-red-50 border border-red-200 text-red-600 font-bold text-[14px] flex items-center justify-center gap-2">
              <Ban size={15} aria-hidden />
              {isBanned ? 'Restore Account' : 'Suspend Account'}
            </button>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {confirmOp === 'ban' && (
          <ConfirmOverlay key="ban"
            message="This account will be suspended. The user will see 'Account Suspended' on login."
            confirmLabel="Suspend" confirmClass="bg-red-500 text-white"
            onConfirm={() => applyUpdate({ status: 'suspended' } as Parameters<typeof updateUser.mutateAsync>[0]['body'])}
            onCancel={() => setConfirmOp(null)} />
        )}
        {confirmOp === 'unban' && (
          <ConfirmOverlay key="unban"
            message="Restore this account? The user will regain full platform access."
            confirmLabel="Restore" confirmClass="bg-emerald-500 text-white"
            onConfirm={() => applyUpdate({ status: 'active' } as Parameters<typeof updateUser.mutateAsync>[0]['body'])}
            onCancel={() => setConfirmOp(null)} />
        )}
        {confirmOp === 'flag' && (
          <ConfirmOverlay key="flag"
            message="Flag this user? A warning will be noted on their profile for review."
            confirmLabel="Flag User" confirmClass="bg-amber-500 text-black"
            onConfirm={() => applyUpdate({ status: 'flagged' } as Parameters<typeof updateUser.mutateAsync>[0]['body'])}
            onCancel={() => setConfirmOp(null)} />
        )}
        {confirmOp === 'unflag' && (
          <ConfirmOverlay key="unflag"
            message="Remove the flag from this user's account?"
            confirmLabel="Remove Flag" confirmClass="bg-emerald-500 text-white"
            onConfirm={() => applyUpdate({ status: 'active' } as Parameters<typeof updateUser.mutateAsync>[0]['body'])}
            onCancel={() => setConfirmOp(null)} />
        )}
      </AnimatePresence>
    </>
  );
}

/* ── Filter chip ─────────────────────────────────────────────────────────── */
function FilterChip({ label, active, onSelect }: { label: string; active: boolean; onSelect: () => void }) {
  return (
    <button type="button" aria-pressed={active} aria-label={`Filter by ${label}`} onClick={onSelect}
      className={`flex-shrink-0 h-[32px] px-3.5 rounded-full text-[12px] font-semibold border transition-all ${
        active ? 'bg-black text-white border-black' : 'bg-white border-[#DBDBDB] text-[#737373]'
      }`}>
      {label}
    </button>
  );
}

/* ── User list row ───────────────────────────────────────────────────────── */
function UserListRow({ user, onOpen }: { user: AdminUserRow; onOpen: (u: AdminUserRow) => void }) {
  return (
    <motion.button type="button" aria-label={`Open profile for ${user.username ?? user.email}`}
      whileTap={{ backgroundColor: '#FAFAFA' }} onClick={() => onOpen(user)}
      className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-[#DBDBDB] text-left"
    >
      <div className="relative flex-shrink-0">
        {user.photo_url ? (
          <img src={user.photo_url} alt={user.username ?? ''} loading="lazy"
            className="w-10 h-10 rounded-full object-cover border border-[#DBDBDB]" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center">
            <span className="text-black font-bold text-[13px]">
              {(user.username ?? user.email ?? 'U').slice(0, 1).toUpperCase()}
            </span>
          </div>
        )}
        {user.status === 'suspended' && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full border border-white flex items-center justify-center">
            <Ban size={8} aria-hidden className="text-white" />
          </div>
        )}
        {user.status === 'flagged' && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-amber-500 rounded-full border border-white flex items-center justify-center">
            <Flag size={8} aria-hidden className="text-black" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <p className="text-black text-[14px] font-semibold truncate">
            {user.username ? `@${user.username}` : user.email}
          </p>
          {user.is_pro && <BadgeCheck size={13} aria-hidden className="text-[#FFD700] flex-shrink-0" />}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <RoleBadge role={user.role} />
          <StatusBadge status={user.status ?? 'active'} />
          {user.rating > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] text-[#737373]">
              <Star size={10} aria-hidden className="text-[#FFD700] fill-[#FFD700]" />
              {user.rating.toFixed(1)}
            </span>
          )}
        </div>
        <p className="text-[#AAAAAA] text-[11px] mt-0.5">
          Joined {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      <ChevronRight size={15} aria-hidden className="text-[#DBDBDB] flex-shrink-0" />
    </motion.button>
  );
}

/* ── Filter options ──────────────────────────────────────────────────────── */
const FILTERS: { key: FilterOpt; label: string }[] = [
  { key: 'all',       label: 'All'       },
  { key: 'worker',    label: 'Workers'   },
  { key: 'client',    label: 'Clients'   },
  { key: 'admin',     label: 'Admins'    },
  { key: 'active',    label: 'Active'    },
  { key: 'flagged',   label: 'Flagged'   },
  { key: 'suspended', label: 'Suspended' },
];

/* ── AdminUsers ──────────────────────────────────────────────────────────── */
export function AdminUsers() {
  const [, navigate]    = useLocation();
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState<FilterOpt>('all');
  const [detail, setDetail]     = useState<AdminUserRow | null>(null);

  useEffect(() => { initAdminSession().then((ok) => { if (!ok) navigate('/admin/login'); }); }, [navigate]);

  const { data: users = [], isLoading, isError } = useAdminUsers();

  const filtered = useMemo(() => users.filter((u) => {
    const matchSearch = !search.trim() ||
      (u.username ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (u.email ?? '').toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' ||
      u.role === filter ||
      (u.status ?? 'active') === filter;
    return matchSearch && matchFilter;
  }), [users, search, filter]);

  if (!isAdminAuthenticated()) return null;

  return (
    <div className="min-h-[100dvh] bg-[#FAFAFA] flex flex-col pt-[60px]">

      <div className="sticky top-[60px] z-30 bg-white border-b border-[#DBDBDB] px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 bg-[#FAFAFA] border border-[#DBDBDB] rounded-[8px] px-3 h-[40px] mb-3">
          <Search size={14} aria-hidden className="text-[#737373] flex-shrink-0" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username or email…"
            aria-label="Search users"
            className="flex-1 bg-transparent text-black text-[14px] placeholder:text-[#AAAAAA] focus:outline-none" />
          {search && (
            <button type="button" aria-label="Clear search" onClick={() => setSearch('')}>
              <X size={13} aria-hidden className="text-[#737373]" />
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar" role="group" aria-label="Filter users">
          {FILTERS.map(({ key, label }) => (
            <FilterChip key={key} label={label} active={filter === key} onSelect={() => setFilter(key)} />
          ))}
        </div>
        {!isLoading && (
          <p className="text-[#737373] text-[11px] font-medium mt-2">
            {filtered.length} of {users.length} user{users.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto bg-white" role="list" aria-label="User list">
        {isLoading && Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}

        {isError && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 px-8">
            <AlertCircle size={32} aria-hidden className="text-red-400" />
            <p className="text-[#737373] text-[14px] text-center">
              Could not load users. Check API server and Supabase connection.
            </p>
          </div>
        )}

        {!isLoading && !isError && (
          <AnimatePresence>
            {filtered.map((user, i) => (
              <motion.div key={user.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: i * 0.015 }} role="listitem">
                <UserListRow user={user} onOpen={setDetail} />
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <p className="text-[#AAAAAA] text-[14px]">No users match this filter.</p>
          </div>
        )}
        <div className="h-10" />
      </div>

      <AnimatePresence>
        {detail && (
          <UserDetailSheet key={detail.id} user={detail} onClose={() => setDetail(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
