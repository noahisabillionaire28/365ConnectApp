/**
 * Notification preferences — per-user on/off for in-app and email delivery.
 * Reads/writes the users.in_app_notifications / users.email_notifications columns
 * via PATCH /api/users/me. The in-app toggle is enforced app-wide by a DB gate
 * trigger; email delivery itself is added later (the switch is stored now).
 */
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { ChevronLeft, Bell, Mail } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { BottomTabNav } from '@/components/BottomTabNav';

type Prefs = { in_app_notifications: boolean; email_notifications: boolean };

function Toggle({ on, onClick, disabled, label }: {
  on: boolean; onClick: () => void; disabled?: boolean; label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center w-[50px] h-[30px] rounded-full p-[3px] flex-shrink-0 transition-colors duration-200 disabled:opacity-60 ${
        on ? 'bg-[#0A1628]' : 'bg-[#D1D5DB]'
      }`}
    >
      <span
        className={`inline-block w-[24px] h-[24px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.3)] transition-transform duration-200 ${
          on ? 'translate-x-[20px]' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function Row({ icon, title, subtitle, on, onToggle, saving, divider }: {
  icon: (on: boolean) => React.ReactNode; title: string; subtitle: string;
  on: boolean; onToggle: () => void; saving: boolean; divider?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3.5 px-4 py-4 ${divider ? 'border-t border-[#F0F1F3]' : ''}`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
        on ? 'bg-[#0A1628]' : 'bg-[#F3F4F6]'
      }`}>
        {icon(on)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[#111827] font-bold text-[15px] leading-tight">{title}</p>
        <p className="text-[#6B7280] text-[12px] leading-snug mt-1">{subtitle}</p>
      </div>
      <Toggle on={on} onClick={onToggle} disabled={saving} label={`Toggle ${title}`} />
    </div>
  );
}

export function NotificationSettingsScreen() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [prefs, setPrefs]     = useState<Prefs | null>(null);
  const [saving, setSaving]   = useState(false);
  const [loadErr, setLoadErr] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!user?.id) return;
    apiClient(user.id).get<Prefs>('/users/me')
      .then((me) => { if (alive) setPrefs({
        in_app_notifications: me.in_app_notifications ?? true,
        email_notifications:  me.email_notifications  ?? true,
      }); })
      .catch(() => { if (alive) setLoadErr(true); });
    return () => { alive = false; };
  }, [user?.id]);

  async function update(patch: Partial<Prefs>) {
    if (!user?.id || !prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);           // optimistic
    setSaving(true);
    try {
      await apiClient(user.id).patch('/users/me', patch);
    } catch {
      setPrefs(prefs);        // revert on failure
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[#F7F8FA] flex flex-col pb-[72px]">
      {/* Header */}
      <div className="bg-white px-4 pt-[52px] pb-4 border-b border-[#E5E7EB] sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Back"
            onClick={() => navigate('/notifications')}
            className="w-9 h-9 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center flex-shrink-0">
            <ChevronLeft size={18} aria-hidden className="text-[#111827]" />
          </button>
          <h1 className="text-[#111827] font-bold text-[20px] tracking-tight">Notification Settings</h1>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 pt-5">
        {loadErr && (
          <p className="text-[#EF4444] text-[13px] text-center py-8">
            Couldn't load your settings. Check your connection and try again.
          </p>
        )}

        {!loadErr && !prefs && (
          <div className="h-[152px] bg-white border border-[#EDEEF0] rounded-[18px] animate-pulse" />
        )}

        {prefs && (
          <>
            <p className="text-[#9CA3AF] text-[11px] font-bold uppercase tracking-[0.12em] px-1 mb-2">
              Choose how you hear from us
            </p>
            <div className="bg-white border border-[#EDEEF0] rounded-[18px] shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden">
              <Row
                icon={(on) => <Bell size={17} aria-hidden className={on ? 'text-white' : 'text-[#0A1628]'} />}
                title="In-app notifications"
                subtitle="Bookings, requests, removals and updates inside the app."
                on={prefs.in_app_notifications}
                onToggle={() => update({ in_app_notifications: !prefs.in_app_notifications })}
                saving={saving}
              />
              <Row
                divider
                icon={(on) => <Mail size={17} aria-hidden className={on ? 'text-white' : 'text-[#0A1628]'} />}
                title="Email notifications"
                subtitle="Get the same alerts by email. (Email delivery is coming soon.)"
                on={prefs.email_notifications}
                onToggle={() => update({ email_notifications: !prefs.email_notifications })}
                saving={saving}
              />
            </div>
            <p className="text-[#9CA3AF] text-[12px] leading-relaxed px-1 mt-3">
              Turning a channel off stops new alerts on that channel. You can turn it
              back on anytime.
            </p>
          </>
        )}
      </div>

      <BottomTabNav />
    </div>
  );
}
