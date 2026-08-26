/**
 * Reusable Leaflet map — free basemap, no API key, no billing.
 *
 * Replaces Google Maps for tile rendering. Uses CARTO's free "Positron" light
 * basemap (OpenStreetMap data) which looks clean/minimal like Apple Maps. Pins
 * reuse the app's existing navy teardrop SVG so nothing visually changes but the
 * tiles now actually draw.
 */
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { navyPinUrl } from '@/lib/mapStyles';

// Free, key-less light basemap. {r} serves retina tiles on high-DPI screens.
const TILE_URL =
  'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

export type MapMarker = { id: string; lat: number; lng: number; selected?: boolean };

function pinIcon(selected: boolean): L.Icon {
  const size = selected ? 38 : 30;
  const height = Math.round(size * 1.28);
  return L.icon({
    iconUrl: navyPinUrl(selected),
    iconSize: [size, height],
    iconAnchor: [size / 2, height], // tip of the teardrop
    className: 'leaflet-navy-pin',
  });
}

/** Leaflet mis-measures when it mounts in a 0-height/hidden container; fix it. */
function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize(), 120);
    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);
    return () => { window.clearTimeout(id); window.removeEventListener('resize', onResize); };
  }, [map]);
  return null;
}

/** Recenter the map when the target center changes (e.g. a shift/address is picked). */
function Recenter({ lat, lng, zoom }: { lat: number; lng: number; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom ?? map.getZoom(), { animate: true });
  }, [lat, lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function LeafletMap({
  center,
  zoom = 13,
  markers = [],
  onMarkerClick,
  interactive = true,
  recenter = false,
  style,
  ariaLabel,
}: {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  onMarkerClick?: (id: string) => void;
  interactive?: boolean;
  /** pan to `center` whenever it changes */
  recenter?: boolean;
  style?: React.CSSProperties;
  ariaLabel?: string;
}) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      style={style ?? { width: '100%', height: '100%' }}
      zoomControl={false}
      attributionControl
      dragging={interactive}
      scrollWheelZoom={interactive}
      doubleClickZoom={interactive}
      touchZoom={interactive}
      boxZoom={interactive}
      keyboard={interactive}
      aria-label={ariaLabel}
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
      <InvalidateSize />
      {recenter && <Recenter lat={center.lat} lng={center.lng} zoom={zoom} />}
      {markers.map((m) => (
        <Marker
          key={m.id}
          position={[m.lat, m.lng]}
          icon={pinIcon(!!m.selected)}
          eventHandlers={onMarkerClick ? { click: () => onMarkerClick(m.id) } : undefined}
        />
      ))}
    </MapContainer>
  );
}
