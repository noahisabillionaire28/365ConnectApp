import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, ChevronDown, X, Ban, Flag, Trash2,
  Edit2, Check, Star, Briefcase, ChevronRight,
} from 'lucide-react';
import { isAdminAuthenticated } from '@/store/adminStore';
import { AdminNav } from '@/components/AdminNav';
import { ADMIN_USERS, ADMIN_SHIFTS, type AdminUser, type UserRole, type UserStatus } from '@/data/mockAdmin';

/* ─── Badges ─────────────────────────────────────────────────────────────── */
const ROLE_STYLES: Record<UserRole, string> = {
  worker: 'bg-blue-500/15  border-blue-500/30  text-blue-400',
  client: 'bg-purple-500/15 border-purple-500/30 text-purple-400',
  admin:  'bg-primary/15   border-primary/30   text-primary',
};

const STATUS_STYLES: Record<UserStatus, string> = {
  active:    'bg-emerald-500/15 border-emerald-500/25 text-emerald-400',
  suspended: 'bg-red-500/15    border-red-500/25    text-red-400',
  flagged:   'bg-amber-500/15  border-amber-500/25  text-amber-400',
};

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${ROLE_STYLES[role]}`}>
      {role}
    </span>
  );
}

function StatusBadge({ status }: { status: UserStatus }) {
  const label = status === 'suspended' ? 'Suspended' : status === 'flagged' ? 'Flagged ⚠' : 'Active';
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[status]}`}>
      {label}
    </span>
  );
}

