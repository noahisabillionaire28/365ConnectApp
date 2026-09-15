import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { ChevronLeft, Check } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

const DAYS: { key: string; label: string }[] = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

type Availability = Record<string, boolean>;

/**
 * Worker availability editor. Sets which days of the week the worker can work
 * (feeds shift matching + lets staffers see availability), plus a master
 * "available for work" switch to pause all new offers.
 */
export function AvailabilityScreen() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [availability, setAvailability] = useState<Availability>(
    Object.fromEntries(DAYS.map((d) => [d.key, false])),
  );
  const [isAvailable, setIsAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    apiClient(user.id).get<{ availability?: unknown; is_available?: boolean }>('/users/me')
      .then((data) => {
        if (data.availability && typeof data.availability === 'object') {
          setAvailability({
            ...Object.fromEntries(DAYS.map((d) => [d.key, false])),
            ...(data.availability as Availability),
          });
        }
        if (typeof data.is_available === 'boolean') setIsAvailable(data.is_available);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  function toggleDay(key: string) {
    setAvailability((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function save() {
    if (!user?.id || saving) return;
    setSaving(true);
    try {
      await apiClient(user.id).patch('/users/me', { availability, is_available: isAvailable });
      showToast('Availability saved.');
      navigate('/profile');
    } catch {
      showToast('Could not save. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  }

  const activeDays = DAYS.filter((d) => availability[d.key]).length;

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <div className="px-4 pt-[52px] pb-4 border-b border-[#DBDBDB] flex items-center gap-3 flex-shrink-0">
        <button type="button" aria-label="Go back"
          onClick={() => { if (window.history.length > 1) window.history.back(); else navigate('/profile'); }}
          className="w-9 h-9 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center flex-shrink-0">
          <ChevronLeft size={18} aria-hidden className="text-black" />
        </button>
        <h1 className="text-black font-bold text-[18px] leading-tight">Availability</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-4">
        {/* Master switch */}
        <div className="flex items-center justify-between bg-[#FAFAFA] border border-[#E5E7EB] rounded-[14px] px-4 py-4 mb-5">
          <div className="min-w-0 pr-3">
            <p className="text-[#111827] font-bold text-[15px]">Available for work</p>
            <p className="text-[#6B7280] text-[12px] mt-0.5">Turn off to pause new shift offers and matches.</p>
          </div>
          <button type="button" role="switch" aria-checked={isAvailable}
            onClick={() => setIsAvailable((v) => !v)}
            className={`w-[52px] h-[30px] rounded-full flex-shrink-0 transition-colors relative ${isAvailable ? 'bg-[#10B981]' : 'bg-[#D1D5DB]'}`}>
            <span className={`absolute top-[3px] w-6 h-6 rounded-full bg-white shadow transition-all ${isAvailable ? 'left-[25px]' : 'left-[3px]'}`} />
          </button>
        </div>

        <p className="text-[#6B7280] text-[11px] font-bold uppercase tracking-[0.16em] mb-2">
          Days you can work {activeDays > 0 && <span className="text-[#9CA3AF] normal-case font-semibold tracking-normal">({activeDays})</span>}
        </p>
        <div className={`flex flex-col gap-2 ${isAvailable ? '' : 'opacity-50 pointer-events-none'}`}>
          {DAYS.map(({ key, label }) => {
            const on = availability[key] ?? false;
            return (
              <button key={key} type="button" onClick={() => toggleDay(key)}
                aria-pressed={on}
                className={`flex items-center justify-between h-[52px] px-4 rounded-[12px] border transition-colors ${
                  on ? 'bg-[#0A1628] border-[#0A1628] text-white' : 'bg-white border-[#E5E7EB] text-[#111827]'
                }`}>
                <span className="font-semibold text-[15px]">{label}</span>
                {on && <Check size={18} aria-hidden />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-[#E5E7EB] px-5 py-4 flex-shrink-0">
        <button type="button" onClick={() => void save()} disabled={saving || loading}
          className="w-full h-[50px] rounded-[10px] bg-[#0A1628] text-white font-bold text-[15px] disabled:opacity-60">
          {saving ? 'Saving…' : 'Save Availability'}
        </button>
      </div>
    </div>
  );
}
