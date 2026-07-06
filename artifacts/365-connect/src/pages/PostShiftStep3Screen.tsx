import { Map, Marker, useMapsLibrary } from '@vis.gl/react-google-maps';
import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { ChevronLeft, MapPin, ParkingCircle, Building2 } from 'lucide-react';
import { getDraft, setDraft } from '@/store/postShiftStore';
import { LIGHT_MAP_STYLES, blackPinUrl } from '@/lib/mapStyles';

function StepBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5" role="progressbar"
      aria-valuenow={current} aria-valuemin={1} aria-valuemax={total}
      aria-valuetext={`Step ${current} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`h-[3px] rounded-full flex-1 transition-all duration-300 ${
          i < current ? 'bg-black' : 'bg-[#DBDBDB]'
        }`} />
      ))}
    </div>
  );
}

function FormLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[#737373] text-[11px] font-semibold uppercase tracking-wider mb-1.5">{children}</p>;
}

function FormSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-[7px] bg-[#F5F5F5] border border-[#DBDBDB] flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <h2 className="text-black font-bold text-[15px]">{title}</h2>
      </div>
      <div className="bg-[#FAFAFA] border border-[#DBDBDB] rounded-[12px] px-4 py-4 flex flex-col gap-4">
        {children}
      </div>
    </div>
  );
}

const INPUT_CLS = `
  w-full bg-white border border-[#DBDBDB] rounded-[8px] px-3 h-[44px]
  text-black text-[14px] font-medium placeholder:text-[#AAAAAA]
  focus:outline-none focus:border-black transition-colors
`;

const TEXTAREA_CLS = `
  w-full bg-white border border-[#DBDBDB] rounded-[8px] px-3 py-3
  text-black text-[14px] font-medium placeholder:text-[#AAAAAA]
  focus:outline-none focus:border-black transition-colors
  resize-none leading-relaxed
`;

const DEFAULT_COORDS = { lat: 25.7825, lng: -80.1298 };

function LocationAutocomplete({ value, onChange, onPlacePicked, error }: {
  value: string; onChange: (v: string) => void;
  onPlacePicked: (coords: { lat: number; lng: number }) => void; error?: string;
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
      <input ref={inputRef} type="text" defaultValue={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. 1 Hotel South Beach, Miami FL"
        aria-label="Shift location address" aria-invalid={!!error} aria-autocomplete="list"
        className={INPUT_CLS + (error ? ' border-red-400' : '')} />
      {error && <p className="text-red-500 text-[11px] mt-1">{error}</p>}
    </div>
  );
}

export function PostShiftStep3Screen() {
  const [, navigate] = useLocation();
  const initial = getDraft();

  const [location,     setLocation]     = useState(initial.location || '');
  const [mapCoords,    setMapCoords]    = useState({ lat: initial.lat || DEFAULT_COORDS.lat, lng: initial.lng || DEFAULT_COORDS.lng });
  const [unit,         setUnit]         = useState(initial.unit || '');
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
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <div className="px-5 pt-5 pb-4 border-b border-[#DBDBDB]">
        <div className="flex items-center gap-3 mb-4">
          <button type="button" aria-label="Back to schedule" onClick={() => navigate('/post-shift/step2')}
            className="w-9 h-9 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center flex-shrink-0">
            <ChevronLeft size={18} aria-hidden className="text-black" />
          </button>
          <div className="flex-1"><StepBar current={3} total={5} /></div>
          <span className="text-[#737373] text-[12px] font-medium flex-shrink-0">3 of 5</span>
        </div>
        <h1 className="text-black font-bold text-[22px] tracking-tight">Where is it?</h1>
        <p className="text-[#737373] text-[13px] mt-1">Add the venue address and any arrival notes</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-36">
        <FormSection icon={<MapPin size={13} aria-hidden className="text-black" />} title="Venue Address">
          <div>
            <FormLabel>Address or venue name</FormLabel>
            <LocationAutocomplete value={location}
              onChange={(v) => { setLocation(v); setErrors((p) => ({ ...p, location: '' })); }}
              onPlacePicked={(coords) => setMapCoords(coords)}
              error={errors.location} />
          </div>
          <div>
            <FormLabel>Map preview</FormLabel>
            <div className="rounded-[8px] overflow-hidden border border-[#DBDBDB]" style={{ height: 150 }}>
              <Map center={mapCoords} zoom={14} styles={LIGHT_MAP_STYLES} disableDefaultUI
                gestureHandling="none" backgroundColor="#f5f5f5" style={{ width: '100%', height: '100%' }}>
                <Marker position={mapCoords} icon={blackPinUrl(true)} />
              </Map>
            </div>
          </div>
        </FormSection>

        <FormSection icon={<Building2 size={13} aria-hidden className="text-black" />} title="Unit / Floor / Suite">
          <div>
            <FormLabel>Optional — e.g. "Suite 400" or "Rooftop Level"</FormLabel>
            <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)}
              placeholder="Suite, floor, or entrance details…" aria-label="Unit or floor details"
              className={INPUT_CLS} />
          </div>
        </FormSection>

        <FormSection icon={<ParkingCircle size={13} aria-hidden className="text-black" />} title="Parking & Arrival">
          <div>
            <FormLabel>Optional — parking, entrance, or arrival instructions</FormLabel>
            <textarea value={parkingNotes} onChange={(e) => setParkingNotes(e.target.value)}
              placeholder="e.g. 'Use valet on Collins Ave, enter through staff entrance on rear of building…'"
              aria-label="Parking and arrival notes" rows={4} className={TEXTAREA_CLS} />
          </div>
        </FormSection>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] px-5 pb-9 pt-4 bg-gradient-to-t from-white via-white/95 to-transparent z-10 border-t border-[#DBDBDB]">
        <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={handleContinue}
          aria-label="Continue to shift details"
          className="w-full h-[52px] rounded-[8px] bg-black text-white font-bold text-[16px]">
          Continue
        </motion.button>
      </div>
    </div>
  );
}
