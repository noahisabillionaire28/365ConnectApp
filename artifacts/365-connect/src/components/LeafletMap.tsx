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

// Free, key-less street basemap (Esri "World Street Map") — richer than the
// blank light-gray canvas (roads, places, labels), no API key, no watermark.
const TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
const TILE_ATTR = 'Tiles &copy; Esri';
const TILE_MAX_ZOOM = 18;

export type MapMarker = { id: string; lat: number; lng: number; selected?: boolean; label?: string };

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

/** Airbnb-style price pill pin — shows the shift's pay right on the map. */
function priceIcon(label: string, selected: boolean): L.DivIcon {
  const bg = selected ? '#0A1628' : '#FFFFFF';
  const fg = selected ? '#FFFFFF' : '#0A1628';
  const bd = selected ? '#0A1628' : '#D1D5DB';
  return L.divIcon({
    className: 'leaflet-price-pin',
    html:
      `<div style="transform:translate(-50%,-100%);display:inline-block;background:${bg};color:${fg};` +
      `border:1.5px solid ${bd};border-radius:9999px;padding:5px 11px;font-weight:800;font-size:12px;` +
      `line-height:1;white-space:nowrap;box-shadow:0 2px 6px rgba(16,24,40,0.22);">${label}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
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
      attributionControl={false}
      dragging={interactive}
      scrollWheelZoom={interactive}
      doubleClickZoom={interactive}
      touchZoom={interactive}
      boxZoom={interactive}
      keyboard={interactive}
      aria-label={ariaLabel}
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTR} maxZoom={TILE_MAX_ZOOM} />
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
  );
}
