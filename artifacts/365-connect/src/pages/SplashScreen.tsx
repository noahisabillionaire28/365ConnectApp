/**
 * SplashScreen — /
 * Entry point for logged-out users.
 * Logged-in users are sent to the app immediately:
 *  - profile exists  → resolveSetupRoute (usually /home)
 *  - no profile yet  → /role-select (one click to pick role, then /home)
 *  - profile read failed (network) → retry card, never role select: picking a
 *    role there would otherwise rewrite an existing account.
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { WifiOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient, isApiStatus } from '@/lib/api';
import { resolveSetupRoute } from '@/lib/setupRoute';

const NAVY   = '#0A1628';
const BORDER = '#E5E7EB';
const MUTED  = '#6B7280';

export function SplashScreen() {
  const [, navigate] = useLocation();
  const { user, loading, signOut } = useAuth();
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (loading || !user || checking || failed) return;
    setChecking(true);

    apiClient(user.id)
      .get<{ username: string | null; role: string | null; availability: unknown }>('/users/me')
      .then(async (data) => {
        navigate(await resolveSetupRoute(user.id, data ?? null));
      })
      .catch((err) => {
        // Only a definite "no profile row" goes to role selection.
        if (isApiStatus(err, 404)) { navigate('/role-select'); return; }
        setFailed(true);
        setChecking(false);
      });
  }, [user, loading, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (user && failed) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-white px-8 text-center gap-3">
        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: '#F3F4F6' }}>
          <WifiOff size={22} style={{ color: NAVY }} aria-hidden />
        </div>
        <p className="font-bold text-[17px]" style={{ color: NAVY }}>Couldn't load your account</p>
        <p className="text-[14px] leading-relaxed max-w-[280px]" style={{ color: MUTED }}>
          Check your connection and try again. Your account is safe.
        </p>
        <button
          type="button"
          onClick={() => { setFailed(false); setAttempt((n) => n + 1); }}
          className="mt-2 w-full max-w-[280px] text-white font-bold text-[15px] h-[48px] rounded-[12px] active:scale-[0.98] transition-transform"
          style={{ background: NAVY }}
          data-testid="btn-splash-retry"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => { void signOut(); setFailed(false); }}
          className="text-[13px] font-semibold mt-1"
          style={{ color: MUTED }}
        >
          Sign out
        </button>
      </div>
    );
  }

  // Show spinner while auth is loading or while we're checking profile
  if (loading || (user && checking)) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-white">
        <div
          className="w-8 h-8 rounded-full border-[2.5px] border-t-transparent animate-spin"
          style={{ borderColor: `${NAVY} transparent ${NAVY} ${NAVY}` }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-white px-6">
      {/* Wordmark + tagline centred */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <h1
          className="font-extrabold leading-none tracking-[-2px] text-[52px] select-none"
          style={{ color: NAVY }}
        >
          365 CONNECT
        </h1>
        <p className="text-[15px] font-medium" style={{ color: MUTED }}>
          Staff smarter. Work better.
        </p>
      </div>

      {/* CTA buttons */}
      <div className="flex flex-col gap-3 pb-14">
        <button
          onClick={() => navigate('/signup')}
          className="w-full text-white font-bold text-[16px] h-[52px] rounded-[12px] active:scale-[0.98] transition-transform"
          style={{ background: NAVY }}
          data-testid="btn-splash-signup"
        >
          Sign Up
        </button>
        <button
          onClick={() => navigate('/login')}
          className="w-full font-bold text-[16px] h-[52px] rounded-[12px] active:scale-[0.98] transition-transform bg-white"
          style={{ border: `1px solid ${BORDER}`, color: NAVY }}
          data-testid="btn-splash-login"
        >
          Log In
        </button>
      </div>
    </div>
  );
}
