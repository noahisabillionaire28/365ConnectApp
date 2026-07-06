import { Map, Marker, useMapsLibrary } from '@vis.gl/react-google-maps';
import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
  ChevronLeft, Calendar, Clock, MapPin, DollarSign,
  Users, Shirt, FileText, User, Phone, Plus, Minus,
} from 'lucide-react';
import { getDraft, setDraft } from '@/store/postShiftStore';
import { DARK_MAP_STYLES, goldPinUrl } from '@/lib/mapStyles';

/* ─── Step indicator ─────────────────────────────────────────────────────── */
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

/* ─── Form field components ──────────────────────────────────────────────── */
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

/* ─── Miami Beach default coords ─────────────────────────────────────────── */
const DEFAULT_COORDS = { lat: 25.7825, lng: -80.1298 };

/* ─── Places Autocomplete input ──────────────────────────────────────────── */
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

  // Attach Google Places Autocomplete once library is loaded
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

      // Compose display string: "Venue Name, Full Address"
      const display = place.name && place.formatted_address
        ? `${place.name}, ${place.formatted_address}`
        : place.formatted_address ?? place.name ?? '';
      onChange(display);

      // Update map pin if geometry is available
      if (place.geometry?.location) {
        onPlacePicked({
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        });
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
        aria-label="Shift location"
        aria-invalid={!!error}
        aria-autocomplete="list"
        className={INPUT_CLS + (error ? ' border-red-500/60' : '')}
      />
      {error && <p className="text-red-400 text-[11px] mt-1">{error}</p>}
    </div>
  );
}

