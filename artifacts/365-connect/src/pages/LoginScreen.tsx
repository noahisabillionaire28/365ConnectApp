import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ChevronLeft, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import { FaApple } from 'react-icons/fa';
import { Phone } from 'lucide-react';
import { supabase } from '@/lib/supabase';

/** Build the OAuth callback URL relative to the current origin + base path. */
function callbackUrl() {
  const base = import.meta.env.BASE_URL ?? '/';
  // Strip trailing slash from base, add /auth/callback
  return `${window.location.origin}${base.replace(/\/$/, '')}/auth/callback`;
}

export function LoginScreen() {
  const [, navigate] = useLocation();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [info, setInfo]         = useState<string | null>(null);

  /* ── Email / password login ─────────────────────────────── */
  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;

      // Check whether the user has completed their profile
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('username')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError) throw new Error(`Could not load profile: ${profileError.message}`);

      navigate(profile?.username ? '/home' : '/role-select');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed.';
      // Surface the exact Supabase message — it's already user-friendly
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  /* ── Forgot password ────────────────────────────────────── */
  async function handleForgotPassword() {
    if (!email) {
      setError('Enter your email above, then tap Forgot password.');
      return;
    }
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}${import.meta.env.BASE_URL ?? '/'}reset-password`,
      });
      if (error) throw error;
      setInfo('Check your inbox — we sent a password reset link.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset email.');
    } finally {
      setLoading(false);
    }
  }

  /* ── Google ─────────────────────────────────────────────── */
  async function handleGoogle() {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: callbackUrl() },
      });
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
      setLoading(false);
    }
  }

  /* ── Apple ──────────────────────────────────────────────── */
  async function handleApple() {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: { redirectTo: callbackUrl() },
      });
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Apple sign-in failed.');
      setLoading(false);
    }
  }

  /* ── UI ─────────────────────────────────────────────────── */
  return (
    <div className="min-h-[100dvh] flex flex-col px-6 py-10 pb-12 bg-black text-white overflow-y-auto">

      {/* Header */}
      <div className="flex flex-col">
        <button
          onClick={() => navigate('/')}
          className="w-10 h-10 flex items-center justify-center -ml-2 mb-4"
          data-testid="btn-back"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <div className="flex items-center gap-1.5">
          <span className="text-primary font-bold text-[28px] leading-none tracking-tight">365</span>
          <span className="text-white font-bold text-[28px] leading-none tracking-tight">CONNECT</span>
        </div>
      </div>

      <div className="mt-6">
        <h1 className="text-white font-bold text-[24px]">Welcome back</h1>
        <p className="text-[#888] text-[14px] mt-1">Sign in to your account</p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mt-5 flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-[12px] px-4 py-3">
          <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-[1px]" />
          <p className="text-red-400 text-[13px] leading-snug">{error}</p>
        </div>
      )}

      {/* Info banner */}
      {info && (
        <div className="mt-5 flex items-start gap-2 bg-blue-500/10 border border-blue-500/30 rounded-[12px] px-4 py-3">
          <AlertCircle size={16} className="text-blue-400 flex-shrink-0 mt-[1px]" />
          <p className="text-blue-400 text-[13px] leading-snug">{info}</p>
        </div>
      )}

      {/* ── Social auth ──────────────────────────────────────── */}
      <div className="flex flex-col gap-3 mt-7">
        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full bg-[#0E0E0E] border border-[#2A2A2A] rounded-[14px] py-4 px-4 flex items-center justify-center relative active:scale-[0.98] transition-transform disabled:opacity-50"
          data-testid="btn-auth-google"
        >
          <div className="absolute left-4"><FcGoogle size={22} /></div>
          <span className="text-white font-medium text-[15px]">Continue with Google</span>
        </button>

        <button
          onClick={handleApple}
          disabled={loading}
          className="w-full bg-[#0E0E0E] border border-[#2A2A2A] rounded-[14px] py-4 px-4 flex items-center justify-center relative active:scale-[0.98] transition-transform disabled:opacity-50"
          data-testid="btn-auth-apple"
        >
          <div className="absolute left-4"><FaApple size={22} color="white" /></div>
          <span className="text-white font-medium text-[15px]">Continue with Apple</span>
        </button>

        <button
          onClick={() => navigate('/phone-auth')}
          disabled={loading}
          className="w-full bg-[#0E0E0E] border border-[#2A2A2A] rounded-[14px] py-4 px-4 flex items-center justify-center relative active:scale-[0.98] transition-transform disabled:opacity-50"
          data-testid="btn-auth-phone"
        >
          <div className="absolute left-4"><Phone size={20} className="text-white" /></div>
          <span className="text-white font-medium text-[15px]">Continue with Phone</span>
        </button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4 mt-6">
        <div className="flex-1 h-[1px] bg-[#2A2A2A]" />
        <span className="text-[#555] text-sm font-medium">or</span>
        <div className="flex-1 h-[1px] bg-[#2A2A2A]" />
      </div>

      {/* ── Email / password form ─────────────────────────────── */}
      <div className="flex flex-col gap-4 mt-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-[#888] text-[12px] font-medium ml-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(null); }}
            className="w-full bg-[#0E0E0E] border border-[#2A2A2A] text-white placeholder:text-[#3A3A3A] rounded-[14px] px-4 py-4 font-sans focus:outline-none focus:border-primary transition-colors"
            placeholder="name@example.com"
            data-testid="input-email"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[#888] text-[12px] font-medium ml-1">Password</label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setError(null); }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full bg-[#0E0E0E] border border-[#2A2A2A] text-white placeholder:text-[#3A3A3A] rounded-[14px] px-4 py-4 pr-12 font-sans focus:outline-none focus:border-primary transition-colors"
              placeholder="Enter your password"
              data-testid="input-password"
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#555] hover:text-white transition-colors"
            >
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="flex justify-end mt-[-4px]">
          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-primary text-sm font-medium"
            data-testid="link-forgot-password"
          >
            Forgot password?
          </button>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading || !email || !password}
          className="w-full bg-primary text-black font-bold text-[16px] py-[18px] rounded-[14px] mt-2 active:scale-[0.98] transition-transform disabled:opacity-40"
          data-testid="btn-login-submit"
        >
          {loading ? 'Signing in…' : 'Log In'}
        </button>
      </div>

      {/* Bottom link */}
      <div className="mt-auto pt-8 text-center">
        <p className="text-[#888] text-[14px]">
          Don't have an account?{' '}
          <Link href="/signup" className="text-primary font-medium" data-testid="link-signup">
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}
