import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ChevronLeft, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function LoginScreen() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;

      // Check whether the user has completed their profile (has a username set)
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('username')
        .eq('id', data.user.id)
        .maybeSingle(); // returns null (not an error) when no row exists

      if (profileError) {
        // Real DB/RLS error — surface it; do not misroute
        throw new Error(`Could not load profile: ${profileError.message}`);
      }

      if (profile?.username) {
        navigate('/home');
      } else {
        // Row missing or username not yet set → send through setup flow
        navigate('/role-select');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  }

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
        redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}reset-password`,
      });
      if (error) throw error;
      setInfo('Password reset email sent! Check your inbox.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset email.');
    } finally {
      setLoading(false);
    }
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
        <h1 className="text-white font-bold text-[24px]">Welcome back</h1>
        <p className="text-muted-foreground text-[14px] mt-1">Sign in to your account</p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mt-4 flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-[12px] px-4 py-3">
          <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-[1px]" />
          <p className="text-red-400 text-[13px] leading-snug">{error}</p>
        </div>
      )}

      {/* Info banner */}
      {info && (
        <div className="mt-4 flex items-start gap-2 bg-blue-500/10 border border-blue-500/30 rounded-[12px] px-4 py-3">
          <AlertCircle size={16} className="text-blue-400 flex-shrink-0 mt-[1px]" />
          <p className="text-blue-400 text-[13px] leading-snug">{info}</p>
        </div>
      )}

      {/* Email / Password Form */}
      <div className="flex flex-col gap-4 mt-8">
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
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            className="w-full bg-[#0E0E0E] border border-[#2A2A2A] text-white placeholder:text-[#555] rounded-[14px] px-4 py-4 font-sans focus:outline-none focus:border-primary transition-colors"
            placeholder="Enter your password"
            data-testid="input-password"
          />
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
          className="w-full bg-primary text-black font-bold text-center py-[18px] rounded-[14px] mt-4 active:scale-[0.98] transition-transform disabled:opacity-40"
          data-testid="btn-login-submit"
        >
          {loading ? 'Signing in…' : 'Log In'}
        </button>
      </div>

      {/* Bottom link */}
      <div className="mt-auto pt-8 text-center">
        <p className="text-muted-foreground text-[14px]">
          Don't have an account?{' '}
          <Link href="/signup" className="text-primary font-medium hover:underline" data-testid="link-signup">
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}
