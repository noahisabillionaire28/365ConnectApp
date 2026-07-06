import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
  Star, ChevronRight, Settings,
  CreditCard, Bell, Shield, HelpCircle, LogOut,
  Edit3, MapPin, CheckCircle, Award,
} from 'lucide-react';
import { BottomTabNav } from '@/components/BottomTabNav';
import { useAuth } from '@/contexts/AuthContext';

const DEMO_PROFILE = {
  displayName: 'Marcus Brown',
  username:    'marcus_b',
  bio:         'Premium bartender & VIP host. 5 years Miami nightlife. Always professional, always on time. 🌴',
  photoUrl:    'https://i.pravatar.cc/150?img=12',
  location:    'Miami Beach, FL',
  memberSince: 'Jan 2026',
  shiftsCompleted: 47,
  rating:          4.9,
  reviewCount:     8,
  earnings:        '$5,840',
  isAvailable:     true,
  isPremium:       true,
  jobTypes:        ['Bartender', 'VIP Host', 'Event Staff', 'Barback'],
  certifications:  ['TIPS Certified', 'ServSafe', 'First Aid/CPR'],
};

const UPCOMING_SHIFT = {
  jobType:     'Head Bartender',
  company:     'LIV Nightclub',
  date:        'Sat, Jul 5 · 9 PM – 2 AM',
  payRate:     32,
  coverImage:  'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=600&q=80',
};

const RECENT_REVIEWS = [
  {
    id: 'r1', rating: 5,
    text: 'Marcus was exceptional — arrived early, knew the full menu cold, and every client loved him. Absolutely rebooked.',
    reviewer: 'James W.', venue: 'The Rooftop Bar', date: '3 days ago',
    photoUrl: 'https://i.pravatar.cc/150?img=68',
  },
  {
    id: 'r2', rating: 5,
    text: "Best bartender we've had at the hotel in years. Seamless service during a 400-person event. 5 stars no question.",
    reviewer: 'Amara D.', venue: 'Fontainebleau Hotel', date: '1 week ago',
    photoUrl: 'https://i.pravatar.cc/150?img=36',
  },
];

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

