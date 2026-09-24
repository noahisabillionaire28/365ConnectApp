import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { ChevronLeft, Star, BadgeCheck, Users, UserMinus, Search, MessageCircle, CalendarPlus, X } from 'lucide-react';
import { useRoster, type RosterWorker } from '@/hooks/useRoster';
import { useClientShiftsDashboard, type ClientShift } from '@/hooks/useClientShiftsDashboard';
import { useRole } from '@/contexts/RoleContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { getOrCreateDirectConversation } from '@/hooks/useConversations';
import { BottomTabNav } from '@/components/BottomTabNav';
import { ConfirmSheet } from '@/components/ConfirmSheet';

const GOLD = '#FFD700';

function RosterCardSkeleton() {
  return (
    <div className="rounded-[12px] border border-[#E5E7EB] bg-white p-4 flex items-center gap-3">
      <div className="w-14 h-14 rounded-full bg-[#F3F4F6] animate-pulse flex-shrink-0" />
      <div className="flex-1 flex flex-col gap-2">
        <div className="w-28 h-4 rounded bg-[#F3F4F6] animate-pulse" />
        <div className="w-20 h-3 rounded bg-[#F3F4F6] animate-pulse" />
      </div>
    </div>
  );
}

function RosterCard({ worker, onOpen, onMessage, onAssign, onRemove }: {
  worker: RosterWorker;
  onOpen: () => void;
  onMessage: () => void;
  onAssign: () => void;
  onRemove: () => void;
}) {
  const initials = (worker.username ?? 'W').replace('@', '').slice(0, 2).toUpperCase();
  const jobs = [worker.primaryJobType, ...(worker.job_types ?? [])].filter((j, i, a): j is string => !!j && a.indexOf(j) === i);

  return (
    <div className="rounded-[12px] border border-[#E5E7EB] bg-white p-3.5">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onOpen} aria-label={`Open ${worker.username ?? 'worker'}'s profile`}
          className="w-14 h-14 rounded-full overflow-hidden bg-[#F3F4F6] flex items-center justify-center flex-shrink-0">
          {worker.photoUrl ? (
            <img src={worker.photoUrl} alt="" aria-hidden loading="lazy" decoding="async" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[#6B7280] font-bold text-[16px]">{initials}</span>
          )}
        </button>

        <button type="button" onClick={onOpen} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-1.5">
            <p className="text-[#0A1628] font-bold text-[15px] truncate">
              {worker.username ? `@${worker.username}` : 'Worker'}
            </p>
            {worker.isPro && (
              <BadgeCheck size={15} aria-label="Verified worker" style={{ color: GOLD }} fill={GOLD} className="flex-shrink-0 text-white" />
            )}
          </div>
          {jobs.length > 0 && (
            <p className="text-[#6B7280] text-[13px] mt-0.5 truncate">{jobs.slice(0, 3).join(' · ')}</p>
          )}
          <div className="flex items-center gap-1 mt-1" aria-label={`${Number(worker.rating).toFixed(1)} star rating`}>
            <Star size={13} aria-hidden style={{ color: GOLD }} fill={GOLD} />
            <span className="text-[#0A1628] text-[13px] font-semibold">
              {Number(worker.rating) > 0 ? Number(worker.rating).toFixed(1) : 'New'}
            </span>
          </div>
        </button>

        <button type="button" aria-label={`Remove ${worker.username ?? 'worker'} from roster`} onClick={onRemove}
          className="w-9 h-9 rounded-full border border-[#E5E7EB] flex items-center justify-center flex-shrink-0">
          <UserMinus size={16} aria-hidden className="text-[#6B7280]" />
        </button>
      </div>

      <div className="flex gap-2 mt-3">
        <button type="button" onClick={onAssign}
          className="flex-1 h-[38px] rounded-[8px] bg-[#0A1628] text-white text-[12px] font-bold flex items-center justify-center gap-1.5">
          <CalendarPlus size={14} aria-hidden /> Assign to a shift
        </button>
        <button type="button" onClick={onMessage} aria-label={`Message ${worker.username ?? 'worker'}`}
          className="h-[38px] px-3.5 rounded-[8px] border border-[#E5E7EB] text-[#0A1628] text-[12px] font-bold flex items-center justify-center gap-1.5">
          <MessageCircle size={14} aria-hidden /> Message
        </button>
      </div>
    </div>
  );
}

