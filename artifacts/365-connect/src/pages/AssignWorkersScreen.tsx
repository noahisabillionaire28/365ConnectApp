import { useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { ChevronLeft, Star, BadgeCheck, UserPlus, CheckCircle2, Users } from 'lucide-react';
import { useAssignWorkers, type AssignableWorker } from '@/hooks/useAssignWorkers';
import { useShiftById } from '@/hooks/useShifts';
import { useRole } from '@/contexts/RoleContext';
import { useToast } from '@/contexts/ToastContext';
import { BottomTabNav } from '@/components/BottomTabNav';

const GOLD = '#FFD700';

function AssignCardSkeleton() {
  return (
    <div className="rounded-[12px] border border-[#E5E7EB] bg-white p-4 flex items-center gap-3">
      <div className="w-14 h-14 rounded-full bg-[#F3F4F6] animate-pulse flex-shrink-0" />
      <div className="flex-1 flex flex-col gap-2">
        <div className="w-28 h-4 rounded bg-[#F3F4F6] animate-pulse" />
        <div className="w-20 h-3 rounded bg-[#F3F4F6] animate-pulse" />
      </div>
      <div className="w-20 h-8 rounded-[8px] bg-[#F3F4F6] animate-pulse flex-shrink-0" />
    </div>
  );
}

function AssignCard({ worker, shiftFull, isAssigning, onAssign }: {
  worker: AssignableWorker; shiftFull: boolean; isAssigning: boolean; onAssign: (id: string) => void;
}) {
  const initials = (worker.username ?? 'W').replace('@', '').slice(0, 2).toUpperCase();
  const alreadyAssigned = worker.applicationStatus === 'accepted';
  const disabled = alreadyAssigned || isAssigning || (shiftFull && !alreadyAssigned);

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
        <div className="flex items-center gap-1 mt-1" aria-label={`${Number(worker.rating).toFixed(1)} star rating`}>
          <Star size={13} aria-hidden style={{ color: GOLD }} fill={GOLD} />
          <span className="text-[#0A1628] text-[13px] font-semibold">
            {Number(worker.rating) > 0 ? Number(worker.rating).toFixed(1) : 'New'}
          </span>
        </div>
      </div>

      <button type="button" disabled={disabled} aria-disabled={disabled}
        onClick={() => onAssign(worker.id)}
        className={`flex-shrink-0 h-[34px] px-3.5 rounded-[8px] text-[12px] font-bold flex items-center gap-1.5 transition-colors ${
          alreadyAssigned ? 'bg-[#10B981]/10 text-[#10B981]' : 'text-white disabled:opacity-50'
        }`}
        style={alreadyAssigned ? undefined : { background: '#0A1628' }}>
        {alreadyAssigned ? (<><CheckCircle2 size={14} /> Assigned</>) : isAssigning ? 'Assigning…' : (<><UserPlus size={14} /> Assign</>)}
      </button>
    </div>
  );
}

export function AssignWorkersScreen() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { role, roleLoading } = useRole();
  const { data: shift, isLoading: shiftLoading } = useShiftById(id);
  const { workers, isLoading, error, assign, assigningId } = useAssignWorkers(id);
  const { showToast } = useToast();

  function handleAssign(workerId: string) {
    void assign(workerId).then((err) => {
      if (err) showToast(err);
      else showToast('Worker assigned to this shift.');
    });
  }

  useEffect(() => {
    if (!roleLoading && role !== 'staffer') navigate('/home');
  }, [roleLoading, role, navigate]);

  if (roleLoading || role !== 'staffer') return null;

  const shiftFull = !!shift && shift.spotsAvailable <= 0;
  const isLoadingAny = shiftLoading || isLoading;
  const assignedCount = workers.filter((w) => w.applicationStatus === 'accepted').length;

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <div className="px-4 pt-[52px] pb-4 border-b border-[#E5E7EB] flex items-center gap-3 flex-shrink-0">
        <button type="button" aria-label="Go back"
          onClick={() => { if (window.history.length > 1) window.history.back(); else navigate(`/shift/${id}`); }}
          className="w-9 h-9 rounded-full bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-center flex-shrink-0">
          <ChevronLeft size={18} aria-hidden className="text-[#0A1628]" />
        </button>
        <div className="min-w-0">
          <h1 className="text-[#0A1628] font-bold text-[18px] leading-tight truncate">Assign Workers</h1>
          <p className="text-[#6B7280] text-[12px] truncate">{shift?.jobType ?? 'Loading…'}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-[80px]">
        {error && (
          <p className="text-[#EF4444] text-[12px] font-medium mb-3 bg-red-50 border border-[#EF4444]/20 rounded-[8px] px-3 py-2">
            {error}
          </p>
        )}

        {!isLoadingAny && shift && (
          <div className="rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 mb-4">
            <p className="text-[#0A1628] text-[13px] font-semibold">
              {shift.spotsAvailable} of {shift.spotsTotal} spot{shift.spotsTotal !== 1 ? 's' : ''} open
              {assignedCount > 0 && ` · ${assignedCount} assigned from roster`}
            </p>
            {shiftFull && (
              <p className="text-[#EF4444] text-[12px] font-medium mt-1">
                This shift is fully booked — remove a worker before assigning another.
              </p>
            )}
          </div>
        )}

        {isLoadingAny ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((n) => <AssignCardSkeleton key={n} />)}
          </div>
        ) : workers.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6 pt-16">
            <div className="w-16 h-16 rounded-full bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-center">
              <Users size={26} aria-hidden className="text-[#6B7280]" />
            </div>
            <p className="text-[#0A1628] font-semibold text-[16px]">Your roster is empty</p>
            <p className="text-[#6B7280] text-[13px]">
              Add workers to your roster first, then come back to assign them to this shift.
            </p>
            <button type="button" onClick={() => navigate('/roster')}
              className="mt-2 h-[40px] px-5 rounded-[8px] text-white text-[13px] font-bold"
              style={{ background: '#0A1628' }}>
              Go to My Roster
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {workers.map((w) => (
              <AssignCard key={w.id} worker={w} shiftFull={shiftFull} isAssigning={assigningId === w.id} onAssign={handleAssign} />
            ))}
          </div>
        )}
      </div>

      <BottomTabNav />
    </div>
  );
}
