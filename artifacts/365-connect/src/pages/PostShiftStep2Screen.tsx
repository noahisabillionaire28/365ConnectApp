/**
 * Step 2 of 5 — Location
 * Address autocomplete + Apple-light map preview + optional unit/suite.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { ChevronLeft, MapPin, Building2 } from 'lucide-react';
import { Map, Marker, useMapsLibrary } from '@vis.gl/react-google-maps';
import { getDraft, setDraft } from '@/store/postShiftStore';
import { LIGHT_MAP_STYLES, navyPinUrl } from '@/lib/mapStyles';
import { BottomTabNav } from '@/components/BottomTabNav';

// ─── Wizard primitives ────────────────────────────────────────────────────────
function StepBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5" role="progressbar"
      aria-valuenow={current} aria-valuemin={1} aria-valuemax={total}
      aria-valuetext={`Step ${current} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`h-[3px] rounded-full flex-1 transition-all duration-300 ${
          i < current ? 'bg-[#0A1628]' : 'bg-[#E5E7EB]'
        }`} />
      ))}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[#6B7280] text-[11px] font-semibold uppercase tracking-wider mb-1.5">
      {children}
    </p>
  );
}

const INPUT_CLS =
  'w-full bg-white border border-[#E5E7EB] rounded-[10px] px-3 h-[46px] ' +
  'text-[#111827] text-[14px] font-medium placeholder:text-[#9CA3AF] ' +
  'focus:outline-none focus:border-[#0A1628] transition-colors';

const DEFAULT_COORDS = { lat: 25.7825, lng: -80.1298 };

// ─── Google Places Autocomplete input ────────────────────────────────────────
function LocationAutocomplete({
  value, onChange, onPlacePicked, error,
}: {
  value: string;
  onChange: (v: string) => void;
  onPlacePicked: (coords: { lat: number; lng: number }, address: string) => void;
  error?: string;
}) {
  const placesLib = useMapsLibrary('places');
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!placesLib || !inputRef.current) return;

    const ac = new placesLib.Autocomplete(inputRef.current, {
      types: ['establishment', 'geocode'],
      componentRestrictions: { country: 'us' },
      fields: ['name', 'formatted_address', 'geometry'],
    });

    const listener = ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (place.geometry?.location) {
        const coords = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        };
        const address = place.formatted_address || place.name || '';
        onPlacePicked(coords, address);
      }
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [placesLib, onPlacePicked]);

  return (
    <div>
      <input
        ref={inputRef}
        type="text"
        defaultValue={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Fontainebleau Miami Beach"
        aria-label="Venue address or name"
        aria-invalid={!!error}
        className={INPUT_CLS + (error ? ' border-[#EF4444]' : '')}
      />
      {error && <p className="text-[#EF4444] text-[11px] mt-1.5">{error}</p>}
    </div>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export function PostShiftStep2Screen() {
  const [, navigate] = useLocation();
  const initial      = getDraft();

  const [location,   setLocation]   = useState(initial.location);
  const [mapCoords,  setMapCoords]  = useState({ lat: initial.lat, lng: initial.lng });
  const [unitInfo,   setUnitInfo]   = useState(initial.unit_info);
  const [errors,     setErrors]     = useState<Record<string, string>>({});

  const handlePlacePicked = useCallback(
    (coords: { lat: number; lng: number }, address: string) => {
      setMapCoords(coords);
      setLocation(address);
      setErrors((p) => ({ ...p, location: '' }));
    },
    [],
  );

  function validate() {
    const e: Record<string, string> = {};
    if (!location.trim()) e.location = 'Please enter a venue address';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleContinue() {
    if (!validate()) return;
    setDraft({
      location: location.trim(),
      lat:      mapCoords.lat,
      lng:      mapCoords.lng,
      unit_info: unitInfo.trim(),
    });
    navigate('/post-shift/step3');
  }

  // Ensure map coords are sane if draft had defaults
  const displayCoords = mapCoords.lat && mapCoords.lng ? mapCoords : DEFAULT_COORDS;

  return (
    <div className="min-h-[100dvh] bg-[#F7F8FA] flex flex-col pb-[72px]">

      {/* Header */}
      <div className="bg-white px-5 pt-5 pb-4 border-b border-[#E5E7EB] sticky top-0 z-30">
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button" aria-label="Back to job type"
            onClick={() => navigate('/post-shift/step1')}
            className="w-9 h-9 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft size={18} aria-hidden className="text-[#111827]" />
          </button>
          <div className="flex-1"><StepBar current={2} total={5} /></div>
          <span className="text-[#6B7280] text-[12px] font-semibold flex-shrink-0">2 of 5</span>
        </div>
        <h1 className="text-[#111827] font-bold text-[22px] tracking-tight">Where is it?</h1>
        <p className="text-[#6B7280] text-[13px] mt-0.5">Enter the venue address</p>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-36">

        {/* Venue address */}
        <div className="bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-[7px] bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center">
              <MapPin size={13} aria-hidden className="text-[#0A1628]" />
            </div>
            <h2 className="text-[#111827] font-bold text-[15px]">Venue Address</h2>
          </div>
          <div className="flex flex-col gap-4">
            <div>
              <FieldLabel>
                Address or venue name <span className="normal-case text-[#EF4444]">*</span>
              </FieldLabel>
              <LocationAutocomplete
                value={location}
                onChange={(v) => { setLocation(v); setErrors((p) => ({ ...p, location: '' })); }}
                onPlacePicked={handlePlacePicked}
                error={errors.location}
              />
            </div>
            <div>
              <FieldLabel>Map preview</FieldLabel>
              <div
                className="rounded-[10px] overflow-hidden border border-[#E5E7EB]"
                style={{ height: 180 }}
                aria-label="Map showing shift location"
                role="img"
              >
                <Map
                  center={displayCoords}
                  zoom={14}
                  // @ts-ignore — vis.gl Map passes unknown props through to MapOptions
                  styles={LIGHT_MAP_STYLES}
                  disableDefaultUI
                  gestureHandling="none"
                  backgroundColor="#f5f5f5"
                  style={{ width: '100%', height: '100%' }}
                >
                  <Marker position={displayCoords} icon={navyPinUrl(true)} />
                </Map>
              </div>
            </div>
          </div>
        </div>

        {/* Unit / suite */}
        <div className="bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-[7px] bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center">
              <Building2 size={13} aria-hidden className="text-[#6B7280]" />
            </div>
            <h2 className="text-[#111827] font-bold text-[15px]">Unit / Floor / Suite</h2>
          </div>
          <FieldLabel>Optional — e.g. "Suite 400" or "Rooftop Level"</FieldLabel>
          <input
            type="text"
            value={unitInfo}
            onChange={(e) => setUnitInfo(e.target.value)}
            placeholder="Suite, floor, or entrance details…"
            aria-label="Unit or floor details"
            className={INPUT_CLS}
          />
        </div>

      </div>

      {/* Fixed CTA */}
      <div className="fixed bottom-[56px] left-1/2 -translate-x-1/2 w-full max-w-[390px] px-5 pb-4 pt-4
        bg-gradient-to-t from-[#F7F8FA] via-[#F7F8FA]/95 to-transparent z-20">
        <motion.button
          type="button" whileTap={{ scale: 0.97 }}
          onClick={handleContinue}
          aria-label="Continue to schedule"
          className="w-full h-[52px] rounded-[12px] bg-[#0A1628] text-white font-bold text-[16px]"
        >
          Continue
        </motion.button>
      </div>

      <BottomTabNav />
    </div>
  );
}
