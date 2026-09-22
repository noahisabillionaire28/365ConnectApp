/**
 * Venue map block, Apple Maps style:
 *
 *   [ 11200 Corbin Ave, Porter Ranch, CA 91326            ✕ ]   address bar
 *   [            dark map with the logo pin                  ]
 *   [                      ( Hide Map )                      ]   toggle
 *   [ Sat, Oct 4 • ≈ 22 min drive                   12.3 mi ]   footer
 *
 * Tapping the map or the address opens the caller's directions chooser.
 * "Hide Map" collapses the map and turns into "Show Map".
 */
import { useState } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { AppMap } from '@/components/AppMap';

export function VenueMap({
  address,
  coords,
  markerId,
  distanceMiles,
  footerLeft,
  onOpenDirections,
  height = 220,
}: {
  address: string;
  coords: { lat: number; lng: number };
  markerId: string;
  /** Straight-line miles from the viewer; drives the "N mi" and drive-time estimate. */
  distanceMiles?: number | null;
  /** Left side of the footer, e.g. "Sat, Oct 4 • 5:00 PM". */
  footerLeft?: React.ReactNode;
  onOpenDirections?: () => void;
  height?: number;
}) {
  const [hidden, setHidden] = useState(false);

  const miles = typeof distanceMiles === 'number' && Number.isFinite(distanceMiles) ? distanceMiles : null;
  const milesLabel = miles === null ? null : miles < 10 ? miles.toFixed(1) : Math.round(miles).toString();
  // Rough door-to-door estimate: ~28 mph average across city + highway, plus parking.
  const driveMins = miles === null ? null : Math.max(2, Math.round((miles / 28) * 60 + 3));

  return (
    <div className="rounded-[14px] overflow-hidden border border-[#E5E7EB] bg-white">
      {/* Address bar */}
      <div className="flex items-center gap-2 px-3.5 h-[48px] border-b border-[#EFEFEF]">
        <button
          type="button"
          onClick={onOpenDirections}
          aria-label={`Get directions to ${address}`}
          className="flex-1 min-w-0 text-left text-[#111827] text-[14px] font-medium truncate"
        >
          {address}
        </button>
        <button
          type="button"
          onClick={() => setHidden(true)}
          aria-label="Hide map"
          className="w-7 h-7 rounded-full flex items-center justify-center text-[#6B7280] active:bg-[#F3F4F6] flex-shrink-0"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      {/* Map */}
      {!hidden ? (
        <div className="relative bg-[#1c1c1e]" style={{ height }}>
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
              markers={[{ id: markerId, lat: coords.lat, lng: coords.lng, selected: true }]}
            />
            {/* Transparent tap layer so a tap anywhere on the map opens directions */}
            <span aria-hidden className="absolute inset-0" />
          </button>
          <button
            type="button"
            onClick={() => setHidden(true)}
            className="absolute left-1/2 -translate-x-1/2 bottom-3 z-[2] h-[34px] px-4 rounded-full bg-white text-[#111827] text-[13px] font-semibold shadow-[0_2px_10px_rgba(0,0,0,0.35)] flex items-center gap-1.5 active:scale-[0.98]"
          >
            <ChevronUp size={14} aria-hidden /> Hide Map
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-center py-3 bg-[#FAFAFA] border-b border-[#EFEFEF]">
          <button
            type="button"
            onClick={() => setHidden(false)}
            className="h-[34px] px-4 rounded-full bg-white border border-[#E5E7EB] text-[#111827] text-[13px] font-semibold shadow-sm flex items-center gap-1.5 active:scale-[0.98]"
          >
            <ChevronDown size={14} aria-hidden /> Show Map
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 px-3.5 h-[44px]">
        <p className="text-[#374151] text-[12.5px] font-medium truncate">
          {footerLeft}
          {footerLeft && driveMins !== null ? <span className="text-[#9CA3AF]"> • </span> : null}
          {driveMins !== null && <span>≈ {driveMins} min drive</span>}
        </p>
        {milesLabel !== null && (
          <p className="text-[#111827] text-[13px] font-semibold flex-shrink-0">{milesLabel} mi</p>
        )}
      </div>
    </div>
  );
}
