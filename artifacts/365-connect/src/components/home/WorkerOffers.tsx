/**
 * Worker offers: shift offers from clients/agencies and swap offers from other
 * workers, each to accept or decline (Job Board → Requests), plus the nudge
 * shown to a worker who hasn't picked any roles yet.
 */
import { useState } from 'react';
import { useLocation } from 'wouter';
import { Check, X, Inbox, Repeat2 } from 'lucide-react';
import { useShiftRequests, isLiveOffer } from '@/hooks/useShiftRequests';
import { useMySwaps, useRespondSwap, type MySwap } from '@/hooks/useSwaps';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { friendlyDate, formatTime } from '@/lib/supabase';
import { LoadError } from '@/components/StateView';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { JobCard } from '@/components/jobs/JobCard';

/* ─── Worker: Requests (direct shift offers to accept/decline) ───────────────── */
/** Receives the single shared useShiftRequests() instance from WorkerHomeFeed so
 *  the tab badge and this list never disagree. */
function SwapOfferCard({ s, busy, onRespond }: {
  s: MySwap; busy: boolean; onRespond: (action: 'accept' | 'decline') => void;
}) {
  const [, navigate] = useLocation();
  const from = s.counterpart.username ? `@${s.counterpart.username}` : 'A worker';
  const sh = s.shift;
  return (
    <div className="rounded-[16px] border border-[#0A1628] p-4 bg-white">
      <button type="button" onClick={() => navigate(`/shift/${s.shiftId}`)} className="w-full text-left">
        <p className="text-[#111827] font-bold text-[15px] min-w-0 flex items-center gap-1.5">
          <Repeat2 size={14} aria-hidden className="text-[#0A1628] flex-shrink-0" />
          <span className="truncate">{from} offered you their spot</span>
        </p>
        <p className="text-[#6B7280] text-[12px] mt-[2px] truncate">
          {[sh?.jobType, sh?.companyName].filter(Boolean).join(' · ')}
          {sh?.startTime ? ` · ${friendlyDate(sh.startTime, sh.timezone)} · ${formatTime(sh.startTime, sh.timezone)}` : ''}
          {sh?.payRate != null && sh.payRate > 0 ? ` · $${sh.payRate}/${sh.payPeriod ?? 'hr'}` : ''}
        </p>
        {s.note && <p className="text-[#6B7280] text-[12px] mt-1 italic line-clamp-2">“{s.note}”</p>}
      </button>
      <div className="flex gap-2 mt-3.5">
        <button type="button" disabled={busy} onClick={() => onRespond('decline')}
          className="flex-1 h-10 rounded-[8px] border border-[#E5E7EB] bg-white text-[#111827] font-semibold text-[13px] flex items-center justify-center gap-1.5 disabled:opacity-60">
          <X size={15} aria-hidden />
          Decline
        </button>
        <button type="button" disabled={busy} onClick={() => onRespond('accept')}
          className="flex-1 h-10 rounded-[8px] bg-[#10B981] text-white font-semibold text-[13px] flex items-center justify-center gap-1.5 disabled:opacity-60">
          <Check size={15} aria-hidden />
          {busy ? 'Working…' : 'Accept'}
        </button>
      </div>
      <p className="text-[#6B7280] text-[11px] mt-2 text-center">The poster approves the swap before you are booked.</p>
    </div>
  );
}

