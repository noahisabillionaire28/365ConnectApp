/**
 * Fallback map engine — free dark basemap, no API key, no billing.
 *
 * Styled to match Apple Maps in dark mode (charcoal land, near-black water,
 * soft grey roads and labels) so the app looks the same before and after the
 * real Apple Maps key is added. Pins are the app's own logo badge or a price
 * pill, identical to the ones drawn on the Apple engine.
 */
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { logoPinUrl, logoPinSize } from '@/lib/mapStyles';

// CARTO "Dark Matter" (OpenStreetMap data) — the closest free match to Apple's
// dark map. Attribution is shown in the corner as their terms require.
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_SUBDOMAINS = 'abcd';
const TILE_ATTR = '&copy; OpenStreetMap &copy; CARTO';
const TILE_MAX_ZOOM = 20;

export type MapMarker = { id: string; lat: number; lng: number; selected?: boolean; label?: string };

function pinIcon(selected: boolean): L.Icon {
  const [w, h] = logoPinSize(selected);
  return L.icon({
    iconUrl: logoPinUrl(selected),
    iconSize: [w, h],
    iconAnchor: [w / 2, h], // tip of the pointer
    className: 'leaflet-logo-pin',
  });
}

/** Airbnb-style price pill pin — shows the shift's pay right on the map.
 * The icon size matches the pill so the whole pill is the clickable hit area. */
function priceIcon(label: string, selected: boolean): L.DivIcon {
  const bg = selected ? '#0A1628' : '#FFFFFF';
  const fg = selected ? '#FFFFFF' : '#0A1628';
  const bd = selected ? '#FFFFFF' : '#D1D5DB';
  const w = Math.max(44, Math.round(18 + label.length * 8.5));
  const h = 28;
  return L.divIcon({
    className: 'leaflet-price-pin',
    html:
      `<div style="width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center;` +
      `background:${bg};color:${fg};border:1.5px solid ${bd};border-radius:9999px;font-weight:800;` +
      `font-size:12px;line-height:1;box-shadow:0 2px 6px rgba(0,0,0,0.35);cursor:pointer;">${label}</div>`,
    iconSize: [w, h],
    iconAnchor: [w / 2, h / 2],
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
  // Leaflet stacks its panes and controls at z-index 400–1000, which would
  // otherwise float above the app's fixed bars, sheets and bottom nav while
  // scrolling. An isolated stacking context keeps all of that inside the map box.
  return (
    <div style={{ position: 'relative', zIndex: 0, isolation: 'isolate', width: '100%', height: '100%', background: '#1c1c1e', ...(style ?? {}) }}>
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      style={{ width: '100%', height: '100%', background: '#1c1c1e' }}
      zoomControl={false}
      attributionControl={false}
      dragging={interactive}
      scrollWheelZoom={interactive}
      doubleClickZoom={interactive}
      touchZoom={interactive}
      boxZoom={interactive}
      keyboard={interactive}
      aria-label={ariaLabel}
    >
      <TileLayer url={TILE_URL} subdomains={TILE_SUBDOMAINS} attribution={TILE_ATTR} maxZoom={TILE_MAX_ZOOM} />
      <InvalidateSize />
      {recenter && <Recenter lat={center.lat} lng={center.lng} zoom={zoom} />}
      {markers.map((m) => (
        <Marker
          key={m.id}
          position={[m.lat, m.lng]}
          icon={m.label ? priceIcon(m.label, !!m.selected) : pinIcon(!!m.selected)}
          zIndexOffset={m.selected ? 1000 : 0}
          eventHandlers={onMarkerClick ? { click: () => onMarkerClick(m.id) } : undefined}
        />
      ))}
    </MapContainer>
    {/* Data credit (required by the tile provider). Apple's engine draws its own. */}
    <span aria-hidden className="absolute left-2 bottom-1.5 z-[1] text-[9px] text-white/45 pointer-events-none select-none">
      © OpenStreetMap © CARTO
    </span>
    </div>
  );
}
