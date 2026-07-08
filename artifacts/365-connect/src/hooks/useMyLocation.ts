import { useEffect, useState } from 'react';
import { supabase, MIAMI_BEACH } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type Coords = { lat: number; lng: number };

/**
 * Resolves "my" location for distance calculations across feeds/map/shift-detail.
 * Priority: stored users.lat/lng → browser geolocation (persisted back to the
 * profile) → Miami Beach fallback so the UI is never blocked or blank.
 */
export function useMyLocation() {
  const { user } = useAuth();
  const [coords, setCoords]   = useState<Coords | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) { setCoords(null); setLoading(false); return; }
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from('users')
        .select('lat, lng')
        .eq('id', user.id)
        .maybeSingle();

      if (cancelled) return;

      // 42703 = undefined column: the Phase 4 migration (users.lat/lng) hasn't
      // been run yet in this environment. Treat it the same as "no stored
      // coords" — fall through to geolocation/fallback — but skip the write-back
      // below since the column doesn't exist to write to.
      const columnsMissing = error?.code === '42703';

      if (!error && data?.lat != null && data?.lng != null) {
        setCoords({ lat: data.lat, lng: data.lng });
        setLoading(false);
        return;
      }

      if (!navigator.geolocation) {
        setCoords(MIAMI_BEACH);
        setLoading(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCoords(c);
          setLoading(false);
          if (!columnsMissing) {
            void supabase.from('users').update({ lat: c.lat, lng: c.lng }).eq('id', user.id);
          }
        },
        () => {
          if (cancelled) return;
          setCoords(MIAMI_BEACH);
          setLoading(false);
        },
        { timeout: 6000, maximumAge: 300_000 },
      );
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  return { coords: coords ?? MIAMI_BEACH, loading };
}
