/**
 * Runs once inside the native iOS app: status bar, splash, deep links, and
 * push registration. Renders nothing and is a no-op on the web.
 */
import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { initNative, isNative, registerNativePush } from '@/lib/native';
import { rememberNativeToken } from '@/hooks/usePush';
import { supabase } from '@/lib/supabase';

export function NativeBridge() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const started = useRef(false);

  // Platform setup + link handling (once).
  useEffect(() => {
    if (!isNative() || started.current) return;
    started.current = true;
    void initNative({
      onOpenPath: (path) => {
        // Supabase links arrive as connect365://auth/callback#access_token=…
        // (OAuth / magic link) or connect365://reset-password#…&type=recovery
        // (password reset). Both carry the tokens in the fragment; a failed
        // link carries `error=` instead, which the reset screen explains.
        const isAuthLink = path.startsWith('/auth/callback') || path.startsWith('/reset-password');
        if (isAuthLink) {
          const [, fragment = ''] = path.split('#');
          const hash = new URLSearchParams(fragment);
          const access = hash.get('access_token');
          const refresh = hash.get('refresh_token');
          const recovery = hash.get('type') === 'recovery' || path.startsWith('/reset-password');
          if (access && refresh) {
            void supabase.auth.setSession({ access_token: access, refresh_token: refresh })
              .then(() => navigate(recovery ? '/reset-password' : '/'));
            return;
          }
          if (recovery) { navigate(`/reset-password${fragment ? `#${fragment}` : ''}`); return; }
        }
        navigate(path);
      },
      onResume: () => {
        // Back from the background: refresh what the user is looking at.
        void qc.invalidateQueries();
      },
    });
  }, [navigate, qc]);

  // Push: once signed in, register the device if the user already allowed
  // notifications (the explicit prompt lives in Notification Settings).
  useEffect(() => {
    if (!isNative() || !user?.id) return;
    void registerNativePush({ promptIfNeeded: false }).then((token) => {
      rememberNativeToken(token);
      if (token) void apiClient(user.id).post('/push/subscribe', { platform: 'ios', token }).catch(() => {});
    });
  }, [user?.id]);

  return null;
}
