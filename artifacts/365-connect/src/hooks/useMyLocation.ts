import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const DEFAULT_LAT = 25.7617;
const DEFAULT_LNG = -80.1918;

export type Coords = { lat: number; lng: number };

export function useMyLocation() {
  const { user } = useAuth();
  const [coords, setCoords]   = useState<Coords>({ lat: DEFAULT_LAT, lng: DEFAULT_LNG });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const tryBrowser = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCoords(c);
          // Persist to API in background
          if (user?.id) {
            apiClient(user.id).patch('/users/me', { lat: c.lat, lng: c.lng }).catch(() => {});
          }
        },
        () => { /* denied — keep default or DB coords */ },
        { timeout: 5000 },
      );
    };

    // Try DB coords first
    if (user?.id) {
      apiClient(user.id).get<{ lat: number | null; lng: number | null }>('/users/me')
        .then((profile) => {
          if (cancelled) return;
          if (profile.lat && profile.lng) {
            setCoords({ lat: profile.lat, lng: profile.lng });
            setLoading(false);
          } else {
            tryBrowser();
            setLoading(false);
          }
        })
        .catch(() => { tryBrowser(); setLoading(false); });
    } else {
      tryBrowser();
      setLoading(false);
    }

    return () => { cancelled = true; };
  }, [user?.id]);

  return { coords, loading };
}