export function WorkerRequestsView({ requests, isLoading, error, refetch, accept, decline }: ReturnType<typeof useShiftRequests>) {
  const [, navigate] = useLocation();
  const { showToast } = useToast();
  const { user } = useAuth();
  // Only genuine offers TO this worker (not invites they sent) that can still
  // be answered: not cancelled, not started.
  const pending = requests.filter((r) => r.worker_id === user?.id && isLiveOffer(r));
  // Spots other workers want to hand to me.
  const { incoming: swapOffers } = useMySwaps();
  const { respond: respondSwap, busyId: swapBusyId } = useRespondSwap();
  // Declining an offer can't be undone, so it asks first.
  const [declineId, setDeclineId] = useState<string | null>(null);

  function answerSwap(s: MySwap, action: 'accept' | 'decline') {
    void respondSwap(s.id, action, s.shiftId).then((err) => {
      if (err) { showToast(err, 'error'); return; }
      showToast(action === 'accept' ? 'Accepted! The poster needs to approve the swap.' : 'Offer declined.');
    });
  }

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto pt-4 pb-4 px-4 flex flex-col gap-3" aria-busy="true">
        {[1, 2].map((n) => (
          <div key={n} className="h-[120px] rounded-[14px] bg-[#FAFAFA] border border-[#E5E7EB] animate-pulse" />
        ))}
      </div>
    );
  }

  if (error && pending.length === 0 && swapOffers.length === 0) {
    // A failed load must not read as "no offers": a worker could miss one.
    return (
      <div className="flex-1 overflow-y-auto pt-4 pb-4">
        <LoadError what="your shift offers" onRetry={() => void refetch()} />
      </div>
    );
  }

  if (pending.length === 0 && swapOffers.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8 pt-20">
        <div className="w-16 h-16 rounded-full bg-[#FAFAFA] border border-[#E5E7EB] flex items-center justify-center">
          <Inbox size={26} aria-hidden className="text-[#9CA3AF]" />
        </div>
        <p className="text-[#111827] font-semibold text-[16px]">No shift offers</p>
        <p className="text-[#6B7280] text-[13px] max-w-[240px]">
          When a client or agency requests you for a shift, or another worker offers you their spot, it shows up here to accept or decline.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto pt-3 pb-4 px-4 flex flex-col gap-3">
      {swapOffers.length > 0 && (
        <p className="text-[#111827] text-[17px] font-bold px-1">Swap offers</p>
      )}
      {swapOffers.map((s) => (
        <SwapOfferCard key={s.id} s={s} busy={swapBusyId === s.id} onRespond={(a) => answerSwap(s, a)} />
      ))}
      {swapOffers.length > 0 && pending.length > 0 && (
        <p className="text-[#111827] text-[17px] font-bold px-1 mt-2">Shift offers</p>
      )}
      {pending.map((r) => (
        <JobCard key={r.id}
          startISO={r.startTime ?? null} endISO={r.endTime ?? null} timezone={r.timezone}
          title={r.shiftTitle?.trim() || `${r.jobType ?? 'Event'} shift`} company={r.companyName ?? null}
          location={r.location ?? null} logo={r.clientPhotoUrl} status="requested"
          onTap={() => navigate(`/shift/${r.shift_id}`)}>
          {r.payRate != null && r.payRate > 0 && (
            <p className="text-[#047857] text-[14px] font-semibold">${r.payRate}/{r.payPeriod ?? 'hr'}</p>
          )}
          {r.message?.trim() && (
            <p className="mt-2 rounded-[12px] bg-[#F7F8FA] border border-[#E5E7EB] px-3 py-2 text-[#374151] text-[14px] leading-relaxed">
              “{r.message.trim()}”
            </p>
          )}
          <div className="flex gap-2 mt-3">
            <button type="button"
              onClick={() => setDeclineId(r.id)}
              className="flex-1 h-11 rounded-[12px] border border-[#E5E7EB] bg-white text-[#111827] font-semibold text-[15px] flex items-center justify-center gap-1.5">
              <X size={16} aria-hidden />
              Decline
            </button>
            <button type="button"
              onClick={() => void accept(r.id).then((res) => {
                if (!res.ok) { showToast(res.message ?? 'Could not accept this offer.', 'error'); return; }
                showToast(res.status === 'standby'
                  ? "Shift is full — you're on standby. We'll notify you if a spot opens."
                  : "You're booked! Clock in when you arrive.");
              })}
              className="flex-1 h-11 rounded-[12px] bg-[#0A1628] text-white font-semibold text-[15px] flex items-center justify-center gap-1.5">
              <Check size={16} aria-hidden />
              Accept
            </button>
          </div>
        </JobCard>
      ))}
      <ConfirmSheet
        open={!!declineId}
        title="Decline this offer?"
        body="The client will be told you can't make it. You can still apply to their other shifts."
        confirmLabel="Decline offer"
        tone="danger"
        onConfirm={() => {
          const id = declineId; setDeclineId(null);
          if (id) void decline(id).then((res) => showToast(res.ok ? 'Offer declined.' : (res.message ?? 'Could not decline.'), res.ok ? 'success' : 'error'));
        }}
        onCancel={() => setDeclineId(null)}
      />
    </div>
  );
}

/* ─── Nudge: a worker with no roles never matches a shift ─────────────────── */
export function WorkerRolesNudge() {
  const [, navigate] = useLocation();
  const profile = useProfile();
  if (profile.isLoading || profile.primaryJobType) return null;
  return (
    <div className="mx-4 mb-3 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-amber-800 font-bold text-[14px]">Add your roles to get matched</p>
        <p className="text-amber-700 text-[12px] mt-0.5">Shifts, offers and reminders are matched on the roles you can work.</p>
      </div>
      <button type="button" onClick={() => navigate('/profile/edit#work')}
        className="h-9 px-3.5 rounded-[8px] bg-[#0A1628] text-white text-[12px] font-bold flex-shrink-0">
        Add roles
      </button>
    </div>
  );
}

