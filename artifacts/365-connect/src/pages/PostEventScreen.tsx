import { useState } from 'react';
import { useLocation } from 'wouter';
import { ChevronLeft, Plus, Trash2, MapPin } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/contexts/ToastContext';
import { geocodeAddress } from '@/lib/geocode';
import { browserTimeZone } from '@/lib/timezone';
import { buildIso } from '@/store/postShiftStore';
import { JOB_TYPES } from '@/lib/jobTypes';
import { BottomTabNav } from '@/components/BottomTabNav';

type Position = { job_type: string; pay_rate: string; spots: string };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-[#111827] font-semibold text-[13px] mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full h-[46px] rounded-[10px] border border-[#E5E7EB] bg-[#FAFAFA] px-3.5 text-[14px] text-[#111827] outline-none focus:border-[#0A1628]';

/**
 * Multi-position event composer. Shared event details once, then several
 * positions (role + pay + headcount). Each position becomes its own shift
 * grouped under one event.
 */
export function PostEventScreen() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const profile = useProfile();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [eventType, setEventType] = useState('Corporate');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [positions, setPositions] = useState<Position[]>([{ job_type: JOB_TYPES[0], pay_rate: '', spots: '1' }]);
  const [saving, setSaving] = useState(false);

  function updatePos(i: number, patch: Partial<Position>) {
    setPositions((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function addPos() { setPositions((prev) => [...prev, { job_type: JOB_TYPES[0], pay_rate: '', spots: '1' }]); }
  function removePos(i: number) { setPositions((prev) => prev.filter((_, idx) => idx !== i)); }

  const totalWorkers = positions.reduce((n, p) => n + (parseInt(p.spots) || 0), 0);

  async function submit() {
    if (!user?.id || saving) return;
    if (!name.trim()) { showToast('Add an event name.', 'error'); return; }
    if (!location.trim()) { showToast('Add a location.', 'error'); return; }
    if (!date || !startTime || !endTime) { showToast('Add date and times.', 'error'); return; }
    if (positions.some((p) => !p.job_type || !p.pay_rate)) { showToast('Every position needs a role and pay rate.', 'error'); return; }

    setSaving(true);
    try {
      const coords = await geocodeAddress(location.trim());
      // Venue wall-clock → real instants in the poster's zone (an end time at
      // or before the start rolls to the next day).
      const timezone = browserTimeZone();
      const start_time = buildIso(date, startTime, undefined, timezone);
      const end_time = buildIso(date, endTime, startTime, timezone);
      const created = await apiClient(user.id).post<{ event_id: string; positions: Array<{ id: string }> }>('/shifts/event', {
        title: name.trim(),
        location: location.trim(),
        event_type: eventType,
        company_name: profile.displayName ?? null,
        start_time, end_time, timezone,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        special_instructions: notes.trim() || null,
        positions: positions.map((p) => ({
          job_type: p.job_type,
          pay_rate: parseFloat(p.pay_rate) || 0,
          spots: parseInt(p.spots) || 1,
        })),
      });
      showToast('Event posted! Positions are live.');
      // Land the poster on the event they just created, not a generic home.
      const first = created.positions?.[0]?.id;
      navigate(first ? `/shift/${first}` : '/home?tab=my-shifts');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not post event.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col pb-[64px]">
      <div className="px-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-4 border-b border-[#DBDBDB] flex items-center gap-3 flex-shrink-0">
        <button type="button" aria-label="Go back"
          onClick={() => { if (window.history.length > 1) window.history.back(); else navigate('/home'); }}
          className="w-9 h-9 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center flex-shrink-0">
          <ChevronLeft size={18} aria-hidden className="text-black" />
        </button>
        <h1 className="text-black font-bold text-[18px] leading-tight">Post an Event</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-4">
        <Field label="Event name">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="The Mingle & Co Dinner" className={inputCls} />
        </Field>
        <Field label="Location / venue">
          <div className="relative">
            <MapPin size={15} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input value={location} onChange={(e) => setLocation(e.target.value)}
              placeholder="777 S Alameda St, Los Angeles, CA" className={`${inputCls} pl-9`} />
          </div>
        </Field>
        <Field label="Event type">
          <select value={eventType} onChange={(e) => setEventType(e.target.value)} className={inputCls}>
            {['Cocktail Party', 'Wedding', 'Dinner Party', 'Bar Mitzvah', 'Corporate', 'Other'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Start"><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={`${inputCls} min-w-0`} /></Field>
          <Field label="End"><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={`${inputCls} min-w-0`} /></Field>
        </div>

        <div className="flex items-center justify-between mt-2 mb-2">
          <p className="text-[#111827] font-bold text-[15px]">Positions</p>
          <span className="text-[#6B7280] text-[12px] font-semibold">{totalWorkers} worker{totalWorkers === 1 ? '' : 's'} total</span>
        </div>
        <div className="flex flex-col gap-3">
          {positions.map((p, i) => (
            <div key={i} className="border border-[#E5E7EB] rounded-[12px] p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[#6B7280] text-[11px] font-bold uppercase tracking-wide">Position {i + 1}</span>
                {positions.length > 1 && (
                  <button type="button" onClick={() => removePos(i)} aria-label="Remove position" className="text-[#EF4444]">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              <select value={p.job_type} onChange={(e) => updatePos(i, { job_type: e.target.value })} className={`${inputCls} mb-2`}>
                {JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-[14px]">$</span>
                  <input type="number" inputMode="decimal" value={p.pay_rate}
                    onChange={(e) => updatePos(i, { pay_rate: e.target.value })}
                    placeholder="Pay /hr" className={`${inputCls} pl-7`} />
                </div>
                <input type="number" inputMode="numeric" value={p.spots} min={1}
                  onChange={(e) => updatePos(i, { spots: e.target.value })}
                  placeholder="# workers" className={inputCls} />
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addPos}
          className="w-full h-[44px] mt-3 rounded-[10px] border border-dashed border-[#0A1628] text-[#0A1628] font-bold text-[13px] flex items-center justify-center gap-2">
          <Plus size={16} aria-hidden /> Add another position
        </button>

        <Field label="Notes / instructions (optional)">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            placeholder="Dress code, parking, what to expect…"
            className="w-full rounded-[10px] border border-[#E5E7EB] bg-[#FAFAFA] px-3.5 py-2.5 text-[14px] text-[#111827] outline-none focus:border-[#0A1628] resize-none mt-2" />
        </Field>
      </div>

      <div className="border-t border-[#E5E7EB] px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+16px)] flex-shrink-0">
        <button type="button" onClick={() => void submit()} disabled={saving}
          className="w-full h-[50px] rounded-[10px] bg-[#0A1628] text-white font-bold text-[15px] disabled:opacity-60">
          {saving ? 'Posting…' : `Post Event · ${positions.length} position${positions.length === 1 ? '' : 's'}`}
        </button>
      </div>
      <BottomTabNav />
    </div>
  );
}
