/**
 * AuthCallbackScreen — /auth/callback
 *
 * Landing page after any OAuth redirect (Google, Apple).
 * Supabase automatically exchanges the token from the URL hash/params.
 * We wait for the session, check the users table, then route:
 *   - admin              → /admin/dashboard
 *   - worker (complete)  → /home
 *   - worker (no setup)  → /worker-setup
 *   - client (complete)  → /home
 *   - client (no setup)  → /client-setup
 *   - staffer (complete) → /home
 *   - staffer (no setup) → /staffer-setup
 *   - no role            → /role-select
 *   - error              → shown inline
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { apiClient } from '@/lib/api';
import { resolveSetupRoute } from '@/lib/setupRoute';
import type { Session } from '@supabase/supabase-js';

const NAVY = '#0A1628';
const RED  = '#EF4444';

export function AuthCallbackScreen() {
  const [, navigate] = useLocation();
  const handled = useRef(false);
  const [cbError, setCbError] = useState<string | null>(null);

  async function routeAfterAuth(session: Session) {
    if (handled.current) return;
    handled.current = true;

    try {
      // Ensure a row exists for new OAuth users. NEVER send role here — the auth
      // trigger already defaults new rows to 'worker', and the user's real role
      // is only ever set on the Role Select screen. Sending a role here would
      // reset a previously-chosen staffer/client back to worker.
      try {
        await apiClient(session.user.id).post('/users', {
          id:        session.user.id,
          email:     session.user.email ?? null,
          photo_url: (session.user.user_metadata?.['avatar_url'] as string | undefined) ?? null,
        });
      } catch (e) {
        console.warn('[AuthCallback] upsert warning:', e);
      }

      let profile: { username: string | null; role: string | null; availability: unknown } | null = null;
      try {
        profile = await apiClient(session.user.id).get('/users/me');
      } catch (e) {
        console.warn('[AuthCallback] profile load warning:', e);
      }

      // A user who hasn't finished onboarding (no username yet) must pick their
      // role first — otherwise they'd be silently routed down the worker path.
      if (!profile?.username) { navigate('/role-select'); return; }
      navigate(await resolveSetupRoute(session.user.id, profile));
    } catch (err) {
      handled.current = false; // allow retry
      setCbError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) { setCbError(error.message); return; }
      if (session) routeAfterAuth(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) routeAfterAuth(session);
    });

    const fallback = setTimeout(() => {
      if (!handled.current) setCbError('Sign-in timed out. Please go back and try again.');
    }, 10_000);

    return () => { subscription.unsubscribe(); clearTimeout(fallback); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-white px-6">
      <h2 className="font-extrabold text-[28px] leading-none tracking-[-1px] mb-10" style={{ color: NAVY }}>
        365 CONNECT
      </h2>

      {cbError ? (
        <div className="flex flex-col items-center gap-5 max-w-[300px] text-center">
          <div className="flex items-start gap-2 rounded-[12px] px-4 py-3"
            style={{ background: '#FEF2F2', border: `1px solid #FECACA` }}>
            <AlertCircle size={16} style={{ color: RED, flexShrink: 0, marginTop: 1 }} />
            <p className="text-[13px] leading-snug text-left" style={{ color: RED }}>{cbError}</p>
          </div>
          <button onClick={() => navigate('/login')}
            className="font-semibold text-[14px]" style={{ color: NAVY }}>
            Back to Login
          </button>
        </div>
      ) : (
        <>
          <div
            className="w-9 h-9 rounded-full border-[2.5px] border-t-transparent animate-spin"
            style={{ borderColor: `${NAVY} transparent ${NAVY} ${NAVY}` }}
          />
          <p className="text-[13px] mt-5 font-medium" style={{ color: '#6B7280' }}>Signing you in…</p>
        </>
      )}
    </div>
  );
}
