import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { ChevronLeft, Star, BadgeCheck, Users, UserMinus } from 'lucide-react';
import { useRoster, type RosterWorker } from '@/hooks/useRoster';
import { useRole } from '@/contexts/RoleContext';
import { BottomTabNav } from '@/components/BottomTabNav';

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

function RosterCard({ worker, onRemove }: { worker: RosterWorker; onRemove: (id: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  const initials = (worker.username ?? 'W').replace('@', '').slice(0, 2).toUpperCase();

  return (
    <div className="rounded-[12px] border border-[#E5E7EB] bg-white p-4 flex items-center gap-3">
      <div className="w-14 h-14 rounded-full overflow-hidden bg-[#F3F4F6] flex items-center justify-center flex-shrink-0">
        {worker.photoUrl ? (
          <img src={worker.photoUrl} alt="" aria-hidden loading="lazy" decoding="async"
            className="w-full h-full object-cover" />
        ) : (
          <span className="text-[#6B7280] font-bold text-[16px]">{initials}</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[#0A1628] font-bold text-[15px] truncate">
            {worker.username ? `@${worker.username}` : 'Worker'}
          </p>
          {worker.isPro && (
            <BadgeCheck size={15} aria-label="Verified worker" style={{ color: GOLD }} fill={GOLD}
              className="flex-shrink-0 text-white" />
          )}
        </div>
        {worker.primaryJobType && (
          <p className="text-[#6B7280] text-[13px] mt-0.5 truncate">{worker.primaryJobType}</p>
        )}
        <div className="flex items-center gap-1 mt-1" aria-label={`${worker.rating.toFixed(1)} star rating`}>
          <Star size={13} aria-hidden style={{ color: GOLD }} fill={GOLD} />
          <span className="text-[#0A1628] text-[13px] font-semibold">
            {worker.rating > 0 ? worker.rating.toFixed(1) : 'New'}
          </span>
        </div>
      </div>

      {confirming ? (
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <button type="button" onClick={() => { setConfirming(false); onRemove(worker.id); }}
            className="h-[30px] px-3 rounded-[8px] bg-[#EF4444] text-white text-[11px] font-bold">
            Remove
          </button>
          <button type="button" onClick={() => setConfirming(false)}
            className="h-[30px] px-3 rounded-[8px] border border-[#E5E7EB] text-[#6B7280] text-[11px] font-semibold">
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" aria-label={`Remove ${worker.username ?? 'worker'} from roster`}
          onClick={() => setConfirming(true)}
          className="w-9 h-9 rounded-full border border-[#E5E7EB] flex items-center justify-center flex-shrink-0">
          <UserMinus size={16} aria-hidden className="text-[#6B7280]" />
        </button>
      )}
    </div>
  );
}

export function RosterScreen() {
  const [, navigate] = useLocation();
  const { role, roleLoading } = useRole();
  const { workers, isLoading, error, remove } = useRoster();

  useEffect(() => {
    if (!roleLoading && role !== 'staffer') navigate('/home');
  }, [roleLoading, role, navigate]);

  if (roleLoading || role !== 'staffer') return null;

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <div className="px-4 pt-[52px] pb-4 border-b border-[#E5E7EB] flex items-center gap-3 flex-shrink-0">
        <button type="button" aria-label="Go back"
          onClick={() => { if (window.history.length > 1) window.history.back(); else navigate('/home'); }}
          className="w-9 h-9 rounded-full bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-center flex-shrink-0">
          <ChevronLeft size={18} aria-hidden className="text-[#0A1628]" />
        </button>
        <div className="min-w-0">
          <h1 className="text-[#0A1628] font-bold text-[18px] leading-tight">My Roster</h1>
          <p className="text-[#6B7280] text-[12px] truncate">
            {isLoading ? 'Loading…' : `${workers.length} worker${workers.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-[80px]">
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
              Follow workers from their profile or Explore to add them to your roster.
            </p>
            <button type="button" onClick={() => navigate('/explore')}
              className="mt-2 h-[40px] px-5 rounded-[8px] text-white text-[13px] font-bold"
              style={{ background: '#0A1628' }}>
              Explore Workers
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {workers.map((w) => <RosterCard key={w.id} worker={w} onRemove={remove} />)}
          </div>
        )}
      </div>

      <BottomTabNav />
    </div>
  );
}
