/**
 * Shared UI primitives reused across the 5-step client wizard and the
 * 7-step staffer wizard. Import from here — do not duplicate locally.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Check } from 'lucide-react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { JOB_TEMPLATES, type JobTemplate } from '@/data/postShiftTemplates';

/* ── Step progress bar ────────────────────────────────────────────────────── */
export function StepBar({ current, total }: { current: number; total: number }) {
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

/* ── Standard step header with Back button ────────────────────────────────── */
export function StepHeader({
  current, total, title, subtitle, onBack,
}: {
  current: number; total: number;
  title: string; subtitle: string;
  onBack: () => void;
}) {
  return (
    <div className="px-5 pt-5 pb-4 border-b border-[#DBDBDB] bg-white">
      <div className="flex items-center gap-3 mb-4">
        <button type="button" aria-label="Go back" onClick={onBack}
          className="w-9 h-9 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center flex-shrink-0">
          <ChevronLeft size={18} aria-hidden className="text-black" />
        </button>
        <div className="flex-1"><StepBar current={current} total={total} /></div>
        <span className="text-[#737373] text-[12px] font-medium flex-shrink-0">{current} of {total}</span>
      </div>
      <h1 className="text-black font-bold text-[22px] tracking-tight">{title}</h1>
      <p className="text-[#737373] text-[13px] mt-1">{subtitle}</p>
    </div>
  );
}

/* ── Fixed bottom CTA bar ─────────────────────────────────────────────────── */
export function CTABar({
  label = 'Continue', onPress, disabled = false, loading = false,
}: {
  label?: string; onPress: () => void; disabled?: boolean; loading?: boolean;
}) {
  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] px-5 pb-9 pt-4 bg-gradient-to-t from-white via-white/95 to-transparent z-10 border-t border-[#DBDBDB]">
      <motion.button type="button" whileTap={{ scale: disabled ? 1 : 0.97 }}
        onClick={onPress} disabled={disabled || loading}
        aria-label={label} aria-disabled={disabled || loading}
        aria-busy={loading}
        className={`w-full h-[52px] rounded-[8px] font-bold text-[16px] transition-all duration-200 flex items-center justify-center gap-2.5 ${
          loading
            ? 'bg-black/40 text-white/60 cursor-not-allowed'
            : disabled
            ? 'bg-[#EFEFEF] text-[#AAAAAA] cursor-not-allowed border border-[#DBDBDB]'
            : 'bg-black text-white'
        }`}>
        {loading
          ? <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden />Posting…</>
          : label}
      </motion.button>
    </div>
  );
}

/* ── Form section card ────────────────────────────────────────────────────── */
export function FormSection({ icon, title, children }: {
  icon: ReactNode; title: string; children: ReactNode;
}) {
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

/* ── Form label ───────────────────────────────────────────────────────────── */
export function FormLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[#737373] text-[11px] font-semibold uppercase tracking-wider mb-1.5">
      {children}
    </p>
  );
}

/* ── Review row (used on the summary step) ────────────────────────────────── */
export function SectionRow({ icon, label, value, sub }: {
  icon: ReactNode; label: string; value: string; sub?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[#DBDBDB] last:border-0">
      <div className="w-7 h-7 rounded-[8px] bg-[#F5F5F5] border border-[#DBDBDB] flex items-center justify-center flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[#737373] text-[11px] font-semibold uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-black text-[14px] font-medium leading-snug">{value}</p>
        {sub && <p className="text-[#737373] text-[12px] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/* ── Shared input / textarea CSS strings ──────────────────────────────────── */
export const INPUT_CLS =
  'w-full bg-white border border-[#DBDBDB] rounded-[8px] px-3 h-[44px] ' +
  'text-black text-[14px] font-medium placeholder:text-[#AAAAAA] ' +
  'focus:outline-none focus:border-black transition-colors';

export const TEXTAREA_CLS =
  'w-full bg-white border border-[#DBDBDB] rounded-[8px] px-3 py-3 ' +
  'text-black text-[14px] font-medium placeholder:text-[#AAAAAA] ' +
  'focus:outline-none focus:border-black transition-colors resize-none leading-relaxed';

/* ── Job-type tile (multi-select) ─────────────────────────────────────────── */
export function JobTypeTile({
  template, selected, onToggle,
}: { template: JobTemplate; selected: boolean; onToggle: () => void }) {
  const Icon = template.Icon;
  return (
    <motion.button type="button"
      aria-label={`${selected ? 'Deselect' : 'Select'} ${template.label}`}
      aria-pressed={selected} whileTap={{ scale: 0.94 }} onClick={onToggle}
      className={`relative flex flex-col items-center justify-center gap-2.5 rounded-[12px] py-5 px-3
        border-2 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/30
        ${selected ? 'bg-black/5 border-black' : 'bg-white border-[#DBDBDB] active:border-[#AAAAAA]'}`}>
      {selected && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-black flex items-center justify-center">
          <Check size={11} aria-hidden className="text-white" strokeWidth={3} />
        </motion.div>
      )}
      <div className={`w-11 h-11 rounded-[10px] flex items-center justify-center ${
        selected ? 'bg-black/10' : 'bg-[#FAFAFA]'}`}>
        <Icon size={22} aria-hidden className={selected ? 'text-black' : 'text-[#737373]'} />
      </div>
      <span className={`text-[12px] font-semibold text-center leading-tight ${
        selected ? 'text-black' : 'text-[#737373]'}`}>
        {template.label}
      </span>
    </motion.button>
  );
}

/* ── All 14 job-type tiles in a 2-col grid ────────────────────────────────── */
export function JobTypeGrid({
  selectedIds, onToggle,
}: { selectedIds: Set<string>; onToggle: (id: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3" role="group" aria-label="Job type selection — multiple allowed">
      {JOB_TEMPLATES.map((t, i) => (
        <motion.div key={t.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03, duration: 0.24, ease: 'easeOut' }}>
          <JobTypeTile template={t} selected={selectedIds.has(t.id)} onToggle={() => onToggle(t.id)} />
        </motion.div>
      ))}
    </div>
  );
}

/* ── Google Places autocomplete input ─────────────────────────────────────── */
export function LocationAutocomplete({ value, onChange, onPlacePicked, error }: {
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