/* ─── PostShiftStep2Screen ───────────────────────────────────────────────── */
export function PostShiftStep2Screen() {
  const [, navigate] = useLocation();
  const initial = getDraft();

  const [date,           setDate]           = useState(initial.date);
  const [startTime,      setStartTime]      = useState(initial.startTime || '18:00');
  const [endTime,        setEndTime]        = useState(initial.endTime   || '23:00');
  const [location,       setLocation]       = useState(initial.location  || 'Miami Beach, FL');
  const [mapCoords,      setMapCoords]      = useState(DEFAULT_COORDS);
  // String state avoids browser number-input leading-zero bug ("050" instead of "50")
  const [payRateStr,     setPayRateStr]     = useState(String(initial.payRate ?? 35));
  const [workersNeeded,  setWorkersNeeded]  = useState(initial.workersNeeded || 1);
  const [dressCode,      setDressCode]      = useState(initial.dressCode);
  const [description,    setDescription]    = useState(initial.description);
  const [contactName,    setContactName]    = useState(initial.contactName);
  const [contactPhone,   setContactPhone]   = useState(initial.contactPhone);
  const [errors,         setErrors]         = useState<Record<string, string>>({});

  // Pre-fill today's date if empty
  useEffect(() => {
    if (!date) {
      const today = new Date().toISOString().split('T')[0];
      setDate(today);
    }
  }, []);

  function validate() {
    const e: Record<string, string> = {};
    if (!date)            e.date        = 'Date is required';
    if (!location.trim()) e.location    = 'Location is required';
    const payNum = Number(payRateStr);
    if (!payRateStr || isNaN(payNum) || payNum < 1)   e.payRate = 'Enter a valid pay rate';
    else if (payNum > 500)                            e.payRate = 'Pay rate cannot exceed $500/hr';
    if (!contactName.trim()) e.contactName = 'Contact name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handlePost() {
    if (!validate()) return;
    setDraft({ date, startTime, endTime, location, payRate: Number(payRateStr), workersNeeded, dressCode, description, contactName, contactPhone });
    navigate('/post-shift/step3');
  }

  return (
    <div className="min-h-[100dvh] bg-black flex flex-col">

      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-[#111]">
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            aria-label="Back to template picker"
            onClick={() => navigate('/post-shift/step1')}
            className="w-9 h-9 rounded-full bg-[#111] border border-[#222] flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft size={18} aria-hidden className="text-[#888]" />
          </button>
          <div className="flex-1"><StepBar current={2} total={3} /></div>
          <span className="text-[#555] text-[12px] font-medium flex-shrink-0">2 of 3</span>
        </div>
        <h1 className="text-white font-bold text-[22px] tracking-tight">Shift Details</h1>
        <p className="text-[#555] text-[13px] mt-1">
          Pre-filled from <span className="text-primary font-semibold">{initial.jobType}</span> template — edit as needed
        </p>
      </div>

      {/* Scrollable form */}
      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-36">

        {/* Date & Time */}
        <FormSection icon={<Calendar size={13} aria-hidden className="text-primary" />} title="Date & Time">
          <div>
            <FormLabel>Date</FormLabel>
            <input
              type="date"
              value={date}
              onChange={(e) => { setDate(e.target.value); setErrors((p) => ({ ...p, date: '' })); }}
              aria-label="Shift date"
              aria-invalid={!!errors.date}
              className={INPUT_CLS + (errors.date ? ' border-red-500/60' : '')}
              style={{ colorScheme: 'dark' }}
            />
            {errors.date && <p className="text-red-400 text-[11px] mt-1">{errors.date}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FormLabel>Start time</FormLabel>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                aria-label="Shift start time"
                className={INPUT_CLS}
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <div>
              <FormLabel>End time</FormLabel>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                aria-label="Shift end time"
                className={INPUT_CLS}
                style={{ colorScheme: 'dark' }}
              />
            </div>
          </div>
        </FormSection>

        {/* Location */}
        <FormSection icon={<MapPin size={13} aria-hidden className="text-primary" />} title="Location">
          <div>
            <FormLabel>Address or venue name</FormLabel>
            <LocationAutocomplete
              value={location}
              onChange={(v) => { setLocation(v); setErrors((p) => ({ ...p, location: '' })); }}
              onPlacePicked={setMapCoords}
              error={errors.location}
            />
          </div>
          {/* Live map preview — updates when a place is selected */}
          <div>
            <FormLabel>Map preview</FormLabel>
            <div className="rounded-[12px] overflow-hidden border border-[#252525]" style={{ height: 140 }}>
              <Map
                center={mapCoords}
                zoom={14}
                styles={DARK_MAP_STYLES}
                disableDefaultUI
                gestureHandling="none"
                backgroundColor="#000000"
                style={{ width: '100%', height: '100%' }}
              >
                <Marker
                  position={mapCoords}
                  icon={goldPinUrl(false)}
                />
              </Map>
            </div>
          </div>
        </FormSection>

        {/* Pay & Workers */}
        <FormSection icon={<DollarSign size={13} aria-hidden className="text-primary" />} title="Compensation & Headcount">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FormLabel>Pay rate ($/hr)</FormLabel>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-bold text-[15px]">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={payRateStr}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^0-9]/g, '');
                    const clean  = digits.replace(/^0+(\d)/, '$1');
                    setPayRateStr(clean);
                    setErrors((p) => ({ ...p, payRate: '' }));
                  }}
                  placeholder="35"
                  aria-label="Pay rate per hour"
                  aria-invalid={!!errors.payRate}
                  className={INPUT_CLS + ' pl-7' + (errors.payRate ? ' border-red-500/60' : '')}
                />
              </div>
              {errors.payRate && <p className="text-red-400 text-[11px] mt-1">{errors.payRate}</p>}
            </div>
            <div>
              <FormLabel>Workers needed</FormLabel>
              <div className="flex items-center gap-2 h-[44px]">
                <button
                  type="button"
                  aria-label="Decrease workers needed"
                  onClick={() => setWorkersNeeded((n) => Math.max(1, n - 1))}
                  className="w-9 h-9 rounded-[9px] bg-[#141414] border border-[#252525] flex items-center justify-center flex-shrink-0 active:border-primary/40"
                >
                  <Minus size={14} aria-hidden className="text-[#888]" />
                </button>
                <span className="flex-1 text-center text-white font-bold text-[18px]">{workersNeeded}</span>
                <button
                  type="button"
                  aria-label="Increase workers needed"
                  onClick={() => setWorkersNeeded((n) => Math.min(50, n + 1))}
                  className="w-9 h-9 rounded-[9px] bg-[#141414] border border-[#252525] flex items-center justify-center flex-shrink-0 active:border-primary/40"
                >
                  <Plus size={14} aria-hidden className="text-primary" />
                </button>
              </div>
            </div>
          </div>
        </FormSection>

        {/* Dress code */}
        <FormSection icon={<Shirt size={13} aria-hidden className="text-primary" />} title="Dress Code">
          <div>
            <FormLabel>Dress code requirements</FormLabel>
            <textarea
              value={dressCode}
              onChange={(e) => setDressCode(e.target.value)}
              placeholder="Describe attire requirements…"
              aria-label="Dress code"
              rows={3}
              className={TEXTAREA_CLS}
            />
          </div>
        </FormSection>

        {/* Description */}
        <FormSection icon={<FileText size={13} aria-hidden className="text-primary" />} title="Shift Description">
          <div>
            <FormLabel>Tell workers about this shift</FormLabel>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the event, expectations, and any special requirements…"
              aria-label="Shift description"
              rows={5}
              className={TEXTAREA_CLS}
            />
          </div>
        </FormSection>

        {/* Point of contact */}
        <FormSection icon={<User size={13} aria-hidden className="text-primary" />} title="Point of Contact">
          <div>
            <FormLabel>Full name</FormLabel>
            <input
              type="text"
              value={contactName}
              onChange={(e) => { setContactName(e.target.value); setErrors((p) => ({ ...p, contactName: '' })); }}
              placeholder="e.g. Samantha Cruz"
              aria-label="Contact name"
              aria-invalid={!!errors.contactName}
              className={INPUT_CLS + (errors.contactName ? ' border-red-500/60' : '')}
            />
            {errors.contactName && <p className="text-red-400 text-[11px] mt-1">{errors.contactName}</p>}
          </div>
          <div>
            <FormLabel>Phone number</FormLabel>
            <div className="relative">
              <Phone size={14} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" />
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="(305) 555-0100"
                aria-label="Contact phone number"
                className={INPUT_CLS + ' pl-9'}
              />
            </div>
          </div>
        </FormSection>
      </div>

      {/* Fixed CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] px-5 pb-9 pt-4 bg-gradient-to-t from-black via-black/95 to-transparent z-10">
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={handlePost}
          aria-label="Post shift and preview matches"
          className="w-full h-[54px] rounded-[14px] bg-primary text-black font-bold text-[16px] tracking-wide"
        >
          Post Shift &amp; Preview Matches →
        </motion.button>
      </div>
    </div>
  );
}
