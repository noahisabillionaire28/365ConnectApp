/**
 * LoginScreen — /login
 *
 * Email + password sign-in with Google, Apple, and Phone OTP.
 * After a successful sign-in, routes to the correct setup screen if the user
 * hasn't completed onboarding, or to /home if they have.
 *
 * Dev-only: Quick Test Login section is rendered when
 * import.meta.env.VITE_APP_ENV === 'development'.
 */
import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ChevronLeft, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import { FaApple }  from 'react-icons/fa';
import { supabase } from '@/lib/supabase';
import { resolveSetupRoute } from '@/lib/setupRoute';

// ── Design tokens ──────────────────────────────────────────────────────────────
const NAVY   = '#0A1628';
const BORDER = '#E5E7EB';
const TEXT   = '#111827';
const MUTED  = '#6B7280';
const RED    = '#EF4444';

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

/* ── Quick Test Login (dev-only) ──────────────────────────────────────────── */
interface QuickLoginAccount {
  label:     string;
  emailKey:  keyof ImportMetaEnv;
  passKey:   keyof ImportMetaEnv;
}

const QUICK_ACCOUNTS: QuickLoginAccount[] = [
  { label: 'Worker',  emailKey: 'VITE_TEST_WORKER_EMAIL',  passKey: 'VITE_TEST_WORKER_PASSWORD'  },
  { label: 'Client',  emailKey: 'VITE_TEST_CLIENT_EMAIL',  passKey: 'VITE_TEST_CLIENT_PASSWORD'  },
  { label: 'Staffer', emailKey: 'VITE_TEST_STAFFER_EMAIL', passKey: 'VITE_TEST_STAFFER_PASSWORD' },
  { label: 'Admin',   emailKey: 'VITE_TEST_ADMIN_EMAIL',   passKey: 'VITE_TEST_ADMIN_PASSWORD'   },
];

