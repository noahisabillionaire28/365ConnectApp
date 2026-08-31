import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star, ChevronRight, Settings,
  CreditCard, Bell, Shield, HelpCircle, LogOut,
  Edit3, MapPin, CheckCircle, UserCircle2, Briefcase, Clock3, XCircle, Hourglass, Users,
  BadgeCheck, Zap, Eye, ChevronLeft,
} from 'lucide-react';
import { BottomTabNav } from '@/components/BottomTabNav';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useMyApplications, type MyApplication } from '@/hooks/useMyApplications';
import { usePayments } from '@/hooks/usePayments';
import { useReviews } from '@/hooks/useReviews';
import { usePosts } from '@/hooks/usePosts';
import { useQueryClient } from '@tanstack/react-query';
import { uploadPostPhoto } from '@/lib/storage';
import { apiClient } from '@/lib/api';

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
      <div className="h-[96px] bg-[#F5F5F5] animate-pulse" />
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

/* ── My Applications ─────────────────────────────────────────────────────── */
const APPLICATION_STATUS_META: Record<string, { label: string; className: string; Icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  pending:   { label: 'Pending',  className: 'bg-amber-50 border-amber-200 text-amber-600',     Icon: Hourglass },
  accepted:  { label: 'Accepted', className: 'bg-emerald-50 border-emerald-200 text-emerald-600', Icon: CheckCircle },
  declined:  { label: 'Not Selected', className: 'bg-[#FAFAFA] border-[#DBDBDB] text-[#737373]', Icon: XCircle },
  rejected:  { label: 'Not Selected', className: 'bg-[#FAFAFA] border-[#DBDBDB] text-[#737373]', Icon: XCircle },
  withdrawn: { label: 'Withdrawn', className: 'bg-[#FAFAFA] border-[#DBDBDB] text-[#737373]',    Icon: XCircle },
};

