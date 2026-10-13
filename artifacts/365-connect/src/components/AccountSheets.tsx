/**
 * Bottom sheets for the sign-in details on Edit Profile:
 *
 *   ChangeEmailSheet     asks the auth service to move the account to a new
 *                        address. Nothing changes until the user opens the
 *                        confirmation link sent to the new address (and, with
 *                        secure email change on, the one sent to the old
 *                        address too). The link lands on /auth/callback, which
 *                        copies the confirmed address onto the profile.
 *   ChangePasswordSheet  checks the current password, then sets a new one.
 *                        Accounts that only ever signed in with Google or
 *                        Apple have no password yet; they can set one here
 *                        without the current-password step.
 */
import { useEffect, useId, useState } from 'react';
import { Mail, KeyRound, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { authRedirectUrl } from '@/lib/native';
import { useDialog } from '@/hooks/useDialog';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PASSWORD_MIN = 6; // matches the sign-up form

const INPUT = 'w-full bg-white border rounded-[10px] px-3 h-[46px] text-[#111827] text-[14px] font-medium focus:outline-none focus:border-[#0A1628]';

function Shell({ open, busy, onClose, icon: Icon, title, children }: {
  open: boolean; busy: boolean; onClose: () => void;
  icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>;
  title: string; children: React.ReactNode;
}) {
  const titleId = useId();
  const ref = useDialog<HTMLDivElement>(open, busy ? null : onClose);
  if (!open) return null;
  return (
    <div data-no-pull className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40"
      onClick={() => { if (!busy) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="w-full max-w-app bg-white rounded-t-[20px] px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+20px)] max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-[#E5E7EB] mx-auto mb-4" />
        <div className="flex items-center gap-2 mb-1">
          <Icon size={18} aria-hidden className="text-[#0A1628]" />
          <p id={titleId} className="text-[#111827] font-bold text-[17px]">{title}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return <label htmlFor={htmlFor} className="block text-[#6B7280] text-[11px] font-semibold uppercase tracking-wider mb-1.5 mt-4">{children}</label>;
}

function friendlyAuthError(e: unknown, fallback: string): string {
  const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? '');
  if (/already (been )?registered|email_exists|already in use/i.test(msg)) return 'That email is already used by another account.';
  if (/rate limit|too many|seconds/i.test(msg)) return 'Too many attempts. Wait a minute and try again.';
  if (/same_password|different from the old/i.test(msg)) return 'Choose a password different from your current one.';
  if (/weak|at least|characters/i.test(msg)) return msg;
  if (/network|fetch/i.test(msg)) return "Couldn't reach the server. Check your connection and try again.";
  return msg || fallback;
}

// ── Change email ──────────────────────────────────────────────────────────────
export function ChangeEmailSheet({ open, currentEmail, onClose, onRequested }: {
  open: boolean;
  currentEmail: string;
  onClose: () => void;
  /** Called with the new address once the confirmation email is on its way. */
  onRequested: (newEmail: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => { if (open) { setEmail(''); setErr(''); setSentTo(null); } }, [open]);

  async function submit() {
    const next = email.trim().toLowerCase();
    if (!EMAIL_RE.test(next)) { setErr('Enter a valid email address.'); return; }
    if (next === currentEmail.trim().toLowerCase()) { setErr("That's already your email."); return; }
    setBusy(true); setErr('');
    try {
      const { error } = await supabase.auth.updateUser({ email: next }, { emailRedirectTo: authRedirectUrl('auth/callback') });
      if (error) throw error;
      setSentTo(next);
      onRequested(next);
    } catch (e) {
      setErr(friendlyAuthError(e, "Couldn't start the email change. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell open={open} busy={busy} onClose={onClose} icon={Mail} title={sentTo ? 'Check your inbox' : 'Change email'}>
      {sentTo ? (
        <>
          <div className="flex items-start gap-2.5 rounded-[12px] bg-[#ECFDF5] border border-[#A7F3D0] px-3.5 py-3 mt-3">
            <CheckCircle2 size={18} aria-hidden className="text-[#059669] flex-shrink-0 mt-0.5" />
            <p className="text-[#065F46] text-[13px] leading-relaxed">
              We sent a confirmation link to <span className="font-semibold break-all">{sentTo}</span>. Open it to finish the change.
            </p>
          </div>
          <p className="text-[#6B7280] text-[13px] leading-relaxed mt-3">
            For your security, a link may also go to <span className="font-semibold text-[#374151] break-all">{currentEmail}</span>. If it does, open that one too.
            Until the change is confirmed, keep signing in with your current email.
          </p>
          <button type="button" onClick={onClose}
            className="w-full h-[50px] rounded-[10px] bg-[#0A1628] text-white font-bold text-[15px] mt-5">
            Done
          </button>
        </>
      ) : (
        <>
          <p className="text-[#6B7280] text-[13px] leading-relaxed">
            Currently <span className="font-semibold text-[#374151] break-all">{currentEmail}</span>. Shift reminders, receipts and sign-in links go to this address.
          </p>
          <Label htmlFor="new-email">New email</Label>
          <input id="new-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
            value={email} autoFocus
            onChange={(e) => { setEmail(e.target.value); setErr(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
            aria-invalid={!!err} aria-describedby={err ? 'new-email-error' : undefined}
            placeholder="name@example.com"
            className={`${INPUT} ${err ? 'border-[#EF4444]' : 'border-[#E5E7EB]'}`} />
          {err && <p id="new-email-error" role="alert" className="text-[#EF4444] text-[12px] mt-1.5">{err}</p>}
          <div className="flex flex-col gap-2 mt-5">
            <button type="button" onClick={() => void submit()} disabled={busy || !email.trim()}
              className="w-full h-[50px] rounded-[10px] bg-[#0A1628] text-white font-bold text-[15px] disabled:opacity-50">
              {busy ? 'Sending…' : 'Send confirmation link'}
            </button>
            <button type="button" onClick={onClose} disabled={busy}
              className="w-full h-[46px] rounded-[10px] border border-[#E5E7EB] text-[#111827] font-semibold text-[14px] disabled:opacity-60">
              Cancel
            </button>
          </div>
        </>
      )}
    </Shell>
  );
}

// ── Change / set password ─────────────────────────────────────────────────────
function PasswordInput({ id, value, onChange, autoComplete, show, invalid, autoFocus }: {
  id: string; value: string; onChange: (v: string) => void; autoComplete: string;
  show: boolean; invalid?: boolean; autoFocus?: boolean;
}) {
  return (
    <input id={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} value={value} autoFocus={autoFocus}
      autoCapitalize="none" spellCheck={false} aria-invalid={invalid}
      onChange={(e) => onChange(e.target.value)}
      className={`${INPUT} ${invalid ? 'border-[#EF4444]' : 'border-[#E5E7EB]'}`} />
  );
}

export function ChangePasswordSheet({ open, email, hasPassword, onClose, onChanged }: {
  open: boolean;
  email: string;
  /** False for accounts that have only ever used Google / Apple sign-in. */
  hasPassword: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [field, setField] = useState<'current' | 'next' | 'confirm' | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setCurrent(''); setNext(''); setConfirm(''); setShow(false); setErr(''); setField(null); }
  }, [open]);

  const fail = (f: typeof field, m: string) => { setField(f); setErr(m); };

  async function submit() {
    if (hasPassword && !current) return fail('current', 'Enter your current password.');
    if (next.length < PASSWORD_MIN) return fail('next', `Use at least ${PASSWORD_MIN} characters.`);
    if (next !== confirm) return fail('confirm', "The new passwords don't match.");
    if (hasPassword && next === current) return fail('next', 'Choose a password different from your current one.');
    setBusy(true); setErr(''); setField(null);
    try {
      if (hasPassword) {
        // Re-check the current password before changing it, so an unlocked
        // phone left on a table can't be used to take over the account.
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: current });
        if (signInErr) { fail('current', 'Your current password is incorrect.'); return; }
      }
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      onChanged();
      onClose();
    } catch (e) {
      fail('next', friendlyAuthError(e, "Couldn't change your password. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell open={open} busy={busy} onClose={onClose} icon={KeyRound} title={hasPassword ? 'Change password' : 'Set a password'}>
      <p className="text-[#6B7280] text-[13px] leading-relaxed">
        {hasPassword
          ? 'You stay signed in on this device.'
          : `You sign in with Google or Apple. Set a password to also sign in with ${email}.`}
      </p>
      {hasPassword && (
        <>
          <Label htmlFor="pw-current">Current password</Label>
          <PasswordInput id="pw-current" value={current} onChange={(v) => { setCurrent(v); setErr(''); }}
            autoComplete="current-password" show={show} invalid={field === 'current'} autoFocus />
        </>
      )}
      <Label htmlFor="pw-new">New password</Label>
      <PasswordInput id="pw-new" value={next} onChange={(v) => { setNext(v); setErr(''); }}
        autoComplete="new-password" show={show} invalid={field === 'next'} autoFocus={!hasPassword} />
      <Label htmlFor="pw-confirm">Confirm new password</Label>
      <PasswordInput id="pw-confirm" value={confirm} onChange={(v) => { setConfirm(v); setErr(''); }}
        autoComplete="new-password" show={show} invalid={field === 'confirm'} />
      <button type="button" onClick={() => setShow((s) => !s)}
        className="h-10 mt-1 text-[#0A1628] text-[13px] font-semibold flex items-center gap-1.5">
        {show ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
        {show ? 'Hide passwords' : 'Show passwords'}
      </button>
      {err && <p role="alert" className="text-[#EF4444] text-[12px] mt-1">{err}</p>}
      <div className="flex flex-col gap-2 mt-4">
        <button type="button" onClick={() => void submit()} disabled={busy}
          className="w-full h-[50px] rounded-[10px] bg-[#0A1628] text-white font-bold text-[15px] disabled:opacity-50">
          {busy ? 'Saving…' : hasPassword ? 'Change password' : 'Set password'}
        </button>
        <button type="button" onClick={onClose} disabled={busy}
          className="w-full h-[46px] rounded-[10px] border border-[#E5E7EB] text-[#111827] font-semibold text-[14px] disabled:opacity-60">
          Cancel
        </button>
      </div>
    </Shell>
  );
}
