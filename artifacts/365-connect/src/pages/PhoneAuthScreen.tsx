/**
 * PhoneAuthScreen — /phone-auth
 *
 * Two-step SMS OTP flow:
 *   Step 1 — Enter phone number → supabase.auth.signInWithOtp({ phone })
 *   Step 2 — Enter 6-digit code → supabase.auth.verifyOtp({ phone, token, type: 'sms' })
 *
 * Requires a phone provider (e.g. Twilio) configured in your Supabase project
 * under Authentication → Providers → Phone.
 */
import { useState } from 'react';
import { useLocation } from 'wouter';
import { ChevronLeft, Phone, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { apiClient } from '@/lib/api';

type Step = 'phone' | 'otp';

/**
 * Normalise to E.164 format.
 * - Already E.164 (starts with '+') → return as-is (trimmed).
 * - 11 digits starting with '1'    → add '+' prefix (US with country code).
 * - 10 digits                       → assume US, prepend '+1'.
 * - Anything else                   → prepend '+' and let Supabase validate.
 */
function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  // Already proper E.164
  if (trimmed.startsWith('+')) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

function friendlyError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes('phone') && (lower.includes('not enabled') || lower.includes('provider')))
    return 'Phone login is not yet configured on this project. Please use email or Google instead.';
  if (lower.includes('invalid') && lower.includes('phone'))
    return 'Invalid phone number — include your country code, e.g. +1 555 000 0000.';
  if (lower.includes('otp') || lower.includes('token') || lower.includes('expired'))
    return 'Incorrect or expired code. Check your SMS and try again.';
  if (lower.includes('rate') || lower.includes('too many'))
    return 'Too many attempts. Wait a moment before requesting another code.';
  return msg;
}