export function ProfileScreen() {
  const { signOut } = useAuth();
  const [, navigate]  = useLocation();
  const [available, setAvailable] = useState(DEMO_PROFILE.isAvailable);
  const [comingSoonLabel, setComingSoon] = useState<string | null>(null);
  const p = DEMO_PROFILE;

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

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
          {p.isPremium ? (
            <div className="p-[3px] rounded-full bg-gradient-to-br from-[#0095F6] via-[#00B4FF] to-[#0095F6]">
              <div className="p-[3px] rounded-full bg-white">
                <img src={p.photoUrl} alt={p.displayName} loading="eager" decoding="async"
                  className="w-[82px] h-[82px] rounded-full object-cover" />
              </div>
            </div>
          ) : (
            <img src={p.photoUrl} alt={p.displayName} loading="eager" decoding="async"
              className="w-[82px] h-[82px] rounded-full object-cover border-[3px] border-white shadow-sm" />
          )}
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
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-black font-bold text-[22px] tracking-tight">{p.displayName}</h1>
          {p.isPremium && (
            <span aria-label="Premium member"
              className="flex items-center gap-1 bg-black/5 border border-black/10 rounded-full px-2 py-0.5">
              <Award size={10} aria-hidden className="text-black" />
              <span className="text-black text-[9px] font-bold uppercase tracking-wide">Pro</span>
            </span>
          )}
        </div>
        <p className="text-[#737373] text-[13px] mb-2">@{p.username}</p>
        <p className="text-[#737373] text-[14px] leading-relaxed mb-3">{p.bio}</p>
        <div className="flex items-center gap-1.5 text-[#737373] text-[12px]">
          <MapPin size={12} aria-hidden />
          <span>{p.location}</span>
          <span className="text-[#DBDBDB]">·</span>
          <span>Member since {p.memberSince}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="mx-4 grid grid-cols-3 bg-[#FAFAFA] border border-[#DBDBDB] rounded-[12px] mb-5 overflow-hidden"
        role="list" aria-label="Profile statistics">
        {[
          { label: 'Shifts', value: String(p.shiftsCompleted), sub: 'completed' },
          { label: 'Rating',  value: p.rating.toFixed(1) + '★', sub: `${p.reviewCount} reviews` },
          { label: 'Earned',  value: p.earnings, sub: 'lifetime' },
        ].map(({ label, value, sub }, i) => (
          <div key={label} role="listitem" aria-label={`${label}: ${value}`}
            className={`flex flex-col items-center justify-center py-4 ${i < 2 ? 'border-r border-[#DBDBDB]' : ''}`}>
            <p className="text-black font-bold text-[22px] leading-tight">{value}</p>
            <p className="text-[#737373] text-[10px] font-semibold uppercase tracking-wide mt-0.5">{label}</p>
            <p className="text-[#AAAAAA] text-[10px] mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Job types */}
      <div className="px-5 mb-5">
        <p className="text-[#737373] text-[11px] font-bold uppercase tracking-[0.18em] mb-2.5" id="job-types-label">
          Specialties
        </p>
        <div className="flex flex-wrap gap-2" role="list" aria-labelledby="job-types-label">
          {p.jobTypes.map((jt) => (
            <span key={jt} role="listitem"
              className="h-[30px] px-3 bg-[#FAFAFA] border border-[#DBDBDB] rounded-full text-[#737373] text-[12px] font-medium flex items-center">
              {jt}
            </span>
          ))}
        </div>
      </div>

      {/* Certifications */}
      <div className="px-5 mb-6">
        <p className="text-[#737373] text-[11px] font-bold uppercase tracking-[0.18em] mb-2.5" id="certs-label">
          Certifications
        </p>
        <div className="flex flex-col gap-2" role="list" aria-labelledby="certs-label">
          {p.certifications.map((cert) => (
            <div key={cert} role="listitem" className="flex items-center gap-2.5">
              <CheckCircle size={13} aria-hidden className="text-emerald-500 flex-shrink-0" />
              <span className="text-[#737373] text-[13px]">{cert}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming shift */}
      <div className="px-5 mb-6">
        <p className="text-[#737373] text-[11px] font-bold uppercase tracking-[0.18em] mb-3">Next Shift</p>
        <div className="relative rounded-[12px] overflow-hidden border border-[#DBDBDB]">
          <img src={UPCOMING_SHIFT.coverImage} alt={UPCOMING_SHIFT.company} loading="lazy" decoding="async"
            className="w-full h-[100px] object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" aria-hidden />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-white font-bold text-[15px] leading-tight">{UPCOMING_SHIFT.jobType}</p>
                <p className="text-white/70 text-[12px]">{UPCOMING_SHIFT.company} · {UPCOMING_SHIFT.date}</p>
              </div>
              <div className="text-right">
                <p className="text-white font-bold text-[17px]">
                  ${UPCOMING_SHIFT.payRate}<span className="text-[11px] font-medium text-white/70">/hr</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <div className="px-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[#737373] text-[11px] font-bold uppercase tracking-[0.18em]">Reviews</p>
          <div className="flex items-center gap-1.5">
            <StarRow rating={p.rating} size={12} />
            <span className="text-black font-bold text-[13px]">{p.rating}</span>
          </div>
        </div>
        <div className="flex flex-col gap-3" role="list" aria-label="Client reviews">
          {RECENT_REVIEWS.map((review) => (
            <motion.div key={review.id} role="listitem"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-[#FAFAFA] border border-[#DBDBDB] rounded-[12px] p-4">
              <div className="flex items-center gap-3 mb-2.5">
                <img src={review.photoUrl} alt={review.reviewer} loading="lazy" decoding="async"
                  className="w-9 h-9 rounded-full object-cover border border-[#DBDBDB] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-black text-[13px] font-semibold truncate">{review.reviewer}</p>
                  <p className="text-[#737373] text-[11px] truncate">{review.venue} · {review.date}</p>
                </div>
                <StarRow rating={review.rating} size={11} />
              </div>
              <p className="text-[#737373] text-[13px] leading-relaxed">&ldquo;{review.text}&rdquo;</p>
            </motion.div>
          ))}
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
