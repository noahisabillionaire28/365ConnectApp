/**
 * Venue map block, Apple Maps style (matches the reference screenshot):
 *
 *   ┌ 11200 Corbin Ave, Porter Ranch, CA 91326            ⓧ ┐   outlined address bar
 *   ├───────────────── edge-to-edge light map ───────────────┤
 *   │   navy balloon pin with the logo · blue "you" dot       │
 *   │ [ Hide Map ]                                            │
 *   │  Maps  Legal  (drawn by Apple's engine)                │
 *   └─────────────────────────────────────────────────────────┘
 *     Tomorrow • Starts 5:42 PM • ≈ 46 min drive       12.3 mi   footer
 *
 * Tapping the address or the map opens the caller's directions chooser.
 * "Hide Map" collapses the map; the button then reads "Show Map".
 */
import { useState } from 'react';
import { X } from 'lucide-react';
import { AppMap, useMapEngine, type MapMarker } from '@/components/AppMap';

export function VenueMap({
  address,
  coords,
  userCoords,
  markerId,
  distanceMiles,
  status,
  detail,
  onOpenDirections,
  height = 300,
}: {
  address: string;
  coords: { lat: number; lng: number };
  /** The viewer's real location, drawn as the blue dot (omit when unknown). */
  userCoords?: { lat: number; lng: number } | null;
  markerId: string;
  /** Straight-line miles from the viewer; drives the "N mi" and drive-time estimate. */
  distanceMiles?: number | null;
  /** Green lead-in of the footer, e.g. "Tomorrow" or "Open now". */
  status?: React.ReactNode;
  /** Rest of the footer, e.g. "Starts 5:42 PM". */
  detail?: React.ReactNode;
  onOpenDirections?: () => void;
  height?: number;
}) {
  const [hidden, setHidden] = useState(false);
  const engine = useMapEngine();

  const miles = typeof distanceMiles === 'number' && Number.isFinite(distanceMiles) ? distanceMiles : null;
  const milesLabel = miles === null ? null : miles < 10 ? miles.toFixed(1) : Math.round(miles).toString();
  // Rough door-to-door estimate: ~28 mph average across city + highway, plus parking.
  const driveMins = miles === null ? null : Math.max(2, Math.round((miles / 28) * 60 + 3));

  const markers: MapMarker[] = [{ id: markerId, lat: coords.lat, lng: coords.lng, selected: true }];
  if (userCoords) markers.push({ id: `${markerId}-me`, lat: userCoords.lat, lng: userCoords.lng, kind: 'me' });

  const footerParts = [
    detail,
    driveMins !== null ? `≈ ${driveMins} min drive` : null,
  ].filter(Boolean);

  return (
    <div>
      {/* Address bar */}
      <div className="flex items-center gap-3 h-[52px] px-4 rounded-[12px] border-[1.5px] border-[#111827] bg-white">
        <button
          type="button"
          onClick={onOpenDirections}
          aria-label={`Get directions to ${address}`}
          className="flex-1 min-w-0 text-left text-[#111827] text-[16px] font-medium truncate"
        >
          {address}
        </button>
        <button
          type="button"
          onClick={() => setHidden((h) => !h)}
          aria-label={hidden ? 'Show map' : 'Hide map'}
          className="w-[26px] h-[26px] rounded-full bg-[#111827] text-white flex items-center justify-center flex-shrink-0 active:opacity-80"
        >
          <X size={14} strokeWidth={3} aria-hidden />
        </button>
      </div>

      {/* Map — edge to edge */}
      {!hidden ? (
        <div className="relative -mx-5 mt-4 bg-[#F2EFE9]" style={{ height }}>
          <button
            type="button"
            onClick={onOpenDirections}
            aria-label="Open directions"
            className="absolute inset-0 block w-full h-full text-left"
          >
            <AppMap
              center={coords}
              zoom={15}
              interactive={false}
              recenter
              ariaLabel="Shift location map"
              markers={markers}
            />
            {/* Transparent tap layer so a tap anywhere on the map opens directions */}
            <span aria-hidden className="absolute inset-0" />
          </button>
          <button
            type="button"
            onClick={() => setHidden(true)}
            className={`absolute left-4 z-[2] h-[44px] px-5 rounded-[12px] bg-white text-[#111827] text-[16px] font-medium shadow-[0_2px_10px_rgba(0,0,0,0.35)] active:scale-[0.98] ${
              engine === 'apple' ? 'bottom-[54px]' : 'bottom-6'}`}
          >
            Hide Map
          </button>
        </div>
      ) : (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setHidden(false)}
            className="h-[44px] px-5 rounded-[12px] bg-white border border-[#E5E7EB] text-[#111827] text-[16px] font-medium shadow-sm active:scale-[0.98]"
          >
            Show Map
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 h-[50px] border-b border-[#E5E7EB]">
        <p className="text-[#111827] text-[14px] truncate">
          {status && <span className="text-[#15803D] font-medium">{status}</span>}
          {status && footerParts.length > 0 && <span className="text-[#111827]"> • </span>}
          {footerParts.map((part, i) => (
            <span key={i}>{i > 0 && ' • '}{part}</span>
          ))}
        </p>
        {milesLabel !== null && (
          <p className="text-[#111827] text-[14px] flex-shrink-0">{milesLabel} mi</p>
        )}
      </div>
    </div>
  );
}