/* ─── Confirm overlay ────────────────────────────────────────────────────── */
function ConfirmOverlay({
  message, confirmLabel, confirmClass, onConfirm, onCancel,
}: {
  message: string; confirmLabel: string; confirmClass: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-end justify-center px-4 pb-8"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm action"
      onClick={onCancel}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 36 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[400px] bg-[#0A0A0A] border border-[#1E1E1E] rounded-[20px] px-5 py-5"
      >
        <p className="text-white text-[16px] font-semibold mb-1.5">Are you sure?</p>
        <p className="text-[#555] text-[14px] mb-5 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button
            type="button"
            aria-label="Cancel"
            onClick={onCancel}
            className="flex-1 h-[48px] rounded-[12px] bg-[#141414] border border-[#222] text-white font-semibold text-[14px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 h-[48px] rounded-[12px] font-bold text-[14px] ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── User detail sheet ──────────────────────────────────────────────────── */
function UserDetailSheet({
  user: initialUser,
  onClose,
  onUpdate,
  onDelete,
}: {
  user: AdminUser;
  onClose: () => void;
  onUpdate: (u: AdminUser) => void;
  onDelete: (id: string) => void;
}) {
  const [user,        setUser]        = useState(initialUser);
  const [editMode,    setEditMode]    = useState(false);
  const [editName,    setEditName]    = useState(user.displayName);
  const [editEmail,   setEditEmail]   = useState(user.email);
  const [editRole,    setEditRole]    = useState<UserRole>(user.role);
  const [confirmOp,   setConfirmOp]   = useState<'ban' | 'unban' | 'delete' | null>(null);

  const userShifts = ADMIN_SHIFTS
    .filter((s) => s.clientId === user.id || s.applicants.some((a) => a.id === user.id))
    .slice(0, 3);

  function saveEdit() {
    const updated = { ...user, displayName: editName, email: editEmail, role: editRole };
    setUser(updated);
    onUpdate(updated);
    setEditMode(false);
  }

  function handleBan() {
    const newStatus: UserStatus = user.status === 'suspended' ? 'active' : 'suspended';
    const updated = { ...user, status: newStatus, flagNote: newStatus === 'suspended' ? 'Banned by admin.' : undefined };
    setUser(updated);
    onUpdate(updated);
    setConfirmOp(null);
  }

  function handleFlag() {
    const newStatus: UserStatus = user.status === 'flagged' ? 'active' : 'flagged';
    const updated = { ...user, status: newStatus };
    setUser(updated);
    onUpdate(updated);
  }

  function handleDelete() {
    onDelete(user.id);
    setConfirmOp(null);
    onClose();
  }

  const isBanned  = user.status === 'suspended';
  const isFlagged = user.status === 'flagged';

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
        className="fixed bottom-0 left-0 right-0 max-h-[92dvh] bg-[#050505] border-t border-[#1A1A1A] rounded-t-[24px] z-50 flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={`Profile: ${user.displayName}`}
      >
        {/* Handle */}
        <div aria-hidden className="w-10 h-1 rounded-full bg-[#222] mx-auto mt-3 mb-4 flex-shrink-0" />

        <div className="overflow-y-auto flex-1 px-5 pb-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src={user.photoUrl}
                  alt={user.displayName}
                  loading="lazy"
                  decoding="async"
                  className="w-14 h-14 rounded-full object-cover border-2 border-[#1A1A1A]"
                />
                {isBanned && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center border border-black">
                    <Ban size={10} aria-hidden className="text-white" />
                  </div>
                )}
                {isFlagged && !isBanned && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center border border-black">
                    <Flag size={10} aria-hidden className="text-black" />
                  </div>
                )}
              </div>
              <div>
                <p className="text-white font-bold text-[17px]">{user.displayName}</p>
                <p className="text-[#444] text-[13px]">@{user.username}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <RoleBadge role={user.role} />
                  <StatusBadge status={user.status} />
                </div>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close user panel"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#111] border border-[#1E1E1E] flex items-center justify-center"
            >
              <X size={14} aria-hidden className="text-[#555]" />
            </button>
          </div>

          {/* Edit form */}
          <AnimatePresence>
            {editMode && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden mb-5"
              >
                <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-[16px] p-4 flex flex-col gap-3">
                  <p className="text-[#444] text-[11px] font-bold uppercase tracking-wider mb-1">Edit Profile</p>
                  <div>
                    <label htmlFor="edit-name" className="text-[#444] text-[11px] mb-1 block">Display Name</label>
                    <input
                      id="edit-name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full h-[42px] bg-[#060606] border border-[#1E1E1E] rounded-[10px] px-3 text-white text-[14px] focus:outline-none focus:border-primary/40"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-email" className="text-[#444] text-[11px] mb-1 block">Email</label>
                    <input
                      id="edit-email"
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full h-[42px] bg-[#060606] border border-[#1E1E1E] rounded-[10px] px-3 text-white text-[14px] focus:outline-none focus:border-primary/40"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-role" className="text-[#444] text-[11px] mb-1 block">Role</label>
                    <select
                      id="edit-role"
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as UserRole)}
                      className="w-full h-[42px] bg-[#060606] border border-[#1E1E1E] rounded-[10px] px-3 text-white text-[14px] focus:outline-none focus:border-primary/40"
                    >
                      <option value="worker">Worker</option>
                      <option value="client">Client</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="flex gap-2 mt-1">
                    <button
                      type="button"
                      aria-label="Save profile changes"
                      onClick={saveEdit}
                      className="flex-1 h-[40px] bg-primary rounded-[10px] text-black font-bold text-[13px] flex items-center justify-center gap-1.5"
                    >
                      <Check size={14} aria-hidden /> Save
                    </button>
                    <button
                      type="button"
                      aria-label="Cancel edit"
                      onClick={() => setEditMode(false)}
                      className="flex-1 h-[40px] bg-[#111] border border-[#1E1E1E] rounded-[10px] text-[#666] font-semibold text-[13px]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            {[
              { label: 'Shifts', value: user.role === 'worker' ? String(user.shiftsCompleted) : '—', icon: Briefcase },
              { label: 'Rating', value: user.rating > 0 ? user.rating.toFixed(1) : 'N/A', icon: Star },
              { label: 'Revenue', value: `$${(user.totalRevenue / 1000).toFixed(1)}K`, icon: null },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[#0A0A0A] border border-[#141414] rounded-[12px] py-3 px-3 text-center">
                <p className="text-primary font-bold text-[18px]">{value}</p>
                <p className="text-[#3A3A3A] text-[10px] font-semibold uppercase tracking-wide mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Email */}
          <div className="bg-[#0A0A0A] border border-[#141414] rounded-[12px] px-4 py-3 mb-3">
            <p className="text-[#333] text-[10px] font-bold uppercase tracking-wider mb-1">Email</p>
            <p className="text-[#888] text-[13px]">{user.email}</p>
          </div>

          {/* Flag note */}
          {user.flagNote && (
            <div className="bg-amber-500/8 border border-amber-500/20 rounded-[12px] px-4 py-3 mb-3">
              <p className="text-amber-400 text-[11px] font-bold uppercase tracking-wider mb-1">Internal Note</p>
              <p className="text-amber-300/80 text-[13px] leading-relaxed">{user.flagNote}</p>
            </div>
          )}

          {/* Recent shifts */}
          {userShifts.length > 0 && (
            <div className="mb-5">
              <p className="text-[#333] text-[11px] font-bold uppercase tracking-wider mb-2">Shift History</p>
              <div className="flex flex-col gap-1.5">
                {userShifts.map((s) => (
                  <div key={s.id} className="flex items-center justify-between bg-[#0A0A0A] border border-[#141414] rounded-[10px] px-3 py-2.5">
                    <div>
                      <p className="text-white text-[13px] font-medium">{s.jobType}</p>
                      <p className="text-[#444] text-[11px]">{s.companyName} · {s.date}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      s.status === 'completed'   ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400' :
                      s.status === 'cancelled'   ? 'bg-red-500/15     border-red-500/25     text-red-400'     :
                      s.status === 'in-progress' ? 'bg-blue-500/15    border-blue-500/25    text-blue-400'    :
                                                   'bg-[#1A1A1A]      border-[#2A2A2A]      text-[#666]'
                    }`}>
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            {!editMode && (
              <button
                type="button"
                aria-label="Edit user profile"
                onClick={() => setEditMode(true)}
                className="w-full h-[48px] rounded-[12px] bg-[#111] border border-[#1E1E1E] text-white font-semibold text-[14px] flex items-center justify-center gap-2"
              >
                <Edit2 size={15} aria-hidden /> Edit Profile
              </button>
            )}
            <button
              type="button"
              aria-label={isFlagged ? 'Remove flag from user' : 'Flag this user with a warning'}
              onClick={handleFlag}
              className="w-full h-[48px] rounded-[12px] bg-amber-500/10 border border-amber-500/25 text-amber-400 font-semibold text-[14px] flex items-center justify-center gap-2"
            >
              <Flag size={15} aria-hidden />
              {isFlagged ? 'Remove Flag' : 'Flag User'}
            </button>
            <button
              type="button"
              aria-label={isBanned ? 'Restore user account' : 'Suspend this user account'}
              onClick={() => setConfirmOp(isBanned ? 'unban' : 'ban')}
              className="w-full h-[48px] rounded-[12px] bg-red-500/10 border border-red-500/25 text-red-400 font-bold text-[14px] flex items-center justify-center gap-2"
            >
              <Ban size={15} aria-hidden />
              {isBanned ? 'Restore Account' : 'Ban User'}
            </button>
            <button
              type="button"
              aria-label="Permanently delete this user account"
              onClick={() => setConfirmOp('delete')}
              className="w-full h-[44px] rounded-[12px] bg-transparent text-[#333] font-medium text-[13px] flex items-center justify-center gap-2 hover:text-red-400 transition-colors"
            >
              <Trash2 size={13} aria-hidden /> Delete Account
            </button>
          </div>
        </div>
      </motion.div>

      {/* Confirmation overlay */}
      <AnimatePresence>
        {confirmOp === 'ban' && (
          <ConfirmOverlay
            key="ban"
            message={`${user.displayName}'s account will be suspended. They will see "Account Suspended" when they log in.`}
            confirmLabel="Ban User"
            confirmClass="bg-red-500 text-white"
            onConfirm={handleBan}
            onCancel={() => setConfirmOp(null)}
          />
        )}
        {confirmOp === 'unban' && (
          <ConfirmOverlay
            key="unban"
            message={`Restore ${user.displayName}'s account? They will regain full platform access.`}
            confirmLabel="Restore"
            confirmClass="bg-emerald-500 text-white"
            onConfirm={handleBan}
            onCancel={() => setConfirmOp(null)}
          />
        )}
        {confirmOp === 'delete' && (
          <ConfirmOverlay
            key="delete"
            message={`Permanently delete ${user.displayName}'s account and all associated data? This cannot be undone.`}
            confirmLabel="Delete"
            confirmClass="bg-red-600 text-white"
            onConfirm={handleDelete}
            onCancel={() => setConfirmOp(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── Filter chips ───────────────────────────────────────────────────────── */
type FilterOpt = 'all' | UserRole | UserStatus;

function FilterChip({ label, active, onSelect }: { label: string; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`Filter users by ${label}`}
      onClick={onSelect}
      className={`flex-shrink-0 h-[32px] px-3.5 rounded-full text-[12px] font-semibold border transition-all ${
        active
          ? 'bg-primary/15 border-primary/40 text-primary'
          : 'bg-[#0A0A0A] border-[#1A1A1A] text-[#444]'
      }`}
    >
      {label}
    </button>
  );
}

/* ─── User row ───────────────────────────────────────────────────────────── */
function UserRow({
  user, onOpenDetail,
}: {
  user: AdminUser; onOpenDetail: (u: AdminUser) => void;
}) {
  return (
    <motion.button
      type="button"
      aria-label={`Open profile for ${user.displayName}`}
      whileTap={{ backgroundColor: '#080808' }}
      onClick={() => onOpenDetail(user)}
      className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-[#0D0D0D] text-left transition-colors"
    >
      <div className="relative flex-shrink-0">
        <img
          src={user.photoUrl}
          alt={user.displayName}
          loading="lazy"
          decoding="async"
          className="w-10 h-10 rounded-full object-cover border border-[#1A1A1A]"
        />
        {user.status === 'suspended' && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full border border-black flex items-center justify-center">
            <Ban size={8} aria-hidden className="text-white" />
          </div>
        )}
        {user.status === 'flagged' && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-amber-500 rounded-full border border-black flex items-center justify-center">
            <Flag size={8} aria-hidden className="text-black" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <p className="text-white text-[14px] font-semibold truncate">{user.displayName}</p>
          <RoleBadge role={user.role} />
          <StatusBadge status={user.status} />
        </div>
        <p className="text-[#3A3A3A] text-[12px] truncate">@{user.username} · {user.email}</p>
      </div>

      <ChevronRight size={15} aria-hidden className="text-[#2A2A2A] flex-shrink-0" />
    </motion.button>
  );
}

/* ─── AdminUsers ─────────────────────────────────────────────────────────── */
const FILTER_OPTS: { key: FilterOpt; label: string }[] = [
  { key: 'all',       label: 'All'       },
  { key: 'worker',    label: 'Workers'   },
  { key: 'client',    label: 'Clients'   },
  { key: 'admin',     label: 'Admins'    },
  { key: 'active',    label: 'Active'    },
  { key: 'flagged',   label: 'Flagged'   },
  { key: 'suspended', label: 'Suspended' },
];

export function AdminUsers() {
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isAdminAuthenticated()) navigate('/admin/login');
  }, [navigate]);

  const [users,       setUsers]       = useState<AdminUser[]>(ADMIN_USERS);
  const [search,      setSearch]      = useState('');
  const [filter,      setFilter]      = useState<FilterOpt>('all');
  const [detailUser,  setDetailUser]  = useState<AdminUser | null>(null);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        !search.trim() ||
        u.displayName.toLowerCase().includes(search.toLowerCase()) ||
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());

      const matchFilter =
        filter === 'all' ||
        u.role === filter ||
        u.status === filter;

      return matchSearch && matchFilter;
    });
  }, [users, search, filter]);

  function handleUpdate(updated: AdminUser) {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    setDetailUser(updated);
  }

  function handleDelete(id: string) {
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }

  if (!isAdminAuthenticated()) return null;

  return (
    <div className="min-h-[100dvh] bg-black flex flex-col">
      <AdminNav />

      {/* Sticky search + filter bar */}
      <div className="sticky top-[96px] z-30 bg-black border-b border-[#0D0D0D] px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 bg-[#0A0A0A] border border-[#1A1A1A] rounded-[12px] px-3 h-[40px] mb-3">
          <Search size={14} aria-hidden className="text-[#333] flex-shrink-0" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users…"
            aria-label="Search users by name, username, or email"
            className="flex-1 bg-transparent text-white text-[14px] placeholder:text-[#222] focus:outline-none"
          />
          {search && (
            <button type="button" aria-label="Clear search" onClick={() => setSearch('')}>
              <X size={13} aria-hidden className="text-[#444]" />
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar" role="group" aria-label="Filter users">
          {FILTER_OPTS.map(({ key, label }) => (
            <FilterChip key={key} label={label} active={filter === key} onSelect={() => setFilter(key)} />
          ))}
        </div>
        <p className="text-[#2A2A2A] text-[11px] font-medium mt-2">{filtered.length} user{filtered.length !== 1 ? 's' : ''}</p>
      </div>

      {/* User list */}
      <div className="flex-1 overflow-y-auto" role="list" aria-label="User list">
        <AnimatePresence>
          {filtered.map((user, i) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: i * 0.02 }}
              role="listitem"
            >
              <UserRow user={user} onOpenDetail={setDetailUser} />
            </motion.div>
          ))}
        </AnimatePresence>
        {filtered.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <p className="text-[#222] text-[14px]">No users match this filter.</p>
          </div>
        )}
        <div className="h-10" />
      </div>

      {/* Detail sheet */}
      <AnimatePresence>
        {detailUser && (
          <UserDetailSheet
            key={detailUser.id}
            user={detailUser}
            onClose={() => setDetailUser(null)}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