/** Pick which upcoming shift to assign a roster worker to. */
function AssignSheet({ worker, shifts, onPick, onClose }: {
  worker: RosterWorker; shifts: ClientShift[]; onPick: (shiftId: string) => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40" role="dialog" aria-modal="true"
      aria-label="Choose a shift" onClick={onClose}>
      <div className="w-full max-w-app bg-white rounded-t-[20px] px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+16px)] max-h-[75dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-[#E5E7EB] mx-auto mb-4" />
        <div className="flex items-center justify-between mb-3">
          <p className="text-[#111827] font-bold text-[17px]">Assign {worker.username ? `@${worker.username}` : 'worker'} to…</p>
          <button type="button" aria-label="Close" onClick={onClose} className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center">
            <X size={16} aria-hidden />
          </button>
        </div>
        {shifts.length === 0 ? (
          <p className="text-[#6B7280] text-[13px] py-6 text-center">No upcoming shifts with open spots. Post a shift first.</p>
        ) : (
          <div className="overflow-y-auto flex flex-col gap-2">
            {shifts.map((s) => {
              const total = Math.max(1, Number(s.spots_available ?? 1) || 1);
              const filled = Number(s.spots_filled ?? 0) || 0;
              return (
                <button key={s.id} type="button" onClick={() => onPick(s.id)}
                  className="w-full text-left rounded-[10px] border border-[#E5E7EB] px-3.5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[#111827] font-bold text-[14px] truncate">{s.title || s.jobType || 'Shift'}</p>
                    <p className="text-[#6B7280] text-[12px] truncate">
                      {new Date(s.startTimeISO).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: s.timezone || undefined })} · {s.startTime}{s.jobType ? ` · ${s.jobType}` : ''}
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-[#0A1628] bg-[#F3F4F6] rounded-full px-2 py-0.5 flex-shrink-0">{filled}/{total}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function RosterScreen() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { role, roleLoading } = useRole();
  const { showToast } = useToast();
  const { workers, isLoading, error, remove } = useRoster();
  const { shifts } = useClientShiftsDashboard();
  const [query, setQuery] = useState('');
  const [assigning, setAssigning] = useState<RosterWorker | null>(null);
  const [removing, setRemoving] = useState<RosterWorker | null>(null);

  // Clients and agencies both have a roster: the workers they follow.
  const hasRoster = role === 'staffer' || role === 'client';
  useEffect(() => {
    if (!roleLoading && !hasRoster) navigate('/home');
  }, [roleLoading, hasRoster, navigate]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return shifts
      .filter((s) => (s.status === 'open' || s.status === 'filled') && Date.parse(s.end_time || s.startTimeISO) > now)
      .filter((s) => (Number(s.spots_filled ?? 0) || 0) < (Number(s.spots_available ?? 1) || 1))
      .sort((a, b) => Date.parse(a.startTimeISO) - Date.parse(b.startTimeISO));
  }, [shifts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workers;
    return workers.filter((w) =>
      (w.username ?? '').toLowerCase().includes(q) ||
      (w.primaryJobType ?? '').toLowerCase().includes(q) ||
      (w.job_types ?? []).some((j) => j.toLowerCase().includes(q)));
  }, [workers, query]);

  if (roleLoading || !hasRoster) return null;

  async function message(w: RosterWorker) {
    if (!user?.id) return;
    const cid = await getOrCreateDirectConversation(user.id, w.id);
    if (cid) navigate(`/messages/${cid}`);
    else showToast('Could not open the conversation.', 'error');
  }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <div className="px-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-3 border-b border-[#E5E7EB] flex-shrink-0">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Go back"
            onClick={() => { if (window.history.length > 1) window.history.back(); else navigate('/home'); }}
            className="w-9 h-9 rounded-full bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-center flex-shrink-0">
            <ChevronLeft size={18} aria-hidden className="text-[#0A1628]" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[#0A1628] font-bold text-[18px] leading-tight">My Roster</h1>
            <p className="text-[#6B7280] text-[12px] truncate">
              {isLoading ? 'Loading…' : `${workers.length} worker${workers.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button type="button" onClick={() => navigate('/home?tab=browse')}
            className="h-9 px-3 rounded-[8px] border border-[#0A1628] text-[#0A1628] text-[12px] font-bold flex-shrink-0">
            + Add workers
          </button>
        </div>
        {workers.length > 3 && (
          <div className="relative mt-3">
            <Search size={15} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or role"
              aria-label="Search roster"
              className="w-full h-[40px] rounded-[10px] bg-[#F3F4F6] pl-9 pr-3 text-[14px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none" />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-[80px]">
        {error && (
          <p className="text-[#EF4444] text-[12px] font-medium mb-3 bg-red-50 border border-[#EF4444]/20 rounded-[8px] px-3 py-2">
            {error}
          </p>
        )}

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((n) => <RosterCardSkeleton key={n} />)}
          </div>
        ) : workers.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6 pt-16">
            <div className="w-16 h-16 rounded-full bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-center">
              <Users size={26} aria-hidden className="text-[#6B7280]" />
            </div>
            <p className="text-[#0A1628] font-semibold text-[16px]">Your roster is empty</p>
            <p className="text-[#6B7280] text-[13px]">
              Add workers you trust so you can assign them to shifts in one tap.
            </p>
            <button type="button" onClick={() => navigate('/home?tab=browse')}
              className="mt-2 h-[40px] px-5 rounded-[8px] text-white text-[13px] font-bold"
              style={{ background: '#0A1628' }}>
              Browse Workers
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-[#6B7280] text-[13px] text-center pt-10">No one on your roster matches “{query}”.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((w) => (
              <RosterCard key={w.id} worker={w}
                onOpen={() => { if (w.username) navigate(`/worker/${w.username}`); }}
                onMessage={() => void message(w)}
                onAssign={() => setAssigning(w)}
                onRemove={() => setRemoving(w)}
              />
            ))}
          </div>
        )}
      </div>

      {assigning && (
        <AssignSheet worker={assigning} shifts={upcoming}
          onPick={(shiftId) => { setAssigning(null); navigate(`/shift/${shiftId}/assign?worker=${assigning.id}`); }}
          onClose={() => setAssigning(null)} />
      )}

      <ConfirmSheet
        open={!!removing}
        title={`Remove ${removing?.username ? `@${removing.username}` : 'this worker'} from your roster?`}
        body="They keep any shifts they're already booked on. You can add them back any time."
        confirmLabel="Remove"
        tone="danger"
        onConfirm={() => { if (removing) void remove(removing.id); setRemoving(null); }}
        onCancel={() => setRemoving(null)}
      />

      <BottomTabNav />
    </div>
  );
}
