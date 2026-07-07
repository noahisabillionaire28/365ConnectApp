import { Map, Marker } from '@vis.gl/react-google-maps';
import { useState } from 'react';
import { useLocation } from 'wouter';
import { MapPin } from 'lucide-react';
import {
  StepHeader, CTABar, FormSection, FormLabel,
  LocationAutocomplete,
} from '@/components/WizardShared';
import { getStafferDraft, setStafferDraft } from '@/store/stafferPostShiftStore';
import { LIGHT_MAP_STYLES, blackPinUrl } from '@/lib/mapStyles';

const DEFAULT_COORDS = { lat: 25.7825, lng: -80.1298 };

export function StafferPostStep4Screen() {
  const [, navigate] = useLocation();
  const initial = getStafferDraft();

  const [location,  setLocation]  = useState(initial.location || '');
  const [mapCoords, setMapCoords] = useState({
    lat: initial.lat || DEFAULT_COORDS.lat,
    lng: initial.lng || DEFAULT_COORDS.lng,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!location.trim()) e.location = 'Location is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleContinue() {
    if (!validate()) return;
    setStafferDraft({ location, lat: mapCoords.lat, lng: mapCoords.lng });
    navigate('/staffer-shift/step5');
  }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <StepHeader
        current={4} total={7}
        title="Where is it?"
        subtitle="Add the venue address — we'll pin it on the map"
        onBack={() => navigate('/staffer-shift/step3')}
      />

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-36">
        <FormSection icon={<MapPin size={13} aria-hidden className="text-black" />} title="Venue Address">
          <div>
            <FormLabel>Address or venue name <span className="normal-case text-red-500">*</span></FormLabel>
            <LocationAutocomplete
              value={location}
              onChange={(v) => { setLocation(v); setErrors((p) => ({ ...p, location: '' })); }}
              onPlacePicked={(coords) => setMapCoords(coords)}
              error={errors.location}
            />
          </div>
          <div>
            <FormLabel>Map preview</FormLabel>
            <div className="rounded-[8px] overflow-hidden border border-[#DBDBDB]" style={{ height: 160 }}>
              <Map
                center={mapCoords} zoom={14}
                styles={LIGHT_MAP_STYLES} disableDefaultUI
                gestureHandling="none" backgroundColor="#f5f5f5"
                style={{ width: '100%', height: '100%' }}
              >
                <Marker position={mapCoords} icon={blackPinUrl(true)} />
              </Map>
            </div>
          </div>
        </FormSection>
      </div>

      <CTABar label="Continue" onPress={handleContinue} />
    </div>
  );
}
