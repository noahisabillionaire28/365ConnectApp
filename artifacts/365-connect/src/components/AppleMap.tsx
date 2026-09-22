/**
 * The real Apple Maps (MapKit JS), dark scheme, with the app's own pins.
 * Same props as LeafletMap so screens can swap engines without changes.
 * Only rendered once `ensureMapKit()` resolved true (see AppMap).
 */
import { useEffect, useRef } from 'react';
import type { MapMarker } from '@/components/LeafletMap';
import { logoPinUrl, logoPinSize } from '@/lib/mapStyles';

/* eslint-disable @typescript-eslint/no-explicit-any */

function pinElement(selected: boolean): HTMLElement {
  const [w, h] = logoPinSize(selected);
  const img = document.createElement('img');
  img.src = logoPinUrl(selected);
  img.width = w; img.height = h;
  img.alt = '';
  img.draggable = false;
  img.style.display = 'block';
  return img;
}

function priceElement(label: string, selected: boolean): HTMLElement {
  const el = document.createElement('div');
  const w = Math.max(44, Math.round(18 + label.length * 8.5));
  el.style.cssText =
    `width:${w}px;height:28px;display:flex;align-items:center;justify-content:center;` +
    `background:${selected ? '#0A1628' : '#FFFFFF'};color:${selected ? '#FFFFFF' : '#0A1628'};` +
    `border:1.5px solid ${selected ? '#FFFFFF' : '#D1D5DB'};border-radius:9999px;font-weight:800;` +
    `font-size:12px;line-height:1;box-shadow:0 2px 6px rgba(0,0,0,0.35);cursor:pointer;font-family:inherit;`;
  el.textContent = label;
  return el;
}

/** Convert a Leaflet-style zoom level into a MapKit coordinate span for this box. */
function spanForZoom(zoom: number, lat: number, widthPx: number, heightPx: number) {
  const worldPx = 256 * Math.pow(2, zoom);
  const lngDelta = (Math.max(widthPx, 1) * 360) / worldPx;
  const latDelta = (Math.max(heightPx, 1) * 360) / worldPx * Math.cos((lat * Math.PI) / 180);
  return { latDelta: Math.max(latDelta, 0.0005), lngDelta: Math.max(lngDelta, 0.0005) };
}

export function AppleMap({
  center, zoom = 13, markers = [], onMarkerClick, interactive = true, recenter = false, style, ariaLabel,
}: {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  onMarkerClick?: (id: string) => void;
  interactive?: boolean;
  recenter?: boolean;
  style?: React.CSSProperties;
  ariaLabel?: string;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const annotationsRef = useRef<any[]>([]);
  const clickRef = useRef(onMarkerClick);
  clickRef.current = onMarkerClick;

  function setRegion(map: any, lat: number, lng: number, z: number, animate: boolean) {
    const el = boxRef.current;
    const { latDelta, lngDelta } = spanForZoom(z, lat, el?.clientWidth ?? 360, el?.clientHeight ?? 200);
    const mk = window.mapkit;
    const region = new mk.CoordinateRegion(new mk.Coordinate(lat, lng), new mk.CoordinateSpan(latDelta, lngDelta));
    map.setRegionAnimated(region, animate);
  }

  // Create the map once.
  useEffect(() => {
    const mk = window.mapkit;
    const el = boxRef.current;
    if (!mk || !el) return;
    const map = new mk.Map(el, {
      colorScheme: mk.Map.ColorSchemes.Dark,
      showsCompass: mk.FeatureVisibility.Hidden,
      showsMapTypeControl: false,
      showsZoomControl: false,
      showsScale: mk.FeatureVisibility.Hidden,
      showsPointsOfInterest: true,
      isRotationEnabled: false,
      isScrollEnabled: interactive,
      isZoomEnabled: interactive,
    });
    mapRef.current = map;
    setRegion(map, center.lat, center.lng, zoom, false);
    // MapKit measures on creation; a late layout (tabs, sheets) needs a nudge.
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => { try { map.element?.dispatchEvent?.(new Event('resize')); } catch { /* noop */ } })
      : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      try { map.destroy(); } catch { /* noop */ }
      mapRef.current = null;
      annotationsRef.current = [];
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Interaction toggles.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.isScrollEnabled = interactive;
    map.isZoomEnabled = interactive;
  }, [interactive]);

  // Follow the center when asked.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !recenter) return;
    setRegion(map, center.lat, center.lng, zoom, true);
  }, [center.lat, center.lng, zoom, recenter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pins.
  useEffect(() => {
    const map = mapRef.current;
    const mk = window.mapkit;
    if (!map || !mk) return;
    if (annotationsRef.current.length) map.removeAnnotations(annotationsRef.current);
    const next = markers.map((m) => {
      const selected = !!m.selected;
      const [, h] = logoPinSize(selected);
      const ann = new mk.Annotation(
        new mk.Coordinate(m.lat, m.lng),
        () => (m.label ? priceElement(m.label, selected) : pinElement(selected)),
        {
          // A teardrop's tip sits on the coordinate; a pill is centered on it.
          anchorOffset: m.label ? new DOMPoint(0, 0) : new DOMPoint(0, -h / 2),
          displayPriority: selected ? 1000 : 750,
          animates: false,
          data: { id: m.id },
        },
      );
      ann.addEventListener('select', () => {
        clickRef.current?.(m.id);
        // Keep MapKit from drawing its own selection state; our pin styles handle it.
        try { ann.selected = false; } catch { /* noop */ }
      });
      return ann;
    });
    annotationsRef.current = next;
    if (next.length) map.addAnnotations(next);
  }, [markers]);

  return (
    <div
      ref={boxRef}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      className="apple-map"
      style={{ position: 'relative', zIndex: 0, isolation: 'isolate', width: '100%', height: '100%', background: '#1c1c1e', ...(style ?? {}) }}
    />
  );
}
