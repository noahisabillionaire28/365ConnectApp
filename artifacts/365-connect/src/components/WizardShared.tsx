/**
 * Shared UI primitives reused across the 5-step client wizard and the
 * 7-step staffer wizard. Import from here — do not duplicate locally.
 */
import { useState, useRef, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Check } from 'lucide-react';
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

/* ── Address autocomplete (free OpenStreetMap / Nominatim type-ahead) ──────── */
type NomSuggestion = { display_name: string; lat: string; lon: string };

export function LocationAutocomplete({ value, onChange, onPlacePicked, error }: {
  value: string; onChange: (v: string) => void;
  onPlacePicked: (coords: { lat: number; lng: number }) => void; error?: string;
}) {
  const [suggestions, setSuggestions] = useState<NomSuggestion[]>([]);
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
        const data = (await res.json()) as NomSuggestion[];
        setSuggestions(Array.isArray(data) ? data : []);
        setOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 450);
  }

  function pick(s: NomSuggestion) {
    const lat = parseFloat(s.lat);
    const lng = parseFloat(s.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) onPlacePicked({ lat, lng });
    onChange(s.display_name);
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input type="text" value={value}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => { if (suggestions.length) setOpen(true); }}
        placeholder="Start typing an address or venue…"
        aria-label="Shift location address" aria-invalid={!!error} aria-autocomplete="list"
        autoComplete="off"
        className={INPUT_CLS + (error ? ' border-red-400' : '')} />
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
      {loading && <p className="text-[#9CA3AF] text-[11px] mt-1">Searching…</p>}
      {error && <p className="text-red-500 text-[11px] mt-1">{error}</p>}
    </div>
  );
}