function QuickTestLogin({
  onFill,
}: {
  onFill: (email: string, password: string) => void;
}) {
  if (import.meta.env['VITE_APP_ENV'] !== 'development') return null;

  return (
    <div className="mt-8 pt-6 border-t" style={{ borderColor: BORDER }}>
      <p className="text-[11px] font-semibold uppercase tracking-wider mb-2 text-center"
        style={{ color: MUTED }}>
        Quick Test Login — tap to fill, then tap Log In
      </p>

      <div className="grid grid-cols-2 gap-2">
        {QUICK_ACCOUNTS.map(({ label, emailKey, passKey }) => {
          const email    = import.meta.env[emailKey] as string | undefined;
          const password = import.meta.env[passKey]  as string | undefined;
          const disabled = !email || !password;

          return (
            <button
              key={label}
              type="button"
              disabled={disabled}
              onClick={() => { if (email && password) onFill(email, password); }}
              aria-label={`Fill ${label} credentials`}
              style={{
                borderRadius: '12px',
                border:       `1px solid ${disabled ? BORDER : NAVY}`,
                background:   disabled ? '#F9FAFB' : NAVY,
                color:        disabled ? MUTED : '#FFFFFF',
                fontFamily:   "'Space Grotesk', sans-serif",
                fontSize:     '13px',
                fontWeight:   600,
                padding:      '12px 8px',
                opacity:      disabled ? 0.4 : 1,
                cursor:       disabled ? 'not-allowed' : 'pointer',
                transition:   'opacity 0.15s',
                lineHeight:   1.3,
                textAlign:    'center' as const,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── LoginScreen ─────────────────────────────────────────────────────────── */
export function LoginScreen() {
  const [, navigate] = useLocation();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [info,     setInfo]     = useState<string | null>(null);

  // Per-provider inline errors
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [appleError,  setAppleError]  = useState<string | null>(null);

  async function signInAndRoute(loginEmail: string, loginPassword: string) {
    const { data, error: authErr } = await supabase.auth.signInWithPassword({
      email:    loginEmail,
      password: loginPassword,
    });
    if (authErr) throw authErr;

    const { data: profile, error: profileErr } = await supabase
      .from('users')
      .select('username, role, availability')
      .eq('id', data.user.id)
      .maybeSingle();

    const tableNotFound =
      profileErr?.message?.toLowerCase().includes('relation') ||
      profileErr?.message?.toLowerCase().includes('does not exist') ||
      (profileErr as { code?: string } | null)?.code === '42P01';

    if (profileErr && !tableNotFound)
      throw new Error(`Could not load profile: ${profileErr.message}`);

    navigate(await resolveSetupRoute(data.user.id, profile));
  }

  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true); setError(null); setInfo(null);
    try {
      await signInAndRoute(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Fill form fields with test credentials so user can review and tap Log In
  function handleFill(loginEmail: string, loginPassword: string) {
    setEmail(loginEmail);
    setPassword(loginPassword);
    setError(null);
    setInfo(null);
  }

  async function handleForgotPassword() {
    if (!email) { setError('Enter your email above first, then tap Forgot password.'); return; }
    setLoading(true); setError(null); setInfo(null);
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}${import.meta.env.BASE_URL ?? '/'}reset-password`,
      });
      if (resetErr) throw resetErr;
      setInfo('Check your inbox — we sent a password reset link.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset email.');
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
        <h1 className="font-bold text-[24px]" style={{ color: TEXT }}>Welcome back</h1>
        <p className="text-[14px] mt-1" style={{ color: MUTED }}>Sign in to your account</p>
      </div>

      {/* Error / info banners */}
      {error && (
        <div className="mt-5 flex items-start gap-2 rounded-[12px] px-4 py-3"
          style={{ background: '#FEF2F2', border: `1px solid #FECACA` }}>
          <AlertCircle size={16} style={{ color: RED, flexShrink: 0, marginTop: 1 }} />
          <p className="text-[13px] leading-snug" style={{ color: RED }}>{error}</p>
        </div>
      )}
      {info && (
        <div className="mt-5 flex items-start gap-2 rounded-[12px] px-4 py-3"
          style={{ background: '#EFF6FF', border: `1px solid #BFDBFE` }}>
          <AlertCircle size={16} style={{ color: NAVY, flexShrink: 0, marginTop: 1 }} />
          <p className="text-[13px] leading-snug" style={{ color: NAVY }}>{info}</p>
        </div>
      )}

      {/* Social auth */}
      <div className="flex flex-col gap-3 mt-7">
        <div className="flex flex-col gap-1">
          <button onClick={handleGoogle} disabled={loading}
            className="w-full rounded-[12px] py-4 px-4 flex items-center justify-center relative active:scale-[0.98] transition-transform disabled:opacity-50"
            style={{ border: `1px solid ${BORDER}`, background: '#FFFFFF' }}
            data-testid="btn-auth-google">
            <div className="absolute left-4"><FcGoogle size={20} /></div>
            <span className="font-medium text-[15px]" style={{ color: TEXT }}>Continue with Google</span>
          </button>
          {googleError && <p className="text-[12px] px-1 leading-snug" style={{ color: RED }}>{googleError}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <button onClick={handleApple} disabled={loading}
            className="w-full rounded-[12px] py-4 px-4 flex items-center justify-center relative active:scale-[0.98] transition-transform disabled:opacity-50"
            style={{ border: `1px solid ${BORDER}`, background: '#FFFFFF' }}
            data-testid="btn-auth-apple">
            <div className="absolute left-4"><FaApple size={20} color={TEXT} /></div>
            <span className="font-medium text-[15px]" style={{ color: TEXT }}>Continue with Apple</span>
          </button>
          {appleError && <p className="text-[12px] px-1 leading-snug" style={{ color: RED }}>{appleError}</p>}
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4 mt-6">
        <div className="flex-1 h-[1px]" style={{ background: BORDER }} />
        <span className="text-sm font-medium" style={{ color: MUTED }}>or</span>
        <div className="flex-1 h-[1px]" style={{ background: BORDER }} />
      </div>

      {/* Email / password */}
      <div className="flex flex-col gap-4 mt-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-semibold ml-1" style={{ color: MUTED }}>Email</label>
          <input
            type="email"
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
              value={password}
              onChange={e => { setPassword(e.target.value); setError(null); }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full rounded-[12px] px-4 py-3.5 pr-12 outline-none font-medium text-[15px] transition-colors placeholder:text-[#C0C0C0]"
              style={{ border: `1px solid ${BORDER}`, color: TEXT, background: '#FFFFFF' }}
              placeholder="Enter your password"
              data-testid="input-password"
            />
            <button type="button" onClick={() => setShowPw(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
              style={{ color: MUTED }}>
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="flex justify-end -mt-1">
          <button type="button" onClick={handleForgotPassword}
            className="text-sm font-medium"
            style={{ color: NAVY }}
            data-testid="link-forgot-password">
            Forgot password?
          </button>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading || !email || !password}
          className="w-full text-white font-bold text-[16px] h-[52px] rounded-[12px] mt-2 active:scale-[0.98] transition-transform disabled:opacity-40"
          style={{ background: NAVY }}
          data-testid="btn-login-submit"
        >
          {loading ? 'Signing in…' : 'Log In'}
        </button>
      </div>

      <div className="mt-auto pt-8 text-center">
        <p className="text-[14px]" style={{ color: MUTED }}>
          Don't have an account?{' '}
          <Link href="/signup" className="font-semibold" style={{ color: NAVY }} data-testid="link-signup">
            Sign Up
          </Link>
        </p>
      </div>

      {/* Dev-only quick login — only visible when VITE_APP_ENV === 'development' */}
      <QuickTestLogin onFill={handleFill} />
    </div>
  );
}
