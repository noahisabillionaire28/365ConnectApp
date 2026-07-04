import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ChevronLeft, Phone, AlertCircle, CheckCircle2 } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import { FaApple } from 'react-icons/fa';
import { supabase } from '@/lib/supabase';

export function SignUpScreen() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // null = not submitted | 'confirm' = email confirmation needed | 'done' = session active
  const [signupState, setSignupState] = useState<'idle' | 'confirm' | 'done'>('idle');

  async function handleSignUp() {
    if (!email || password.length < 6) {
      setError('Enter a valid email and a password of at least 6 characters.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      if (data.session) {
        // Email confirmation is disabled in this Supabase project — user is signed in immediately
        setSignupState('done');
        setTimeout(() => navigate('/role-select'), 800);
      } else {
        // Email confirmation is required — do NOT advance yet; wait for user to verify
        setSignupState('confirm');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}role-select`,
        },
      });
      if (error) throw error;
      // Browser will redirect — nothing else to do
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
      setLoading(false);
    }
  }

  async function handleAppleSignIn() {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}role-select`,
        },
      });
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Apple sign-in failed.');
      setLoading(false);
    }
  }

  // ── Email confirmation pending state ──
  if (signupState === 'confirm') {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-10 bg-black text-white">
        <CheckCircle2 size={48} className="text-primary mb-6" />
        <h1 className="text-[24px] font-bold text-center mb-3">Check your email</h1>
        <p className="text-muted-foreground text-[14px] text-center leading-relaxed max-w-[280px]">
          We sent a confirmation link to <span className="text-white font-medium">{email}</span>.
          Open it to activate your account, then come back to log in.
        </p>
        <button
          onClick={() => navigate('/login')}
          className="mt-8 text-primary font-semibold text-[14px]"
        >
          Go to Log In
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col px-6 py-10 pb-12 overflow-y-auto">
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
        <h1 className="text-white font-bold text-[24px]">Create Account</h1>
        <p className="text-muted-foreground text-[14px] mt-1">Join the staffing revolution</p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mt-4 flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-[12px] px-4 py-3">
          <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-[1px]" />
          <p className="text-red-400 text-[13px] leading-snug">{error}</p>
        </div>
      )}

      {/* Social Auth */}
      <div className="flex flex-col gap-3 mt-6">
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full bg-[#0E0E0E] border border-[#2A2A2A] rounded-[14px] py-4 px-4 flex items-center justify-center relative active:scale-[0.98] transition-transform disabled:opacity-50"
          data-testid="btn-auth-google"
        >
          <div className="absolute left-4"><FcGoogle size={22} /></div>
          <span className="text-white font-medium text-[15px]">Continue with Google</span>
        </button>

        <button
          onClick={handleAppleSignIn}
          disabled={loading}
          className="w-full bg-[#0E0E0E] border border-[#2A2A2A] rounded-[14px] py-4 px-4 flex items-center justify-center relative active:scale-[0.98] transition-transform disabled:opacity-50"
          data-testid="btn-auth-apple"
        >
          <div className="absolute left-4"><FaApple size={22} color="white" /></div>
          <span className="text-white font-medium text-[15px]">Continue with Apple</span>
        </button>

        <button
          disabled
          className="w-full bg-[#0E0E0E] border border-[#2A2A2A] rounded-[14px] py-4 px-4 flex items-center justify-center relative opacity-40 cursor-not-allowed"
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

      {/* Email / Password Form */}
      <div className="flex flex-col gap-4 mt-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-muted-foreground text-[12px] font-medium ml-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full bg-[#0E0E0E] border border-[#2A2A2A] text-white placeholder:text-[#555] rounded-[14px] px-4 py-4 font-sans focus:outline-none focus:border-primary transition-colors"
            placeholder="name@example.com"
            data-testid="input-email"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-muted-foreground text-[12px] font-medium ml-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full bg-[#0E0E0E] border border-[#2A2A2A] text-white placeholder:text-[#555] rounded-[14px] px-4 py-4 font-sans focus:outline-none focus:border-primary transition-colors"
            placeholder="Min. 6 characters"
            data-testid="input-password"
          />
        </div>

        <button
          onClick={handleSignUp}
          disabled={loading || !email || !password}
          className="w-full bg-primary text-black font-bold text-center py-[18px] rounded-[14px] mt-2 active:scale-[0.98] transition-transform disabled:opacity-40"
          data-testid="btn-signup-submit"
        >
          {loading ? 'Creating account…' : 'Sign Up'}
        </button>
      </div>

      {/* Bottom link */}
      <div className="mt-8 text-center">
        <p className="text-muted-foreground text-[14px]">
          Already have an account?{' '}
          <Link href="/login" className="text-primary font-medium hover:underline" data-testid="link-login">
            Log In
          </Link>
        </p>
      </div>
    </div>
  );
}
