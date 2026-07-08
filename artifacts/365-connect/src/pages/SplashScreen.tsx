/**
 * SplashScreen — /
 * Entry point for logged-out users.
 * Logged-in users with a complete profile are redirected to /home.
 */
import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { resolveSetupRoute } from '@/lib/setupRoute';

const NAVY   = '#0A1628';
const BORDER = '#E5E7EB';
const MUTED  = '#6B7280';

export function SplashScreen() {
  const [, navigate] = useLocation();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user) return;
    // Already logged in — check setup completion and route accordingly
    supabase.from('users').select('username, role, availability')
      .eq('id', user.id).maybeSingle()
      .then(async ({ data }) => {
        navigate(await resolveSetupRoute(user.id, data ?? null));
      });
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-white">
        <div className="w-8 h-8 rounded-full border-[2.5px] border-t-transparent animate-spin"
          style={{ borderColor: `${NAVY} transparent ${NAVY} ${NAVY}` }} />
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
