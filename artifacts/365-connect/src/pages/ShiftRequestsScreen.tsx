import { useLocation } from 'wouter';
import { ChevronLeft, Check, X, Inbox } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useShiftRequests } from '@/hooks/useShiftRequests';
import { friendlyDate, formatTime } from '@/lib/supabase';

function RequestSkeleton() {
  return (
    <div className="rounded-[14px] border border-[#DBDBDB] p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-[#FAFAFA]" />
        <div className="flex-1 flex flex-col gap-2">
          <div className="h-3 w-2/3 bg-[#FAFAFA] rounded" />
          <div className="h-3 w-1/3 bg-[#FAFAFA] rounded" />
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <div className="h-10 flex-1 bg-[#FAFAFA] rounded-[8px]" />
        <div className="h-10 flex-1 bg-[#FAFAFA] rounded-[8px]" />
      </div>
    </div>
  );
}

/**
 * Worker-facing list of pending shift requests (direct client invites).
 * A worker can have several at once, so this is a dedicated list rather
 * than a per-notification detail route.
 */
export function ShiftRequestsScreen() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { requests, isLoading, error, accept, decline } = useShiftRequests(user?.id);

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <div className="px-4 pt-[52px] pb-4 border-b border-[#DBDBDB] flex items-center gap-3 flex-shrink-0">
        <button type="button" aria-label="Go back"
          onClick={() => { if (window.history.length > 1) window.history.back(); else navigate('/home'); }}
          className="w-9 h-9 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center flex-shrink-0">
          <ChevronLeft size={18} aria-hidden className="text-black" />
        </button>
        <h1 className="text-black font-bold text-[18px] leading-tight">Shift Requests</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-8">
        {error && (
          <p className="text-[#EF4444] text-[12px] font-medium mb-3 bg-red-50 border border-[#EF4444]/20 rounded-[8px] px-3 py-2">
            {error}
          </p>
        )}
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((n) => <RequestSkeleton key={n} />)}
          </div>
        ) : requests.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6 pt-16">
            <div className="w-16 h-16 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center">
              <Inbox size={26} aria-hidden className="text-[#737373]" />
            </div>
            <p className="text-black font-semibold text-[16px]">No shift requests</p>
            <p className="text-[#737373] text-[13px] max-w-[240px]">
              When a client invites you directly to a shift, it'll show up here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {requests.map((r) => {
              const initials = (r.clientUsername ?? '??').slice(0, 2).toUpperCase();
              return (
                <div key={r.id} className="rounded-[14px] border border-[#DBDBDB] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex-shrink-0 flex items-center justify-center overflow-hidden">
                      {r.clientPhotoUrl ? (
                        <img src={r.clientPhotoUrl} alt={r.clientUsername ?? 'Client'} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-black font-bold text-[13px]">{initials}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-black font-semibold text-[14px] truncate">
                        {r.clientUsername ? `@${r.clientUsername}` : 'A client'} wants you for
                      </p>
                      <p className="text-black font-bold text-[15px] truncate">{r.shiftTitle}</p>
                      <p className="text-[#737373] text-[12px] mt-[2px]">
                        {r.payRate != null ? `$${r.payRate}/${r.payPeriod} · ` : ''}
                        {friendlyDate(r.startTime)} · {formatTime(r.startTime)}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button type="button" onClick={() => void decline(r.id)}
                      className="flex-1 h-10 rounded-[8px] border border-[#DBDBDB] bg-white text-black font-semibold text-[13px] flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform">
                      <X size={15} aria-hidden />
                      Decline
                    </button>
                    <button type="button" onClick={() => void accept(r.id)}
                      className="flex-1 h-10 rounded-[8px] bg-[#10B981] text-white font-semibold text-[13px] flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform">
                      <Check size={15} aria-hidden />
                      Accept
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
