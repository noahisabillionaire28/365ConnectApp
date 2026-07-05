/**
 * AuthCallbackScreen — /auth/callback
 *
 * Landing page after any OAuth redirect (Google, Apple).
 * Supabase automatically exchanges the token from the URL hash/params.
 * We wait for the session, check the users table, then route:
 *   - returning user with username → /home
 *   - new / incomplete user         → /role-select
 *   - error                         → shown inline with retry option
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

export function AuthCallbackScreen() {
  const [, navigate]  = useLocation();
  const handled       = useRef(false);
  const [cbError, setCbError] = useState<string | null>(null);

  async function routeAfterAuth(session: Session) {
    if (handled.current) return;
    handled.current = true;

    try {
      // Upsert a minimal users row for new OAuth users (ignored if row exists)
      const { error: upsertErr } = await supabase.from('users').upsert(
        {
          id:        session.user.id,
          email:     session.user.email ?? null,
          role:      'worker',
          photo_url: (session.user.user_metadata?.['avatar_url'] as string | undefined) ?? null,
        },
        { onConflict: 'id', ignoreDuplicates: true }
      );
      if (upsertErr) {
        // Non-fatal: log but continue — the profile query below will still work
        // if the row already exists; only truly new rows may be missing.
        console.warn('[AuthCallback] upsert warning:', upsertErr.message);
      }

      // Check if the user has completed their profile (has a username)
      const { data: profile, error: profileErr } = await supabase
        .from('users')
        .select('username')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profileErr) {
        throw new Error(`Could not load your profile: ${profileErr.message}`);
      }

      navigate(profile?.username ? '/home' : '/role-select');
    } catch (err) {
      handled.current = false; // allow retry
      setCbError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
    }
  }

  useEffect(() => {
    // Session may already be established if the Supabase client processed the
    // hash before this component mounted.
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        setCbError(error.message);
        return;
      }
      if (session) routeAfterAuth(session);
    });

    // Also listen for the SIGNED_IN event (fires when hash is still processing)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) routeAfterAuth(session);
    });

    // Fallback: if nothing fires within 10s, show an error
    const fallback = setTimeout(() => {
      if (!handled.current) {
        setCbError('Sign-in timed out. Please go back and try again.');
      }
    }, 10_000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(fallback);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-black px-6">
      <div className="flex items-center gap-1.5 mb-10">
        <span className="text-primary font-bold text-[28px] leading-none tracking-tight">365</span>
        <span className="text-white font-bold text-[28px] leading-none tracking-tight">CONNECT</span>
      </div>

      {cbError ? (
        /* ── Error state ── */
        <div className="flex flex-col items-center gap-5 max-w-[300px] text-center">
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-[12px] px-4 py-3">
            <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-[1px]" />
            <p className="text-red-400 text-[13px] leading-snug text-left">{cbError}</p>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="text-primary font-semibold text-[14px]"
          >
            Back to Login
          </button>
        </div>
      ) : (
        /* ── Loading state ── */
        <>
          <div className="w-9 h-9 rounded-full border-[2.5px] border-primary border-t-transparent animate-spin" />
          <p className="text-[#555] text-[13px] mt-5 font-medium">Signing you in…</p>
        </>
      )}
    </div>
  );
}
