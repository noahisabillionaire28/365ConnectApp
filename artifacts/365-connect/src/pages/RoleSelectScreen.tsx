/**
 * RoleSelectScreen — /role-select
 *
 * Three tappable cards. On "Continue" the selected role is persisted to the
 * `users` table for the authenticated user, then the user is sent to the
 * feature walkthrough (/onboarding).
 */
import { useState } from 'react';
import { useLocation } from 'wouter';
import { Briefcase, HardHat, Building2, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/contexts/RoleContext';

type Role = 'worker' | 'client' | 'staffer';

const NAVY   = '#0A1628';
const ACTIVE = '#1E3A5F';
const BORDER = '#E5E7EB';
const TEXT   = '#111827';
const MUTED  = '#6B7280';
const RED    = '#EF4444';

const CARDS: { role: Role; icon: React.ReactNode; title: string; subtitle: string }[] = [
  {
    role:     'worker',
    icon:     <HardHat size={22} />,
    title:    "I'm Working",
    subtitle: 'Browse shifts, get booked, and build your reputation.',
  },
  {
    role:     'client',
    icon:     <Briefcase size={22} />,
    title:    "I'm Hiring",
    subtitle: 'Post shifts and find vetted event staff fast.',
  },
  {
    role:     'staffer',
    icon:     <Building2 size={22} />,
    title:    "I'm a Staffing Agency",
    subtitle: 'Manage your roster and place workers into shifts at scale.',
  },
];

export function RoleSelectScreen() {
  const [, navigate]    = useLocation();
  const { user }        = useAuth();
  const { refetchRole } = useRole();

  const [selected, setSelected] = useState<Role | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleContinue() {
    if (!selected || !user) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient(user.id).post('/users', {
        id: user.id, email: user.email ?? null, role: selected,
        // Seed the Clerk profile picture so the avatar is visible immediately
        photo_url: user.imageUrl ?? null,
      });
      // Sync role into context then go straight to the app
      await refetchRole();
      navigate('/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your role. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col px-6 py-10 bg-white">
      {/* Wordmark */}
      <h2 className="font-extrabold text-[28px] leading-none tracking-[-1px] mb-12" style={{ color: NAVY }}>
        365 CONNECT
      </h2>

      <h1 className="font-bold text-[26px] leading-tight mb-2" style={{ color: TEXT }}>
        How are you joining?
      </h1>
      <p className="text-[14px] mb-10" style={{ color: MUTED }}>
        Choose a role to get started.
      </p>

      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-[12px] px-4 py-3"
          style={{ background: '#FEF2F2', border: `1px solid #FECACA` }}>
          <AlertCircle size={16} style={{ color: RED, flexShrink: 0, marginTop: 1 }} />
          <p className="text-[13px] leading-snug" style={{ color: RED }}>{error}</p>
        </div>
      )}

      {/* Role cards */}
      <div className="flex flex-col gap-4 flex-1">
        {CARDS.map(({ role, icon, title, subtitle }) => {
          const active = selected === role;
          return (
            <button
              key={role}
              onClick={() => setSelected(role)}
              className="flex items-start gap-4 p-5 rounded-[12px] text-left transition-all active:scale-[0.98]"
              style={{
                border:     `2px solid ${active ? NAVY : BORDER}`,
                background: active ? '#F0F4FF' : '#FFFFFF',
              }}
            >
              <div
                className="w-12 h-12 rounded-[12px] flex items-center justify-center flex-shrink-0"
                style={{ background: active ? NAVY : '#F9FAFB', border: active ? 'none' : `1px solid ${BORDER}` }}
              >
                <span style={{ color: active ? '#FFFFFF' : MUTED }}>{icon}</span>
              </div>
              <div>
                <p className="font-bold text-[17px] mb-1" style={{ color: TEXT }}>{title}</p>
                <p className="text-[13px] leading-relaxed" style={{ color: MUTED }}>{subtitle}</p>
              </div>
              {active && (
                <div className="ml-auto flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: NAVY }}>
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.8 7L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={handleContinue}
        disabled={!selected || saving}
        className="w-full text-white font-bold text-[16px] h-[52px] rounded-[12px] mt-10 active:scale-[0.98] transition-transform disabled:opacity-30"
        style={{ background: NAVY }}
        data-testid="btn-role-continue"
      >
        {saving ? 'Saving…' : 'Continue'}
      </button>
    </div>
  );
}
