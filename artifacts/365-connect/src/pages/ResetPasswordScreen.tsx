import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function ResetPasswordScreen() {
  const [, navigate] = useLocation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  // Supabase sends the user here after clicking the reset link.
  // onAuthStateChange fires with event "PASSWORD_RECOVERY" and a live session.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setHasSession(true);
      }
    });
    // Also check existing session (e.g. if page reloaded after redirect)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setHasSession(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleReset() {
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col px-6 py-10 pb-12 bg-black text-white">
      <div className="flex items-center gap-1.5 mb-10">
        <span className="text-primary font-bold text-[28px] leading-none tracking-tight">365</span>
        <span className="text-white font-bold text-[28px] leading-none tracking-tight">CONNECT</span>
      </div>

      <h1 className="text-[26px] font-bold mb-2">Set new password</h1>
      <p className="text-muted-foreground text-[14px] mb-8">
        {hasSession
          ? 'Choose a new password for your account.'
          : 'Waiting for your reset link… Open the link from your email first.'}
      </p>

      {done ? (
        <div className="flex items-start gap-2 bg-green-500/10 border border-green-500/30 rounded-[12px] px-4 py-4">
          <CheckCircle2 size={16} className="text-green-400 flex-shrink-0 mt-[1px]" />
          <p className="text-green-400 text-[13px]">Password updated! Redirecting you to login…</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-[12px] px-4 py-3">
              <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-[1px]" />
              <p className="text-red-400 text-[13px] leading-snug">{error}</p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-[12px] font-medium ml-1">New password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={!hasSession}
              placeholder="Min. 6 characters"
              className="w-full bg-[#0E0E0E] border border-[#2A2A2A] text-white placeholder:text-[#555] rounded-[14px] px-4 py-4 focus:outline-none focus:border-primary transition-colors disabled:opacity-40"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-[12px] font-medium ml-1">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              disabled={!hasSession}
              placeholder="Repeat new password"
              className="w-full bg-[#0E0E0E] border border-[#2A2A2A] text-white placeholder:text-[#555] rounded-[14px] px-4 py-4 focus:outline-none focus:border-primary transition-colors disabled:opacity-40"
            />
          </div>

          <button
            onClick={handleReset}
            disabled={!hasSession || loading || !password || !confirm}
            className="w-full bg-primary text-black font-bold py-[18px] rounded-[14px] mt-2 active:scale-[0.98] transition-transform disabled:opacity-30"
          >
            {loading ? 'Updating…' : 'Update Password'}
          </button>
        </div>
      )}
    </div>
  );
}
