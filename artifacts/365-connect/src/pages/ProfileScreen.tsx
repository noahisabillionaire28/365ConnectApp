import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
  Star, ChevronRight, Settings,
  CreditCard, Bell, Shield, HelpCircle, LogOut,
  Edit3, MapPin, CheckCircle, UserCircle2,
} from 'lucide-react';
import { BottomTabNav } from '@/components/BottomTabNav';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';

/* ── Sub-components ──────────────────────────────────────────────────────── */
function StarRow({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} aria-hidden
          className={i <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-[#DBDBDB] fill-[#DBDBDB]'} />
      ))}
    </div>
  );
}

function SettingRow({ icon: Icon, label, onTap, danger = false }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string; onTap: () => void; danger?: boolean;
}) {
  return (
    <motion.button type="button" whileTap={{ backgroundColor: '#FAFAFA' }} onClick={onTap}
      aria-label={label}
      className="w-full flex items-center gap-4 px-5 py-4 border-b border-[#DBDBDB] text-left transition-colors last:border-none">
      <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0 ${
        danger ? 'bg-red-50' : 'bg-[#FAFAFA]'
      }`}>
        <Icon size={17} aria-hidden className={danger ? 'text-red-500' : 'text-[#737373]'} />
      </div>
      <span className={`flex-1 text-[15px] font-medium ${danger ? 'text-red-500' : 'text-black'}`}>
        {label}
      </span>
      {!danger && <ChevronRight size={16} aria-hidden className="text-[#DBDBDB]" />}
    </motion.button>
  );
}

/* ── Avatar ──────────────────────────────────────────────────────────────── */
function ProfileAvatar({
  photoUrl, displayName, size = 82,
}: { photoUrl: string | null; displayName: string; size?: number }) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={displayName}
        loading="eager"
        decoding="async"
        className="rounded-full object-cover border-[3px] border-white shadow-sm"
        style={{ width: size, height: size }}
      />
    );
  }
  // Initials fallback when no photo is set
  const initials = displayName
    .split(' ')
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div
      aria-label={displayName}
      className="rounded-full bg-[#F0F0F0] border-[3px] border-white shadow-sm flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {initials ? (
        <span className="font-bold text-[#737373]" style={{ fontSize: size * 0.36 }}>{initials}</span>
      ) : (
        <UserCircle2 size={size * 0.55} className="text-[#AAAAAA]" />
      )}
    </div>
  );
}

/* ── Skeleton ────────────────────────────────────────────────────────────── */
function ProfileSkeleton() {
  return (
    <div className="min-h-[100dvh] bg-white pb-[64px]">
      {/* Cover */}
      <div className="h-[140px] bg-[#F5F5F5] animate-pulse" />
      <div className="px-5 mt-[52px] mb-4 space-y-2">
        <div className="w-40 h-6 rounded-full bg-[#EFEFEF] animate-pulse" />
        <div className="w-24 h-4 rounded-full bg-[#EFEFEF] animate-pulse" />
        <div className="w-full h-4 rounded-full bg-[#EFEFEF] animate-pulse" />
        <div className="w-3/4 h-4 rounded-full bg-[#EFEFEF] animate-pulse" />
      </div>
      <div className="mx-4 grid grid-cols-3 gap-px bg-[#DBDBDB] border border-[#DBDBDB] rounded-[12px] overflow-hidden mb-5">
        {[1,2,3].map((n) => (
          <div key={n} className="flex flex-col items-center py-4 bg-[#FAFAFA]">
            <div className="w-12 h-6 rounded-full bg-[#EFEFEF] animate-pulse mb-1" />
            <div className="w-10 h-3 rounded-full bg-[#EFEFEF] animate-pulse" />
          </div>
        ))}
      </div>
      <BottomTabNav />
    </div>
  );
}

/* ── ProfileScreen ───────────────────────────────────────────────────────── */
export function ProfileScreen() {
  const { signOut }  = useAuth();
  const [, navigate] = useLocation();
  const profile      = useProfile();

  const [available, setAvailable]     = useState(true);
  const [comingSoonLabel, setComingSoon] = useState<string | null>(null);

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  // Unauthenticated guard — redirect to splash rather than rendering a blank profile
  if (!profile.isLoading && !profile.email) {
    navigate('/');
    return null;
  }

  if (profile.isLoading) return <ProfileSkeleton />;

  // Network / RLS error — show retry card
  if (profile.isError) {
    return (
      <div className="min-h-[100dvh] bg-white flex flex-col items-center justify-center px-8 pb-[64px] gap-3 text-center">
        <p className="text-black font-semibold text-[16px]">Couldn't load your profile</p>
        <p className="text-[#737373] text-[13px]">Check your connection and try again.</p>
        <button type="button" onClick={() => window.location.reload()}
          className="mt-2 h-[40px] px-6 rounded-full bg-black text-white text-[13px] font-semibold">
          Retry
        </button>
        <BottomTabNav />
      </div>
    );
  }

  const {
    displayName, username, photoUrl, bio,
    jobTypes, certifications, rating, memberSince,
  } = profile;

  const ratingDisplay  = rating > 0 ? rating.toFixed(1) : '—';
  const ratingSubLabel = rating > 0 ? 'avg rating' : 'no reviews';

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col pb-[64px] overflow-y-auto">

      {/* Coming-soon toast */}
      {comingSoonLabel && (
        <div role="status" aria-live="polite"
          className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] bg-white border border-[#DBDBDB] rounded-[12px] px-4 py-3 flex items-center gap-3 shadow-lg max-w-[340px] w-[90%]">
          <span className="text-black text-[13px] font-medium flex-1">{comingSoonLabel} — coming soon</span>
          <button type="button" aria-label="Dismiss" onClick={() => setComingSoon(null)}
            className="text-[#737373] text-[18px] leading-none">×</button>
        </div>
      )}

      {/* Cover */}
      <div className="relative">
        <div aria-hidden className="h-[140px] w-full bg-[#F5F5F5]" />
        <div aria-hidden className="absolute top-0 left-0 right-0 h-[1px] bg-[#DBDBDB]" />

        {/* Edit button */}
        <button type="button" aria-label="Edit profile" onClick={() => navigate('/profile-setup')}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white border border-[#DBDBDB] flex items-center justify-center">
          <Edit3 size={15} aria-hidden className="text-black" />
        </button>

        {/* Avatar */}
        <div className="absolute left-5 -bottom-[42px]">
          <ProfileAvatar photoUrl={photoUrl} displayName={displayName} size={82} />
        </div>

        {/* Available toggle */}
        <div className="flex justify-end px-5 pt-3">
          <button type="button" aria-pressed={available}
            aria-label={available ? 'Set yourself as unavailable' : 'Set yourself as available'}
            onClick={() => setAvailable((v) => !v)}
            className={`flex items-center gap-1.5 h-[28px] px-3 rounded-full text-[11px] font-bold border transition-all ${
              available ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-[#FAFAFA] border-[#DBDBDB] text-[#737373]'
            }`}>
            <span aria-hidden className={`w-[6px] h-[6px] rounded-full ${available ? 'bg-emerald-500' : 'bg-[#DBDBDB]'}`} />
            {available ? 'Available' : 'Unavailable'}
          </button>
        </div>
      </div>

      {/* Name / meta */}
      <div className="px-5 mt-[52px] mb-4">
        <h1 className="text-black font-bold text-[22px] tracking-tight mb-0.5">{displayName}</h1>

        <p className="text-[#737373] text-[13px] mb-2">
          {username ? `@${username}` : <span className="italic text-[#AAAAAA]">No username set</span>}
        </p>

        {bio ? (
          <p className="text-[#737373] text-[14px] leading-relaxed mb-3">{bio}</p>
        ) : (
          <p className="text-[#AAAAAA] text-[14px] italic mb-3">No bio yet — tap Edit to add one</p>
        )}

        {memberSince && (
          <div className="flex items-center gap-1.5 text-[#737373] text-[12px]">
            <MapPin size={12} aria-hidden />
            <span>Member since {memberSince}</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="mx-4 grid grid-cols-3 bg-[#FAFAFA] border border-[#DBDBDB] rounded-[12px] mb-5 overflow-hidden"
        role="list" aria-label="Profile statistics">
        {[
          { label: 'Shifts',  value: '0',           sub: 'completed'   },
          { label: 'Rating',  value: `${ratingDisplay}★`, sub: ratingSubLabel },
          { label: 'Earned',  value: '$0',           sub: 'lifetime'    },
        ].map(({ label, value, sub }, i) => (
          <div key={label} role="listitem" aria-label={`${label}: ${value}`}
            className={`flex flex-col items-center justify-center py-4 ${i < 2 ? 'border-r border-[#DBDBDB]' : ''}`}>
            <p className="text-black font-bold text-[22px] leading-tight">{value}</p>
            <p className="text-[#737373] text-[10px] font-semibold uppercase tracking-wide mt-0.5">{label}</p>
            <p className="text-[#AAAAAA] text-[10px] mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Specialties */}
      <div className="px-5 mb-5">
        <p className="text-[#737373] text-[11px] font-bold uppercase tracking-[0.18em] mb-2.5" id="job-types-label">
          Specialties
        </p>
        {jobTypes.length > 0 ? (
          <div className="flex flex-wrap gap-2" role="list" aria-labelledby="job-types-label">
            {jobTypes.map((jt) => (
              <span key={jt} role="listitem"
                className="h-[30px] px-3 bg-[#FAFAFA] border border-[#DBDBDB] rounded-full text-[#737373] text-[12px] font-medium flex items-center">
                {jt}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[#AAAAAA] text-[13px] italic">
            No specialties added yet — tap Edit to set them.
          </p>
        )}
      </div>

      {/* Certifications */}
      <div className="px-5 mb-6">
        <p className="text-[#737373] text-[11px] font-bold uppercase tracking-[0.18em] mb-2.5" id="certs-label">
          Certifications
        </p>
        {certifications.length > 0 ? (
          <div className="flex flex-col gap-2" role="list" aria-labelledby="certs-label">
            {certifications.map((cert) => (
              <div key={cert} role="listitem" className="flex items-center gap-2.5">
                <CheckCircle size={13} aria-hidden className="text-emerald-500 flex-shrink-0" />
                <span className="text-[#737373] text-[13px]">{cert}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[#AAAAAA] text-[13px] italic">
            No certifications added yet — tap Edit to add them.
          </p>
        )}
      </div>

      {/* Reviews */}
      <div className="px-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[#737373] text-[11px] font-bold uppercase tracking-[0.18em]">Reviews</p>
          {rating > 0 && (
            <div className="flex items-center gap-1.5">
              <StarRow rating={rating} size={12} />
              <span className="text-black font-bold text-[13px]">{rating.toFixed(1)}</span>
            </div>
          )}
        </div>
        <div className="bg-[#FAFAFA] border border-[#DBDBDB] rounded-[12px] p-4 flex flex-col items-center gap-1 text-center">
          <Star size={22} aria-hidden className="text-[#DBDBDB] mb-1" />
          <p className="text-[#737373] text-[13px] font-medium">No reviews yet</p>
          <p className="text-[#AAAAAA] text-[12px]">Reviews from clients will appear here after your first shift.</p>
        </div>
      </div>

      {/* Settings */}
      <div className="px-4 mb-4">
        <p className="text-[#737373] text-[11px] font-bold uppercase tracking-[0.18em] px-1 mb-3">Account</p>
        <div className="bg-white border border-[#DBDBDB] rounded-[12px] overflow-hidden">
          <SettingRow icon={Settings}    label="Account Settings"    onTap={() => setComingSoon('Account Settings')} />
          <SettingRow icon={CreditCard}  label="Payments & Earnings"  onTap={() => setComingSoon('Payments & Earnings')} />
          <SettingRow icon={Bell}        label="Notifications"         onTap={() => navigate('/notifications')} />
          <SettingRow icon={Shield}      label="Privacy & Safety"      onTap={() => setComingSoon('Privacy & Safety')} />
          <SettingRow icon={HelpCircle}  label="Help & Support"        onTap={() => setComingSoon('Help & Support')} />
        </div>
      </div>

      <div className="px-4 mb-6">
        <div className="bg-white border border-[#DBDBDB] rounded-[12px] overflow-hidden">
          <SettingRow icon={LogOut} label="Log Out" onTap={handleSignOut} danger />
        </div>
      </div>

      <BottomTabNav />
    </div>
  );
}
