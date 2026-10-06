/**
 * Full-screen, non-dismissable acceptance of the Terms of Service and Privacy
 * Policy. Rendered by the app shell for every signed-in user; it shows when
 * GET /legal/status says acceptance is missing (OAuth / first-login users who
 * never saw the sign-up checkbox) or outdated (a version bump), and whenever
 * the API answers 428 legal_required. The public document pages and the auth
 * screens are never covered, so the links here can always be followed.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, ShieldCheck, Check, AlertCircle, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAcceptLegal, useLegalStatus } from '@/hooks/useLegal';
import { LEGAL_REQUIRED_EVENT } from '@/lib/api';
import { LegalSheet } from '@/components/LegalDocument';
import { formatLegalDate, type LegalDocumentId } from '@/legal/config';

/** Screens where the gate stays out of the way (auth flow and the documents themselves). */
const UNGATED = /^\/(terms|privacy|legal|login|signup|sign-in|sign-up|reset-password|auth\/callback)(\/|$)|^\/$/;

export function LegalGate() {
  const { user } = useAuth();
  const [location] = useLocation();
  const qc = useQueryClient();
  const status = useLegalStatus();
  const accept = useAcceptLegal();
  const [agreed, setAgreed] = useState(false);
  const [sheet, setSheet] = useState<LegalDocumentId | null>(null);
  const closeSheet = useCallback(() => setSheet(null), []);

  // A 428 from any request means the server disagrees with what we have
  // cached: re-read the status so the gate appears (or stays hidden).
  useEffect(() => {
    const onRequired = () => { void qc.invalidateQueries({ queryKey: ['legal', 'status'] }); };
    window.addEventListener(LEGAL_REQUIRED_EVENT, onRequired);
    return () => window.removeEventListener(LEGAL_REQUIRED_EVENT, onRequired);
  }, [qc]);

  if (!user || UNGATED.test(location)) return null;
  if (!status.data?.needsAcceptance) return null;

  const { outdated, current } = status.data;
  const busy = accept.isPending;

  return (
    <div className="fixed inset-0 z-[150] bg-white flex justify-center" role="dialog" aria-modal="true"
      aria-labelledby="legal-gate-title" data-testid="legal-gate">
      <div className="w-full max-w-app h-full flex flex-col px-6 pt-[calc(env(safe-area-inset-top)+40px)] pb-[calc(env(safe-area-inset-bottom)+24px)] overflow-y-auto">
        <div className="w-14 h-14 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center mb-5">
          <ShieldCheck size={26} className="text-[#0A1628]" aria-hidden />
        </div>
        <h1 id="legal-gate-title" className="text-[#0A1628] font-bold text-[24px] leading-tight tracking-tight">
          {outdated ? "We've updated our Terms" : 'Before you continue'}
        </h1>
        <p className="text-[#6B7280] text-[14px] leading-relaxed mt-2">
          {outdated
            ? 'Our Terms of Service and Privacy Policy have changed. Please review them and agree to keep using 365 Connect.'
            : 'Please take a moment to review and agree to our Terms of Service and Privacy Policy. They explain how 365 Connect works, that posters and workers deal with each other directly, and how we handle your information.'}
        </p>

        <div className="mt-6 bg-white border border-[#E5E7EB] rounded-[12px] overflow-hidden">
          {([
            { id: 'terms' as const,   label: 'Terms of Service', Icon: FileText },
            { id: 'privacy' as const, label: 'Privacy Policy',   Icon: ShieldCheck },
          ]).map(({ id, label, Icon }, i) => (
            <button key={id} type="button" onClick={() => setSheet(id)} data-testid={`legal-gate-open-${id}`}
              className={`w-full min-h-[56px] px-4 py-3 flex items-center gap-3 text-left ${i > 0 ? 'border-t border-[#E5E7EB]' : ''}`}>
              <div className="w-10 h-10 rounded-[10px] bg-[#FAFAFA] flex items-center justify-center flex-shrink-0">
                <Icon size={17} aria-hidden className="text-[#737373]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[#111827] text-[15px] font-semibold">{label}</p>
                <p className="text-[#6B7280] text-[12px]">Effective {formatLegalDate(current[id].effectiveDate)}</p>
              </div>
              <span className="text-[#0A1628] text-[13px] font-semibold">Read</span>
            </button>
          ))}
        </div>

        <label className="mt-6 flex items-start gap-3 cursor-pointer select-none min-h-[44px]">
          <input type="checkbox" className="sr-only" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
            data-testid="legal-gate-checkbox" />
          <span aria-hidden className={`mt-0.5 w-6 h-6 rounded-[6px] border flex items-center justify-center flex-shrink-0 transition-colors ${
            agreed ? 'bg-[#0A1628] border-[#0A1628]' : 'bg-white border-[#D1D5DB]'}`}>
            {agreed && <Check size={15} className="text-white" strokeWidth={3} />}
          </span>
          <span className="text-[#111827] text-[14px] leading-relaxed">
            I have read and agree to the Terms of Service and Privacy Policy, including the Independent Contractor Acknowledgment and the arbitration agreement.
          </span>
        </label>

        {accept.isError && (
          <div className="mt-4 flex items-start gap-2 rounded-[12px] px-4 py-3 bg-[#FEF2F2] border border-[#FECACA]" role="alert">
            <AlertCircle size={16} className="text-[#EF4444] flex-shrink-0 mt-[1px]" aria-hidden />
            <p className="text-[13px] leading-snug text-[#EF4444]">{accept.error.message || "Couldn't save your acceptance. Please try again."}</p>
          </div>
        )}

        <div className="mt-auto pt-6 flex flex-col gap-3">
          <button type="button" disabled={!agreed || busy} onClick={() => accept.mutate(['terms', 'privacy'])}
            className="w-full h-[52px] rounded-[12px] bg-[#0A1628] text-white font-bold text-[16px] active:scale-[0.98] transition-transform disabled:opacity-40"
            data-testid="legal-gate-agree">
            {busy ? 'Saving…' : 'Agree and continue'}
          </button>
          <SignOutLink />
        </div>
      </div>

      <LegalSheet doc={sheet} onClose={closeSheet} />
    </div>
  );
}

function SignOutLink() {
  const { signOut } = useAuth();
  return (
    <button type="button" onClick={() => void signOut()}
      className="w-full min-h-[44px] flex items-center justify-center gap-2 text-[#6B7280] text-[14px] font-medium">
      <LogOut size={15} aria-hidden /> Not now — log out
    </button>
  );
}
