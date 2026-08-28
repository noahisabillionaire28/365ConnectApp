/**
 * Step 2 of 5 — Location
 * Address autocomplete + Apple-light map preview + optional unit/suite.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { ChevronLeft, MapPin, Building2 } from 'lucide-react';
import { getDraft, setDraft } from '@/store/postShiftStore';
import { LeafletMap } from '@/components/LeafletMap';
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

/**
 * Turn a typed address into real map coordinates (free OpenStreetMap / Nominatim).
 * Used so the shift maps to the VENUE the staffer typed — not their own location —
 * even when they never tap a dropdown suggestion. Returns null on no-match/failure.
 */
async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=' +
        encodeURIComponent(query),
      { headers: { Accept: 'application/json' } },
    );
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    const hit = Array.isArray(data) ? data[0] : undefined;
    if (hit) {
      const lat = parseFloat(hit.lat);
      const lng = parseFloat(hit.lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
  } catch { /* network / geocode failure — caller falls back */ }
  return null;
}

// ─── Address autocomplete (free OpenStreetMap / Nominatim type-ahead) ─────────
type Suggestion = { display_name: string; lat: string; lon: string };

function LocationAutocomplete({
  value, onChange, onPlacePicked, error,
}: {
  value: string;
  onChange: (v: string) => void;
  onPlacePicked: (coords: { lat: number; lng: number }, address: string) => void;
  error?: string;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen]     = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleInput(v: string) {
    onChange(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 3) { setSuggestions([]); setOpen(false); setLoading(false); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          'https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=us&q=' +
            encodeURIComponent(v),
          { headers: { Accept: 'application/json' } },
        );
        const data = (await res.json()) as Suggestion[];
        setSuggestions(Array.isArray(data) ? data : []);
        setOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 450);
  }

  function pick(s: Suggestion) {
    const lat = parseFloat(s.lat);
    const lng = parseFloat(s.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      onPlacePicked({ lat, lng }, s.display_name);
    }
    onChange(s.display_name);
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => { if (suggestions.length) setOpen(true); }}
        placeholder="Start typing an address or venue…"
        aria-label="Venue address or name"
        aria-invalid={!!error}
        autoComplete="off"
        className={INPUT_CLS + (error ? ' border-[#EF4444]' : '')}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-[#E5E7EB] rounded-[10px] shadow-lg max-h-[220px] overflow-y-auto">
          {suggestions.map((s, i) => (
            <button key={i} type="button" onClick={() => pick(s)}
              className="w-full text-left px-3 py-2.5 text-[13px] leading-snug text-[#111827] active:bg-[#F5F5F5] border-b border-[#F3F4F6] last:border-0">
              {s.display_name}
            </button>
          ))}
        </div>
      )}
      {loading && <p className="text-[#9CA3AF] text-[11px] mt-1.5">Searching…</p>}
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
  const [geoLoading, setGeoLoading] = useState(false);

  // The exact address string that `mapCoords` currently represents. Starts as the
  // draft's saved location so an unchanged (e.g. edited) shift keeps its coords.
  const [resolvedFor, setResolvedFor] = useState(initial.location);

  const handlePlacePicked = useCallback(
    (coords: { lat: number; lng: number }, address: string) => {
      setMapCoords(coords);
      setLocation(address);
      setResolvedFor(address);
      setErrors((p) => ({ ...p, location: '' }));
    },
    [],
  );

  // Live-geocode the typed address so the map preview shows the VENUE, not the
  // staffer's own location — even when they never tap a suggestion. Debounced and
  // guarded so only the latest lookup wins.
  const geoReq = useRef(0);
  useEffect(() => {
    const q = location.trim();
    if (!q || q === resolvedFor.trim() || q.length < 5) return;
    const id = ++geoReq.current;
    const t = setTimeout(async () => {
      const g = await geocode(q);
      if (g && id === geoReq.current) { setMapCoords(g); setResolvedFor(q); }
    }, 700);
    return () => clearTimeout(t);
  }, [location, resolvedFor]);

  function validate() {
    const e: Record<string, string> = {};
    if (!location.trim()) e.location = 'Please enter a venue address';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleContinue() {
    if (!validate()) return;
    let coords = mapCoords;
    const q = location.trim();
    // Safety net: if the typed address hasn't been resolved to coords yet
    // (user typed fast and hit Continue before the live lookup ran), geocode now.
    if (q && q !== resolvedFor.trim()) {
      setGeoLoading(true);
      const g = await geocode(q);
      setGeoLoading(false);
      if (g) { coords = g; setMapCoords(g); setResolvedFor(q); }
    }
    setDraft({
      location: q,
      lat:      coords.lat,
      lng:      coords.lng,
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
          <div className="flex-1"><StepBar current={3} total={6} /></div>
          <span className="text-[#6B7280] text-[12px] font-semibold flex-shrink-0">3 of 6</span>
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
                <LeafletMap
                  center={displayCoords}
                  zoom={15}
                  interactive={false}
                  recenter
                  ariaLabel="Selected location preview"
                  markers={[{ id: 'picked', lat: displayCoords.lat, lng: displayCoords.lng, selected: true }]}
                />
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
          disabled={geoLoading}
          aria-busy={geoLoading}
          aria-label="Continue to schedule"
          className="w-full h-[52px] rounded-[12px] bg-[#0A1628] text-white font-bold text-[16px] disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {geoLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Locating…
            </>
          ) : 'Continue'}
        </motion.button>
      </div>

      <BottomTabNav />
    </div>
  );
}
