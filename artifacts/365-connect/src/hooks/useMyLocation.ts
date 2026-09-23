import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const DEFAULT_LAT = 25.7617;
const DEFAULT_LNG = -80.1918;

export type Coords = { lat: number; lng: number };

/**
 * The viewer's coordinates: saved profile location first (shared with the
 * cached profile query, so no extra request), then the browser's GPS, then a
 * Miami default.
 */
export function useMyLocation() {
  const { user } = useAuth();
  const [browserCoords, setBrowserCoords] = useState<Coords | null>(null);

  // Same key + fetch as useProfile → one request, served from cache.
  const { data: row, isLoading } = useQuery<{ lat: number | null; lng: number | null } | null>({
    queryKey: ['profile', user?.id ?? 'anon'],
    enabled:  !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      try { return await apiClient(user?.id).get<{ lat: number | null; lng: number | null }>('/users/me'); }
      catch { return null; }
    },
  });

  const saved: Coords | null = row?.lat && row?.lng ? { lat: row.lat, lng: row.lng } : null;

  // Only ask the browser when the profile has no saved location.
  useEffect(() => {
    if (isLoading || saved || browserCoords || !navigator.geolocation) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setBrowserCoords(c);
        if (user?.id) apiClient(user.id).patch('/users/me', { lat: c.lat, lng: c.lng }).catch(() => {});
      },
      () => { /* denied — keep default */ },
      { timeout: 5000 },
    );
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, !!saved, user?.id]);

  const real = saved ?? browserCoords;
  const coords = real ?? { lat: DEFAULT_LAT, lng: DEFAULT_LNG };
  /** `isDefault` is true when neither the profile nor the browser gave a location. */
  return { coords, loading: !!user?.id && isLoading, isDefault: !real };
}