function ApplicationRow({ application, onTap }: { application: MyApplication; onTap: () => void }) {
  const meta = APPLICATION_STATUS_META[application.status] ?? APPLICATION_STATUS_META.pending;
  const { label, className, Icon } = meta;
  return (
    <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={onTap}
      aria-label={`${application.shiftTitle} at ${application.companyName ?? 'client'} — ${label}`}
      className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-[#DBDBDB] text-left last:border-none">
      <div className="w-11 h-11 rounded-[10px] bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center flex-shrink-0 overflow-hidden">
        {application.coverImage
          ? <img src={application.coverImage} alt="" className="w-full h-full object-cover" />
          : <Briefcase size={16} aria-hidden className="text-[#737373]" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-black font-semibold text-[14px] truncate">{application.shiftTitle}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Clock3 size={11} aria-hidden className="text-[#737373] flex-shrink-0" />
          <p className="text-[#737373] text-[12px] truncate">
            {application.companyName ?? application.jobType}
            {application.payRate ? ` · ${application.payRate}/${application.payPeriod}` : ''}
          </p>
        </div>
      </div>
      <span className={`flex items-center gap-1 h-[26px] px-2.5 rounded-full text-[11px] font-bold border flex-shrink-0 ${className}`}>
        <Icon size={11} aria-hidden />
        {label}
      </span>
    </motion.button>
  );
}

function MyApplicationsSection() {
  const [, navigate] = useLocation();
  const { applications, isLoading, error } = useMyApplications();

  if (isLoading) {
    return (
      <div className="px-5 mb-6">
        <p className="text-[#737373] text-[11px] font-bold uppercase tracking-[0.18em] mb-2.5">My Applications</p>
        <div className="bg-white border border-[#DBDBDB] rounded-[12px] overflow-hidden">
          {[1, 2].map((n) => (
            <div key={n} className="flex items-center gap-3 px-4 py-3.5 border-b border-[#DBDBDB] last:border-none">
              <div className="w-11 h-11 rounded-[10px] bg-[#EFEFEF] animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="w-2/3 h-3.5 rounded bg-[#EFEFEF] animate-pulse" />
                <div className="w-1/3 h-3 rounded bg-[#EFEFEF] animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) return null; // Non-critical section — fail silently rather than blocking the whole profile

  return (
    <div className="px-5 mb-6">
      <p className="text-[#737373] text-[11px] font-bold uppercase tracking-[0.18em] mb-2.5">My Applications</p>
      {applications.length > 0 ? (
        <div className="bg-white border border-[#DBDBDB] rounded-[12px] overflow-hidden">
          {applications.map((app) => (
            <ApplicationRow key={app.applicationId} application={app} onTap={() => navigate(`/shift/${app.shiftId}`)} />
          ))}
        </div>
      ) : (
        <div className="bg-[#FAFAFA] border border-[#DBDBDB] rounded-[12px] p-4 flex flex-col items-center gap-1 text-center">
          <Briefcase size={20} aria-hidden className="text-[#DBDBDB] mb-1" />
          <p className="text-[#737373] text-[13px] font-medium">No applications yet</p>
          <p className="text-[#AAAAAA] text-[12px]">Apply to a shift to see its status here.</p>
        </div>
      )}
    </div>
  );
}

/* ── ProfileScreen ───────────────────────────────────────────────────────── */
export function ProfileScreen() {
  const { signOut, user } = useAuth();
  const [, navigate] = useLocation();
  const profile      = useProfile();
  const { payments } = usePayments();
  const { reviews }  = useReviews(); // defaults to the logged-in user's reviews
  const { data: posts = [] } = usePosts(user?.id);
  const queryClient = useQueryClient();
  const postFileRef = useRef<HTMLInputElement>(null);
  const [postingMoment, setPostingMoment] = useState(false);

  async function handleAddPost(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file || !user?.id) return;
    setPostingMoment(true);
    try {
      const url = await uploadPostPhoto(user.id, file);
      await apiClient(user.id).post('/posts', { photo_url: url, caption: null });
      await queryClient.invalidateQueries({ queryKey: ['posts'] });
    } catch (err) {
      console.error('[Profile] add post failed:', err);
    } finally {
      setPostingMoment(false);
    }
  }

  // Real lifetime stats derived from the worker's paid shifts.
  const shiftsCompleted = payments.length;
  const totalEarned = payments.reduce((sum, p) => sum + (Number(p.net_amount) || 0), 0);
  const earnedDisplay = totalEarned >= 1000
    ? `$${(totalEarned / 1000).toFixed(1)}k`
    : `$${Math.round(totalEarned)}`;

  const [available, setAvailable]     = useState(true);
  const [comingSoonLabel, setComingSoon] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Seed the toggle from the saved value once the profile loads.
  useEffect(() => {
    if (!profile.isLoading) setAvailable(profile.isAvailable);
  }, [profile.isLoading, profile.isAvailable]);

  async function toggleAvailable() {
    const next = !available;
    setAvailable(next); // optimistic
    try {
      await apiClient(user?.id).patch('/users/me', { is_available: next });
    } catch {
      setAvailable(!next); // revert on failure
    }
  }

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  // Unauthenticated guard — redirect to splash rather than rendering a blank profile.
  // Must live in useEffect; calling navigate() during render causes React to warn
  // "Cannot update a component while rendering a different component".
  useEffect(() => {
    if (!profile.isLoading && !profile.email) {
      navigate('/');
    }
  }, [profile.isLoading, profile.email]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!profile.isLoading && !profile.email) return null;

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

      {/* Cover — subtle navy brand gradient (no empty grey band) */}
      <div className="relative">
        <div aria-hidden className="h-[96px] w-full bg-gradient-to-br from-[#0A1628] via-[#152742] to-[#0A1628]" />

        {/* Settings gear — opens all settings */}
        <button type="button" aria-label="Settings" onClick={() => setSettingsOpen(true)}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white border border-[#DBDBDB] flex items-center justify-center">
          <Settings size={16} aria-hidden className="text-black" />
        </button>

        {/* Avatar */}
        <div className="absolute left-5 -bottom-[42px]">
          <ProfileAvatar photoUrl={photoUrl} displayName={displayName} size={82} />
        </div>

        {/* Available toggle */}
        <div className="flex justify-end px-5 pt-3">
          <button type="button" aria-pressed={available}
            aria-label={available ? 'Set yourself as unavailable' : 'Set yourself as available'}
            onClick={() => void toggleAvailable()}
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
          <h1 className="text-black font-bold text-[22px] tracking-tight">{displayName}</h1>
          {profile.isPro && (
            <BadgeCheck size={20} aria-label="Pro verified" className="text-[#FFD700] flex-shrink-0" />
          )}
        </div>

        <p className="text-[#737373] text-[13px] mb-2">
          {username ? `@${username}` : <span className="italic text-[#AAAAAA]">No username set</span>}
        </p>

        {profile.role === 'worker' && profile.hourlyRate != null && (
          <div className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[12px] font-bold px-2.5 py-1 rounded-full mb-2">
            ${profile.hourlyRate}/hr
          </div>
        )}

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
          { label: 'Shifts',  value: `${shiftsCompleted}`, sub: 'completed'   },
          { label: 'Rating',  value: `${ratingDisplay}★`,  sub: ratingSubLabel },
          { label: 'Earned',  value: earnedDisplay,        sub: 'lifetime'    },
        ].map(({ label, value, sub }, i) => (
          <div key={label} role="listitem" aria-label={`${label}: ${value}`}
            className={`flex flex-col items-center justify-center py-4 ${i < 2 ? 'border-r border-[#DBDBDB]' : ''}`}>
            <p className="text-black font-bold text-[22px] leading-tight">{value}</p>
            <p className="text-[#737373] text-[10px] font-semibold uppercase tracking-wide mt-0.5">{label}</p>
            <p className="text-[#AAAAAA] text-[10px] mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Edit Profile — Instagram-style */}
      <div className="px-4 mb-5">
        <button type="button" onClick={() => navigate('/profile-setup?edit=1')}
          aria-label="Edit profile"
          className="w-full h-[38px] rounded-[10px] bg-[#FAFAFA] border border-[#DBDBDB] text-[#111827] text-[14px] font-semibold flex items-center justify-center gap-2">
          <Edit3 size={14} aria-hidden /> Edit Profile
        </button>
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

      {/* Posts grid */}
      <div className="px-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[#737373] text-[11px] font-bold uppercase tracking-[0.18em]">Posts</p>
          <button type="button" onClick={() => postFileRef.current?.click()} disabled={postingMoment}
            className="flex items-center gap-1 text-[#0A1628] text-[12px] font-bold disabled:opacity-50">
            <span className="text-[15px] leading-none">＋</span>{postingMoment ? 'Posting…' : 'Share a moment'}
          </button>
        </div>
        <input ref={postFileRef} type="file" accept="image/*" hidden onChange={handleAddPost} />
        {posts.filter((p) => p.photo_url).length > 0 ? (
          <div className="grid grid-cols-3 gap-[3px]">
            {posts.filter((p) => p.photo_url).map((p) => (
              <button type="button" key={p.id} onClick={() => navigate(`/post/${p.id}`)}
                aria-label="Open post"
                className="relative aspect-square overflow-hidden bg-[#EFEFEF] rounded-[4px]">
                <img src={p.photo_url as string} alt={p.caption ?? 'Post'}
                  loading="lazy" decoding="async" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        ) : (
          <button type="button" onClick={() => postFileRef.current?.click()} disabled={postingMoment}
            className="w-full rounded-[12px] bg-[#FAFAFA] border border-[#EFEFEF] px-6 py-8 text-center disabled:opacity-50">
            <p className="text-[#AAAAAA] text-[12px]">{postingMoment ? 'Posting your moment…' : 'No posts yet — tap to share a moment.'}</p>
          </button>
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
        {reviews.length > 0 ? (
          <div className="flex flex-col gap-3">
            {reviews.map((r) => (
              <div key={r.id} className="bg-[#FAFAFA] border border-[#DBDBDB] rounded-[12px] p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    {r.reviewer_photo ? (
                      <img src={r.reviewer_photo} alt="" className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-[#DBDBDB]" />
                    )}
                    <span className="text-black text-[13px] font-semibold">
                      {r.reviewer_username ? `@${r.reviewer_username}` : 'Client'}
                    </span>
                  </div>
                  <StarRow rating={r.rating} size={11} />
                </div>
                {r.comment && (
                  <p className="text-[#737373] text-[13px] leading-relaxed">{r.comment}</p>
                )}
                {r.positive_tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {r.positive_tags.map((t) => (
                      <span key={t} className="text-[11px] text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[#FAFAFA] border border-[#DBDBDB] rounded-[12px] p-4 flex flex-col items-center gap-1 text-center">
            <Star size={22} aria-hidden className="text-[#DBDBDB] mb-1" />
            <p className="text-[#737373] text-[13px] font-medium">No reviews yet</p>
            <p className="text-[#AAAAAA] text-[12px]">Reviews from clients will appear here after your first shift.</p>
          </div>
        )}
      </div>

      {/* Go Pro CTA — shown when not yet Pro */}
      {!profile.isPro && (
        <div className="px-4 mb-5">
          <motion.button
            type="button" whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/pro-upgrade')}
            aria-label="Upgrade to Pro plan"
            className="w-full bg-gradient-to-r from-[#0A1628] to-[#1E3A5F] rounded-[14px] px-5 py-4 flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-[10px] bg-[#FFD700]/20 border border-[#FFD700]/30 flex items-center justify-center flex-shrink-0">
              <Zap size={18} aria-hidden className="text-[#FFD700]" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-white font-bold text-[15px]">Upgrade to Pro</p>
              <p className="text-white/60 text-[12px]">$17/mo · Priority applications + Pro badge</p>
            </div>
            <ChevronRight size={16} aria-hidden className="text-white/40" />
          </motion.button>
        </div>
      )}

      {/* My Applications — worker-only */}
      {profile.role === 'worker' && <MyApplicationsSection />}

      <BottomTabNav />

      {/* Settings panel — opened by the gear; holds every setting in one place */}
      <AnimatePresence>
        {settingsOpen && (() => {
          const go = (path: string) => { setSettingsOpen(false); navigate(path); };
          return (
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
              className="fixed inset-0 z-[95] bg-white flex flex-col max-w-[430px] mx-auto"
              role="dialog" aria-label="Settings"
            >
              <div className="sticky top-0 bg-white border-b border-[#EFEFEF] px-4 pt-[52px] pb-3 flex items-center gap-3">
                <button type="button" aria-label="Close settings" onClick={() => setSettingsOpen(false)}
                  className="w-9 h-9 rounded-full bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-center">
                  <ChevronLeft size={18} aria-hidden className="text-[#0A1628]" />
                </button>
                <h1 className="text-[#111827] font-bold text-[20px]">Settings</h1>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4">
                <p className="text-[#737373] text-[11px] font-bold uppercase tracking-[0.18em] px-1 mb-3">Account</p>
                <div className="bg-white border border-[#DBDBDB] rounded-[12px] overflow-hidden mb-4">
                  <SettingRow icon={Edit3} label="Edit Profile" onTap={() => go('/profile-setup?edit=1')} />
                  {username && (
                    <SettingRow icon={Eye} label="View My Public Profile" onTap={() => go(`/worker/${username}`)} />
                  )}
                  <SettingRow icon={CreditCard} label="Payments & Earnings" onTap={() => go('/earnings')} />
                  <SettingRow icon={Bell} label="Notifications" onTap={() => go('/notification-settings')} />
                </div>

                {profile.role === 'staffer' && (
                  <>
                    <p className="text-[#737373] text-[11px] font-bold uppercase tracking-[0.18em] px-1 mb-3">Workforce</p>
                    <div className="bg-white border border-[#DBDBDB] rounded-[12px] overflow-hidden mb-4">
                      <SettingRow icon={Users} label="My Roster" onTap={() => go('/roster')} />
                    </div>
                  </>
                )}

                {!profile.isPro && (
                  <div className="bg-white border border-[#DBDBDB] rounded-[12px] overflow-hidden mb-4">
                    <SettingRow icon={Zap} label="Upgrade to Pro" onTap={() => go('/pro-upgrade')} />
                  </div>
                )}

                <div className="bg-white border border-[#DBDBDB] rounded-[12px] overflow-hidden">
                  <SettingRow icon={LogOut} label="Log Out" onTap={handleSignOut} danger />
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
