/**
 * SignUpScreen — /signup
 *
 * Email + password form plus Google, Apple, and Phone OTP sign-in buttons.
 * OAuth providers show an inline error message if not configured in Supabase,
 * rather than crashing the app.
 */
import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ChevronLeft, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import { FaApple }  from 'react-icons/fa';
import { supabase } from '@/lib/supabase';
import { apiClient } from '@/lib/api';

// ── Design tokens ──────────────────────────────────────────────────────────────
const NAVY   = '#0A1628';
const BORDER = '#E5E7EB';
const TEXT   = '#111827';
const MUTED  = '#6B7280';
const RED    = '#EF4444';

// Google/Apple sign-in are not configured in Supabase yet ("provider is not
// enabled"), so hide those buttons until they're set up. Flip to true once the
// providers are enabled in the Supabase dashboard.
const SHOW_SOCIAL_AUTH = false;

function callbackUrl() {
  const base = import.meta.env.BASE_URL ?? '/';
  return `${window.location.origin}${base.replace(/\/$/, '')}/auth/callback`;
}

function friendlyProviderError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes('not enabled') || lower.includes('provider') || lower.includes('disabled'))
    return "This sign-in method isn\u2019t configured yet. Please use email instead.";
  return msg;
}

export function SignUpScreen() {
  const [, navigate] = useLocation();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [signupState, setSignupState] = useState<'idle' | 'confirm' | 'done'>('idle');

  // Per-provider errors (shown inline below each button)
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [appleError,  setAppleError]  = useState<string | null>(null);

  async function handleSignUp() {
    if (!email.trim()) { setError('Enter your email address.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true); setError(null);
    try {
      // Create an already-confirmed account server-side (no email round-trip),
      // then sign in normally to obtain a session.
      await apiClient(null).post('/auth/register', { email: email.trim(), password });

      const { data, error: signInErr } =
        await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInErr) throw signInErr;

      if (data.session) {
        await apiClient(data.session.user.id).post('/users', {
          id: data.session.user.id, email: email.trim(), role: 'worker',
        }).catch(() => {}); // ignore if already exists
        setSignupState('done');
        setTimeout(() => navigate('/role-select'), 600);
      } else {
        setSignupState('confirm');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleError(null); setError(null);
    try {
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: callbackUrl() },
      });
      if (oauthErr) throw oauthErr;
    } catch (err) {
      setGoogleError(friendlyProviderError(err));
    }
  }

  async function handleApple() {
    setAppleError(null); setError(null);
    try {
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: { redirectTo: callbackUrl() },
      });
      if (oauthErr) throw oauthErr;
    } catch (err) {
      setAppleError(friendlyProviderError(err));
    }
  }

  // ── Email-confirmation state ───────────────────────────────────────────────
  if (signupState === 'confirm') {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-10 bg-white">
        <CheckCircle2 size={52} style={{ color: NAVY }} className="mb-6" />
        <h1 className="text-[24px] font-bold text-center mb-3" style={{ color: TEXT }}>Check your email</h1>
        <p className="text-[14px] text-center leading-relaxed max-w-[280px]" style={{ color: MUTED }}>
          We sent a confirmation link to{' '}
          <span className="font-semibold" style={{ color: TEXT }}>{email}</span>.{' '}
          Open it to activate your account, then come back to log in.
        </p>
        <button onClick={() => navigate('/login')}
          className="mt-8 font-semibold text-[14px]" style={{ color: NAVY }}>
          Go to Log In
        </button>
      </div>
    );
  }

  // ── Sign-up done (instant session) ────────────────────────────────────────
  if (signupState === 'done') {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-10 bg-white">
        <CheckCircle2 size={52} style={{ color: '#10B981' }} className="mb-6" />
        <h1 className="text-[24px] font-bold text-center" style={{ color: TEXT }}>Account created!</h1>
        <p className="text-[14px] mt-2" style={{ color: MUTED }}>Taking you to role selection…</p>
      </div>
    );
  }

  // ── Main sign-up form ─────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] flex flex-col px-6 py-10 pb-12 bg-white overflow-y-auto">

      {/* Header */}
      <div className="flex flex-col">
        <button onClick={() => navigate('/')}
          className="w-10 h-10 flex items-center justify-center -ml-2 mb-4"
          data-testid="btn-back">
          <ChevronLeft className="w-6 h-6" style={{ color: TEXT }} />
        </button>
        <h2 className="font-extrabold text-[28px] leading-none tracking-[-1px]" style={{ color: NAVY }}>
          365 CONNECT
        </h2>
      </div>

      <div className="mt-6">
        <h1 className="font-bold text-[24px]" style={{ color: TEXT }}>Create Account</h1>
        <p className="text-[14px] mt-1" style={{ color: MUTED }}>Join the staffing revolution</p>
      </div>

      {error && (
        <div className="mt-5 flex items-start gap-2 rounded-[12px] px-4 py-3"
          style={{ background: '#FEF2F2', border: `1px solid #FECACA` }}>
          <AlertCircle size={16} style={{ color: RED, flexShrink: 0, marginTop: 1 }} />
          <p className="text-[13px] leading-snug" style={{ color: RED }}>{error}</p>
        </div>
      )}

      {/* Social auth — hidden until Google/Apple are enabled in Supabase */}
      {SHOW_SOCIAL_AUTH && (
        <>
          <div className="flex flex-col gap-3 mt-7">
            <div className="flex flex-col gap-1">
              <button onClick={handleGoogle} disabled={loading}
                className="w-full rounded-[12px] py-4 px-4 flex items-center justify-center relative active:scale-[0.98] transition-transform disabled:opacity-50"
                style={{ border: `1px solid ${BORDER}`, background: '#FFFFFF' }}
                data-testid="btn-auth-google">
                <div className="absolute left-4"><FcGoogle size={20} /></div>
                <span className="font-medium text-[15px]" style={{ color: TEXT }}>Continue with Google</span>
              </button>
              {googleError && (
                <p className="text-[12px] px-1 leading-snug" style={{ color: RED }}>{googleError}</p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <button onClick={handleApple} disabled={loading}
                className="w-full rounded-[12px] py-4 px-4 flex items-center justify-center relative active:scale-[0.98] transition-transform disabled:opacity-50"
                style={{ border: `1px solid ${BORDER}`, background: '#FFFFFF' }}
                data-testid="btn-auth-apple">
                <div className="absolute left-4"><FaApple size={20} color={TEXT} /></div>
                <span className="font-medium text-[15px]" style={{ color: TEXT }}>Continue with Apple</span>
              </button>
              {appleError && (
                <p className="text-[12px] px-1 leading-snug" style={{ color: RED }}>{appleError}</p>
              )}
            </div>

          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 mt-6">
            <div className="flex-1 h-[1px]" style={{ background: BORDER }} />
            <span className="text-sm font-medium" style={{ color: MUTED }}>or</span>
            <div className="flex-1 h-[1px]" style={{ background: BORDER }} />
          </div>
        </>
      )}

      {/* Email / password */}
      <div className="flex flex-col gap-4 mt-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-semibold ml-1" style={{ color: MUTED }}>Email</label>
          <input
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(null); }}
            className="w-full rounded-[12px] px-4 py-3.5 outline-none font-medium text-[15px] transition-colors placeholder:text-[#C0C0C0]"
            style={{ border: `1px solid ${BORDER}`, color: TEXT, background: '#FFFFFF' }}
            placeholder="name@example.com"
            data-testid="input-email"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-semibold ml-1" style={{ color: MUTED }}>Password</label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              name="new-password"
              autoComplete="new-password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(null); }}
              onKeyDown={e => e.key === 'Enter' && handleSignUp()}
              className="w-full rounded-[12px] px-4 py-3.5 pr-12 outline-none font-medium text-[15px] transition-colors placeholder:text-[#C0C0C0]"
              style={{ border: `1px solid ${BORDER}`, color: TEXT, background: '#FFFFFF' }}
              placeholder="Min. 6 characters"
              data-testid="input-password"
            />
            <button type="button" onClick={() => setShowPw(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
              style={{ color: MUTED }}>
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button
          onClick={handleSignUp}
          disabled={loading || !email || !password}
          className="w-full text-white font-bold text-[16px] h-[52px] rounded-[12px] mt-2 active:scale-[0.98] transition-transform disabled:opacity-40"
          style={{ background: NAVY }}
          data-testid="btn-signup-submit"
        >
          {loading ? 'Creating account…' : 'Sign Up'}
        </button>
      </div>

      <div className="mt-8 text-center">
        <p className="text-[14px]" style={{ color: MUTED }}>
          Already have an account?{' '}
          <Link href="/login" className="font-semibold" style={{ color: NAVY }} data-testid="link-login">
            Log In
          </Link>
        </p>
      </div>
    </div>
  );
}
