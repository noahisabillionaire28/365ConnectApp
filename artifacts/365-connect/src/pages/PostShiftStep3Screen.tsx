import { Map, Marker, useMapsLibrary } from '@vis.gl/react-google-maps';
import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { ChevronLeft, MapPin, ParkingCircle, Building2 } from 'lucide-react';
import { getDraft, setDraft } from '@/store/postShiftStore';
import { DARK_MAP_STYLES, goldPinUrl } from '@/lib/mapStyles';

/* ─── Step bar ───────────────────────────────────────────────────────────── */
function StepBar({ current, total }: { current: number; total: number }) {
  return (
    <div
      className="flex items-center gap-1.5"
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuetext={`Step ${current} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`h-[3px] rounded-full flex-1 transition-all duration-300 ${
          i < current ? 'bg-primary' : 'bg-[#2A2A2A]'
        }`} />
      ))}
    </div>
  );
}

function FormLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[#555] text-[11px] font-semibold uppercase tracking-wider mb-1.5">
      {children}
    </p>
  );
}

function FormSection({ icon, title, children }: {
  icon: React.ReactNode; title: string; children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-[7px] bg-[#161616] flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <h2 className="text-white font-bold text-[15px]">{title}</h2>
      </div>
      <div className="bg-[#0C0C0C] border border-[#1E1E1E] rounded-[16px] px-4 py-4 flex flex-col gap-4">
        {children}
      </div>
    </div>
  );
}

const INPUT_CLS = `
  w-full bg-[#141414] border border-[#252525] rounded-[10px] px-3 h-[44px]
  text-white text-[14px] font-medium placeholder:text-[#3A3A3A]
  focus:outline-none focus:border-primary/50 focus:bg-[#161616] transition-colors
`;

const TEXTAREA_CLS = `
  w-full bg-[#141414] border border-[#252525] rounded-[10px] px-3 py-3
  text-white text-[14px] font-medium placeholder:text-[#3A3A3A]
  focus:outline-none focus:border-primary/50 focus:bg-[#161616] transition-colors
  resize-none leading-relaxed
`;

const DEFAULT_COORDS = { lat: 25.7825, lng: -80.1298 };

/* ─── Google Places autocomplete ─────────────────────────────────────────── */
function LocationAutocomplete({
  value,
  onChange,
  onPlacePicked,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  onPlacePicked: (coords: { lat: number; lng: number }) => void;
  error?: string;
}) {
  const placesLib = useMapsLibrary('places');
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!placesLib || !inputRef.current) return;
    const ac = new placesLib.Autocomplete(inputRef.current, {
      types:                ['establishment', 'geocode'],
      componentRestrictions: { country: 'us' },
      fields:               ['name', 'formatted_address', 'geometry'],
    });
    const listener = ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (!place) return;
      const display = place.name && place.formatted_address
        ? `${place.name}, ${place.formatted_address}`
        : place.formatted_address ?? place.name ?? '';
      onChange(display);
      if (place.geometry?.location) {
        onPlacePicked({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() });
      }
    });
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).google?.maps?.event?.removeListener(listener);
    };
  }, [placesLib]);

  return (
    <div>
      <input
        ref={inputRef}
        type="text"
        defaultValue={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. 1 Hotel South Beach, Miami FL"
        aria-label="Shift location address"
        aria-invalid={!!error}
        aria-autocomplete="list"
        className={INPUT_CLS + (error ? ' border-red-500/60' : '')}
      />
      {error && <p className="text-red-400 text-[11px] mt-1">{error}</p>}
    </div>
  );
}

/* ─── PostShiftStep3Screen ───────────────────────────────────────────────── */
export function PostShiftStep3Screen() {
  const [, navigate] = useLocation();
  const initial      = getDraft();

  const [location,     setLocation]     = useState(initial.location || '');
  const [mapCoords,    setMapCoords]    = useState({
    lat: initial.lat || DEFAULT_COORDS.lat,
    lng: initial.lng || DEFAULT_COORDS.lng,
  });
  const [unit,         setUnit]         = useState(initial.unit         || '');
  const [parkingNotes, setParkingNotes] = useState(initial.parkingNotes || '');
  const [errors,       setErrors]       = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!location.trim()) e.location = 'Location is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleContinue() {
    if (!validate()) return;
    setDraft({ location, lat: mapCoords.lat, lng: mapCoords.lng, unit, parkingNotes });
    navigate('/post-shift/step4');
  }

  return (
    <div className="min-h-[100dvh] bg-black flex flex-col">

      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-[#111]">
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            aria-label="Back to schedule"
            onClick={() => navigate('/post-shift/step2')}
            className="w-9 h-9 rounded-full bg-[#111] border border-[#222] flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft size={18} aria-hidden className="text-[#888]" />
          </button>
          <div className="flex-1"><StepBar current={3} total={5} /></div>
          <span className="text-[#555] text-[12px] font-medium flex-shrink-0">3 of 5</span>
        </div>
        <h1 className="text-white font-bold text-[22px] tracking-tight">Where is it?</h1>
        <p className="text-[#555] text-[13px] mt-1">Add the venue address and any arrival notes</p>
      </div>

      {/* Scrollable form */}
      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-36">

        {/* Location */}
        <FormSection icon={<MapPin size={13} aria-hidden className="text-primary" />} title="Venue Address">
          <div>
            <FormLabel>Address or venue name</FormLabel>
            <LocationAutocomplete
              value={location}
              onChange={(v) => { setLocation(v); setErrors((p) => ({ ...p, location: '' })); }}
              onPlacePicked={(coords) => setMapCoords(coords)}
              error={errors.location}
            />
          </div>

          {/* Live map preview */}
          <div>
            <FormLabel>Map preview</FormLabel>
            <div className="rounded-[12px] overflow-hidden border border-[#252525]" style={{ height: 150 }}>
              <Map
                center={mapCoords}
                zoom={14}
                styles={DARK_MAP_STYLES}
                disableDefaultUI
                gestureHandling="none"
                backgroundColor="#000000"
                style={{ width: '100%', height: '100%' }}
              >
                <Marker position={mapCoords} icon={goldPinUrl(true)} />
              </Map>
            </div>
          </div>
        </FormSection>

        {/* Unit / Suite */}
        <FormSection icon={<Building2 size={13} aria-hidden className="text-primary" />} title="Unit / Floor / Suite">
          <div>
            <FormLabel>Optional — e.g. "Suite 400" or "Rooftop Level"</FormLabel>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Suite, floor, or entrance details…"
              aria-label="Unit or floor details"
              className={INPUT_CLS}
            />
          </div>
        </FormSection>

        {/* Parking notes */}
        <FormSection icon={<ParkingCircle size={13} aria-hidden className="text-primary" />} title="Parking & Arrival">
          <div>
            <FormLabel>Optional — parking, entrance, or arrival instructions</FormLabel>
            <textarea
              value={parkingNotes}
              onChange={(e) => setParkingNotes(e.target.value)}
              placeholder="e.g. 'Use valet on Collins Ave, enter through staff entrance on rear of building…'"
              aria-label="Parking and arrival notes"
              rows={4}
              className={TEXTAREA_CLS}
            />
          </div>
        </FormSection>
      </div>

      {/* Fixed CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] px-5 pb-9 pt-4 bg-gradient-to-t from-black via-black/95 to-transparent z-10">
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={handleContinue}
          aria-label="Continue to shift details"
          className="w-full h-[54px] rounded-[14px] bg-primary text-black font-bold text-[16px]"
        >
          Continue
        </motion.button>
      </div>
    </div>
  );
}
