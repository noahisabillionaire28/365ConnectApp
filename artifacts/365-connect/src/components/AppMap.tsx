/**
 * The app's map. Renders the real Apple Maps (MapKit JS) when the server has
 * an Apple Maps key, otherwise the Apple-styled fallback engine. Screens use
 * this and never care which engine is underneath.
 */
import { useEffect, useState } from 'react';
import { LeafletMap, type MapMarker } from '@/components/LeafletMap';
import { AppleMap } from '@/components/AppleMap';
import { ensureMapKit, knownMapProvider } from '@/lib/mapkit';

export type { MapMarker };

export type AppMapProps = {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  onMarkerClick?: (id: string) => void;
  interactive?: boolean;
  /** pan to `center` whenever it changes */
  recenter?: boolean;
  style?: React.CSSProperties;
  ariaLabel?: string;
};

type Engine = 'apple' | 'fallback' | 'pending';

let resolved: Engine = knownMapProvider() === 'fallback' ? 'fallback' : 'pending';

/** Which engine every map should use; resolves once per tab. */
export function useMapEngine(): Engine {
  const [engine, setEngine] = useState<Engine>(resolved);
  useEffect(() => {
    if (resolved !== 'pending') { setEngine(resolved); return; }
    let alive = true;
    void ensureMapKit().then((ok) => {
      resolved = ok ? 'apple' : 'fallback';
      if (alive) setEngine(resolved);
    });
    return () => { alive = false; };
  }, []);
  return engine;
}

export function AppMap(props: AppMapProps) {
  const engine = useMapEngine();
  if (engine === 'apple') return <AppleMap {...props} />;
  if (engine === 'fallback') return <LeafletMap {...props} />;
  return (
    <div
      role="img"
      aria-label={props.ariaLabel ?? 'Map loading'}
      style={{ width: '100%', height: '100%', background: '#1c1c1e', ...(props.style ?? {}) }}
    />
  );
}