export function PhoneAuthScreen() {
  const [, navigate] = useLocation();
  const [step, setStep]       = useState<Step>('phone');
  const [phone, setPhone]     = useState('');
  const [otp, setOtp]         = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [resent, setResent]   = useState(false);

  /* ── Step 1: send OTP ─────────────────────────────── */
  async function handleSendOtp() {
    const normalized = normalizePhone(phone);
    // Require at least 10 digits (after normalisation)
    if (normalized.replace(/\D/g, '').length < 10) {
      setError('Enter a valid phone number including country code.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: normalized });
      if (error) throw error;
      setStep('otp');
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : 'Failed to send code.'));
    } finally {
      setLoading(false);
    }
  }

  /* ── Resend OTP ──────────────────────────────────── */
  async function handleResend() {
    setResent(false);
    setOtp('');
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: normalizePhone(phone) });
      if (error) throw error;
      setResent(true);
      setTimeout(() => setResent(false), 4000);
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : 'Could not resend code.'));
    } finally {
      setLoading(false);
    }
  }

  /* ── Step 2: verify OTP ──────────────────────────── */
  async function handleVerify() {
    if (otp.length < 6) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: verifyErr } = await supabase.auth.verifyOtp({
        phone: normalizePhone(phone),
        token: otp,
        type:  'sms',
      });
      if (verifyErr) throw verifyErr;
      if (!data.session) throw new Error('Verification failed. Please try again.');

      // Ensure a users row exists; do NOT send a role here — the user picks it on
      // Role Select, and sending 'worker' would reset a previously-chosen role.
      await apiClient(data.session.user.id).post('/users', {
        id: data.session.user.id, email: null,
      }).catch((e) => console.warn('[PhoneAuth] upsert warning:', e));

      // Route based on profile completeness
      const { data: profile, error: profileErr } = await supabase
        .from('users')
        .select('username')
        .eq('id', data.session.user.id)
        .maybeSingle();

      const tableNotFound =
        profileErr?.message?.toLowerCase().includes('relation') ||
        profileErr?.message?.toLowerCase().includes('does not exist') ||
        (profileErr as { code?: string } | null)?.code === '42P01';

      if (profileErr && !tableNotFound) {
        throw new Error(friendlyError(profileErr.message));
      }

      navigate(profile?.username ? '/home' : '/role-select');
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : 'Verification failed.'));
    } finally {
      setLoading(false);
    }
  }

  /* ── UI ─────────────────────────────────────────── */
  return (
    <div className="min-h-[100dvh] flex flex-col px-6 py-10 pb-12 bg-white text-[#111827] overflow-y-auto">

      {/* Header */}
      <div className="flex flex-col">
        <button
          onClick={() => step === 'otp' ? (setStep('phone'), setOtp(''), setError(null)) : navigate('/login')}
          className="w-10 h-10 flex items-center justify-center -ml-2 mb-4"
        >
          <ChevronLeft className="w-6 h-6 text-[#111827]" />
        </button>
        <div className="flex items-center gap-1.5">
          <span className="text-primary font-bold text-[28px] leading-none tracking-tight">365</span>
          <span className="text-[#111827] font-bold text-[28px] leading-none tracking-tight">CONNECT</span>
        </div>
      </div>

      <div className="mt-6 mb-8">
        <h1 className="text-[#111827] font-bold text-[24px]">
          {step === 'phone' ? 'Enter your number' : 'Enter the code'}
        </h1>
        <p className="text-[#6B7280] text-[14px] mt-1">
          {step === 'phone'
            ? "We'll text you a one-time verification code."
            : `Sent to ${phone}. Check your messages.`}
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-[12px] px-4 py-3">
          <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-[1px]" />
          <p className="text-red-400 text-[13px] leading-snug">{error}</p>
        </div>
      )}

      {/* Resent confirmation */}
      {resent && (
        <div className="mb-6 flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-[12px] px-4 py-3">
          <RefreshCw size={14} className="text-primary flex-shrink-0" />
          <p className="text-primary text-[13px] font-medium">Code resent!</p>
        </div>
      )}

      {/* ── PHONE STEP ── */}
      {step === 'phone' && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[#6B7280] text-[12px] font-medium ml-1">Phone number</label>
            <div className="flex items-center bg-[#FAFAFA] border border-[#E5E7EB] rounded-[14px] px-4 h-[56px] focus-within:border-primary transition-colors">
              <Phone size={18} className="text-[#9CA3AF] mr-3 flex-shrink-0" />
              <input
                type="tel"
                value={phone}
                onChange={e => { setPhone(e.target.value); setError(null); }}
                onKeyDown={e => e.key === 'Enter' && handleSendOtp()}
                placeholder="+1 (555) 000-0000"
                autoFocus
                className="flex-1 bg-transparent text-[#111827] placeholder:text-[#9CA3AF] outline-none font-sans text-[15px]"
              />
            </div>
            <p className="text-[#9CA3AF] text-[11px] ml-1 mt-0.5">
              Include your country code · e.g. +1 for US, +44 for UK
            </p>
          </div>

          <button
            onClick={handleSendOtp}
            disabled={loading || phone.trim().length < 7}
            className="w-full bg-[#0A1628] text-white font-bold text-[16px] py-[18px] rounded-[14px] active:scale-[0.98] transition-transform disabled:opacity-40"
          >
            {loading ? 'Sending…' : 'Send Code'}
          </button>
        </div>
      )}

      {/* ── OTP STEP ── */}
      {step === 'otp' && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[#6B7280] text-[12px] font-medium ml-1">6-digit code</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); setError(null); }}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              placeholder="000000"
              autoFocus
              className="w-full bg-[#FAFAFA] border border-[#E5E7EB] text-[#111827] placeholder:text-[#9CA3AF] rounded-[14px] px-4 py-5 font-sans text-[28px] text-center tracking-[0.45em] focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <button
            onClick={handleVerify}
            disabled={loading || otp.length < 6}
            className="w-full bg-[#0A1628] text-white font-bold text-[16px] py-[18px] rounded-[14px] active:scale-[0.98] transition-transform disabled:opacity-40"
          >
            {loading ? 'Verifying…' : 'Verify Code'}
          </button>

          <button
            onClick={handleResend}
            disabled={loading}
            className="w-full text-center text-[14px] text-[#6B7280] font-medium hover:text-[#0A1628] transition-colors py-1 disabled:opacity-40"
          >
            Didn't receive it? Resend code
          </button>
        </div>
      )}
    </div>
  );
}
