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

  const NAVY = '#0A1628';
  const BORDER = '#E5E7EB';
  const TEXT = '#111827';
  const MUTED = '#6B7280';

  return (
    <div className="min-h-[100dvh] flex flex-col px-6 py-10 pb-12 bg-white">
      <h2 className="font-extrabold text-[28px] leading-none tracking-[-1px] mb-10" style={{ color: NAVY }}>
        365 CONNECT
      </h2>

      <h1 className="text-[26px] font-bold mb-2" style={{ color: NAVY }}>Set new password</h1>
      <p className="text-[14px] mb-8" style={{ color: MUTED }}>
        {hasSession
          ? 'Choose a new password for your account.'
          : 'Waiting for your reset link… Open the link from your email first.'}
      </p>

      {done ? (
        <div className="flex items-start gap-2 rounded-[12px] px-4 py-4"
          style={{ background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
          <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-[1px]" />
          <p className="text-emerald-700 text-[13px]">Password updated! Redirecting you to login…</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {error && (
            <div className="flex items-start gap-2 rounded-[12px] px-4 py-3"
              style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
              <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-[1px]" />
              <p className="text-red-600 text-[13px] leading-snug">{error}</p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold ml-1" style={{ color: MUTED }}>New password</label>
            <input
              type="password"
              name="new-password"
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={!hasSession}
              placeholder="Min. 6 characters"
              className="w-full rounded-[14px] px-4 py-4 font-medium text-[15px] outline-none transition-colors placeholder:text-[#AAAAAA] disabled:opacity-40"
              style={{ background: '#FFFFFF', border: `1px solid ${BORDER}`, color: TEXT }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold ml-1" style={{ color: MUTED }}>Confirm password</label>
            <input
              type="password"
              name="confirm-password"
              autoComplete="new-password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              disabled={!hasSession}
              placeholder="Repeat new password"
              className="w-full rounded-[14px] px-4 py-4 font-medium text-[15px] outline-none transition-colors placeholder:text-[#AAAAAA] disabled:opacity-40"
              style={{ background: '#FFFFFF', border: `1px solid ${BORDER}`, color: TEXT }}
            />
          </div>

          <button
            onClick={handleReset}
            disabled={!hasSession || loading || !password || !confirm}
            className="w-full text-white font-bold py-[18px] rounded-[14px] mt-2 active:scale-[0.98] transition-transform disabled:opacity-30"
            style={{ background: NAVY }}
          >
            {loading ? 'Updating…' : 'Update Password'}
          </button>
        </div>
      )}
    </div>
  );
}
