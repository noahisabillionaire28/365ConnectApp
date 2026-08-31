import { useParams, useLocation } from 'wouter';
import { BadgeCheck, Star, ChevronLeft, Heart, CalendarPlus, X, CheckCircle2, Flag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { friendlyDate } from '@/lib/supabase';
import { useFollow } from '@/hooks/useFollow';
import { usePosts } from '@/hooks/usePosts';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/contexts/RoleContext';
import { getOrCreateDirectConversation } from '@/hooks/useConversations';
import { ProfileSkeleton } from '@/components/skeletons/ProfileSkeleton';
import { useMyPostedShifts } from '@/hooks/useMyPostedShifts';
import { createShiftRequest } from '@/hooks/useShiftRequests';
import { useToast } from '@/contexts/ToastContext';

type PublicUserRow = {
  id: string;
  role: 'worker' | 'client' | 'staffer';
  username: string;
  photo_url: string | null;
  bio: string | null;
  job_types: string[];
  certifications: string[];
  rating: number;
  hourly_rate: number | null;
  created_at: string;
};

type ShiftRef = {
  title: string;
  start_time: string;
  client: { username: string } | null;
} | null;

type ReviewWithShift = {
  id: string;
  rating: number;
  created_at: string;
  shift: ShiftRef;
};

type PastShift = {
  id: string;
  name: string;
  date: string;
  client: string;
  rating: number;
};

type WorkerProfileData = PublicUserRow & {
  pastShifts: PastShift[];
};

function StarRow({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <div className="flex items-center gap-[2px]">
      {Array.from({ length: max }).map((_, i) => (
        <Star key={i} size={12}
          className={i < Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-[#DBDBDB] fill-[#DBDBDB]'} />
      ))}
    </div>
  );
}

function StatItem({ value, label }: { value: string | number; label: string }) {
  const formatted =
    typeof value === 'number' && value >= 1000
      ? `${(value / 1000).toFixed(1)}k`
      : String(value);
  return (
    <div className="flex flex-col items-center gap-[2px]">
      <span className="text-black font-bold text-[18px] leading-none">{formatted}</span>
      <span className="text-[#737373] text-[11px] font-medium leading-none">{label}</span>
    </div>
  );
}

/** Bottom sheet listing the viewer's own open shifts to invite this worker to. */
function RequestShiftSheet({ workerId, workerUsername, onClose }: {
  workerId: string; workerUsername: string | null; onClose: () => void;
}) {
  const { user: authUser } = useAuth();
  const { shifts, isLoading } = useMyPostedShifts();
  const { showToast } = useToast();
  const openShifts = shifts.filter((s) => s.status === 'open');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const NOTE_MAX = 240;
  const noteTooLong = note.length > NOTE_MAX;

  async function handleRequest(shiftId: string) {
    if (!authUser?.id || sendingId || noteTooLong) return;
    setSendingId(shiftId);
    setErrorMessage(null);
    const result = await createShiftRequest(authUser.id, workerId, shiftId, note);
    setSendingId(null);
    if (result.ok) {
      setSentId(shiftId);
      showToast('Request sent! We will notify them right away.');
    } else {
      setErrorMessage(result.message ?? 'Failed to send request.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true"
      aria-label={`Request ${workerUsername ? '@' + workerUsername : 'this worker'} for a shift`}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-[390px] bg-white rounded-t-[20px] max-h-[75vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[#DBDBDB] flex-shrink-0">
          <div>
            <h2 className="text-black font-bold text-[17px]">Request for shift</h2>
            <p className="text-[#737373] text-[12px] mt-[2px]">
              Invite {workerUsername ? `@${workerUsername}` : 'this worker'} to one of your open shifts
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center flex-shrink-0">
            <X size={16} className="text-black" />
          </button>
        </div>

        {errorMessage && (
          <p className="px-5 pt-3 text-[#EF4444] text-[12px] font-medium">{errorMessage}</p>
        )}

        <div className="px-5 pt-4">
          <label htmlFor="request-note" className="block text-black font-semibold text-[13px] mb-1.5">
            Message <span className="text-[#737373] font-normal">(optional)</span>
          </label>
          <textarea
            id="request-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Let them know why you're a good fit…"
            aria-invalid={noteTooLong}
            aria-describedby={noteTooLong ? 'request-note-error' : undefined}
            className={`w-full border rounded-[10px] px-3 py-2.5 text-[13px] text-black resize-none outline-none transition-colors ${
              noteTooLong ? 'border-[#EF4444] focus:border-[#EF4444]' : 'border-[#DBDBDB] focus:border-black'
            }`}
          />
          <div className="flex items-center justify-between mt-1">
            {noteTooLong ? (
              <p id="request-note-error" className="text-[#EF4444] text-[11px] font-medium">
                Keep it under {NOTE_MAX} characters.
              </p>
            ) : <span />}
            <p className={`text-[11px] font-medium ${noteTooLong ? 'text-[#EF4444]' : 'text-[#AAAAAA]'}`}>
              {note.length}/{NOTE_MAX}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {isLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-[68px] rounded-[12px] bg-[#FAFAFA] border border-[#DBDBDB] animate-pulse" />
              ))}
            </div>
          ) : openShifts.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-black font-semibold text-[14px]">No open shifts</p>
              <p className="text-[#737373] text-[12px] mt-1">Post a shift first, then invite workers directly.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {openShifts.map((shift) => {
                const isSending = sendingId === shift.id;
                const isSent    = sentId === shift.id;
                return (
                  <div key={shift.id}
                    className="flex items-center justify-between gap-3 rounded-[12px] border border-[#DBDBDB] px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-black font-semibold text-[14px] truncate">{shift.jobType}</p>
                      <p className="text-[#737373] text-[12px] mt-[2px]">
                        ${shift.payRate}/{shift.payPeriod} · {shift.date} {shift.startTime}
                      </p>
                    </div>
                    <button type="button" disabled={isSending || isSent || noteTooLong}
                      aria-disabled={isSending || isSent || noteTooLong}
                      onClick={() => void handleRequest(shift.id)}
                      className={`flex-shrink-0 px-4 py-[9px] rounded-[8px] text-[13px] font-bold flex items-center gap-1.5 transition-colors ${
                        isSent ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-black text-white disabled:opacity-50'
                      }`}>
                      {isSent ? (<><CheckCircle2 size={14} /> Sent</>) : isSending ? 'Sending…' : 'Request'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FollowButton({ profileId, username }: { profileId: string; username: string | null }) {
  const { showToast } = useToast();
  const { isFollowing, followerCount: _count, follow, unfollow, isFollowPending } = useFollow(profileId, {
    onFollowSuccess:   () => showToast(`Following @${username ?? 'user'}`),
    onUnfollowSuccess: () => showToast(`Unfollowed @${username ?? 'user'}`),
  });

  function handlePress() {
    if (isFollowPending) return;
    if (isFollowing) unfollow(); else follow();
  }

  return (
    <button type="button"
      aria-label={isFollowing ? 'Unfollow this worker' : 'Follow this worker'}
      aria-pressed={isFollowing} disabled={isFollowPending} onClick={handlePress}
      className={`flex-1 font-bold text-[14px] py-[14px] rounded-[8px] active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2 ${
        isFollowing
          ? 'bg-white border border-[#DBDBDB] text-black'
          : 'bg-black text-white'
      }`}>
      <Heart size={15} aria-hidden
        className={isFollowing ? 'fill-black text-black' : 'fill-white text-white'} />
      {isFollowing ? 'Following' : 'Follow'}
    </button>
  );
}

const REPORT_TYPES: { key: string; label: string }[] = [
  { key: 'no-show',     label: 'No-show' },
  { key: 'late-cancel', label: 'Late cancellation' },
  { key: 'harassment',  label: 'Harassment' },
  { key: 'payment',     label: 'Payment issue' },
  { key: 'fake-review', label: 'Fake review' },
  { key: 'other',       label: 'Other' },
];

/** Report-a-user sheet — files a dispute the admin team reviews. */
function ReportSheet({
  reportedUserId, username, onClose,
}: { reportedUserId: string; username: string | null; onClose: () => void }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [type, setType] = useState('no-show');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!reason.trim()) { setErr('Please describe what happened.'); return; }
    setSubmitting(true); setErr(null);
    try {
      await apiClient(user?.id).post('/disputes', {
        reported_user_id: reportedUserId, type, reason: reason.trim(),
      });
      showToast('Report submitted. Our team will review it.');
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not submit report.');
    } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-[430px] bg-white rounded-t-[20px] px-5 pt-4 pb-8">
        <div className="flex items-center justify-between mb-4">
          <p className="text-black font-bold text-[17px]">Report @{username ?? 'user'}</p>
          <button type="button" aria-label="Close" onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F5F5F5] flex items-center justify-center">
            <X size={16} className="text-[#737373]" />
          </button>
        </div>

        <p className="text-[#737373] text-[12px] font-semibold uppercase tracking-wide mb-2">Reason</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {REPORT_TYPES.map((t) => (
            <button key={t.key} type="button" onClick={() => setType(t.key)}
              className={`px-3 h-[34px] rounded-full text-[13px] font-semibold border ${
                type === t.key ? 'bg-black text-white border-black' : 'bg-white text-[#737373] border-[#DBDBDB]'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <textarea
          value={reason}
          onChange={(e) => { setReason(e.target.value); setErr(null); }}
          placeholder="What happened?"
          rows={3}
          className="w-full rounded-[10px] border border-[#DBDBDB] px-3 py-2.5 text-[14px] outline-none focus:border-black resize-none mb-2"
        />
        {err && <p className="text-[#EF4444] text-[12px] mb-2">{err}</p>}

        <button type="button" onClick={() => void submit()} disabled={submitting}
          className="w-full h-[48px] rounded-[10px] bg-[#EF4444] text-white font-bold text-[15px] disabled:opacity-60">
          {submitting ? 'Submitting…' : 'Submit Report'}
        </button>
      </div>
    </div>
  );
}

export function WorkerProfileScreen() {
  const params = useParams<{ username: string }>();
  const [, navigate] = useLocation();
  const { user: authUser } = useAuth();
  const { role } = useRole();
  const [profile, setProfile] = useState<WorkerProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isStartingChat, setStartingChat] = useState(false);
  const [showRequestSheet, setShowRequestSheet] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const { followerCount } = useFollow(profile?.id ?? '');
  const { data: workerPosts = [] } = usePosts(profile?.id);
  const canRequestShift =
    !!authUser && !!profile && authUser.id !== profile.id &&
    (role === 'client' || role === 'staffer') && profile.role === 'worker';

  useEffect(() => {
    if (!params.username) return;

    async function fetchProfile() {
      setLoading(true);
      setNotFound(false);

      let userData: PublicUserRow | null = null;
      try {
        userData = await apiClient('').get<PublicUserRow>(`/users/by-username/${params.username}`);
      } catch {
        setNotFound(true);
        setLoading(false);
        return;
      }

      if (!userData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      type ReviewRow = {
        id: string; rating: number; created_at: string;
        shift_title?: string | null; shift_start_time?: string | null; reviewer_username?: string | null;
      };
      let reviewData: ReviewRow[] = [];
      try {
        reviewData = await apiClient('').get<ReviewRow[]>(`/reviews/${userData.id}`);
      } catch { /* ignore */ }

      const pastShifts: PastShift[] = (reviewData ?? []).map((r) => ({
        id:     r.id,
        name:   r.shift_title ?? 'Unnamed Shift',
        date:   r.shift_start_time ? friendlyDate(r.shift_start_time) : '—',
        client: r.reviewer_username ? `@${r.reviewer_username}` : 'Private Client',
        rating: r.rating,
      }));

      setProfile({ ...(userData as PublicUserRow), pastShifts });
      setLoading(false);
    }

    fetchProfile();
  }, [params.username]);

  async function handleMessage() {
    if (!authUser?.id || !profile || isStartingChat) return;
    setStartingChat(true);
    const conversationId = await getOrCreateDirectConversation(authUser.id, profile.id);
    setStartingChat(false);
    if (conversationId) navigate(`/messages/${conversationId}`);
  }

  if (loading) return <ProfileSkeleton />;

  if (notFound || !profile) {
    return (
      <div className="flex flex-col h-full bg-white text-black items-center justify-center px-6">
        <button type="button" aria-label="Go back" onClick={() => { if (window.history.length > 1) window.history.back(); else navigate('/explore'); }}
          className="absolute top-12 left-4 w-9 h-9 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center">
          <ChevronLeft size={20} className="text-black" />
        </button>
        <p className="text-[18px] font-bold mb-2">User not found</p>
        <p className="text-[#737373] text-[14px] text-center mb-6">
          @{params.username} doesn't exist on 365 Connect yet.
        </p>
        <button onClick={() => { if (window.history.length > 1) window.history.back(); else navigate('/explore'); }} className="text-[#0095F6] font-semibold text-[14px]">
          Go back
        </button>
      </div>
    );
  }

  const initials  = (profile.username ?? '??').slice(0, 2).toUpperCase();
  const isVerified = false;

  return (
    <div className="flex flex-col h-full bg-white text-black overflow-y-auto">

      {/* Hero / Profile photo */}
      <div className="relative">
        <button type="button" aria-label="Go back" onClick={() => { if (window.history.length > 1) window.history.back(); else navigate('/explore'); }}
          className="absolute top-12 left-4 z-10 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform">
          <ChevronLeft size={20} className="text-white" />
        </button>

        {authUser && authUser.id !== profile.id && (
          <button type="button" aria-label={`Report @${profile.username}`} onClick={() => setShowReport(true)}
            className="absolute top-12 right-4 z-10 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform">
            <Flag size={17} className="text-white" />
          </button>
        )}

        <div className="w-full aspect-square bg-[#F5F5F5] flex items-center justify-center">
          {profile.photo_url ? (
            <img src={profile.photo_url} alt={profile.username}
              loading="eager" decoding="async" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[72px] font-bold text-[#DBDBDB]">{initials}</span>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent" />
      </div>

      {/* Profile info */}
      <div className="px-5 pt-2 pb-6">

        {/* Handle + verified */}
        <div className="flex items-center gap-2 mb-[2px]">
          <h1 className="text-[22px] font-bold text-black">@{profile.username}</h1>
          {isVerified && (
            <BadgeCheck size={20} className="text-[#0095F6] fill-[#0095F6] flex-shrink-0" />
          )}
        </div>

        <p className="text-[#737373] text-[13px] font-medium mb-1 capitalize">{profile.role}</p>

        {profile.role === 'worker' && profile.hourly_rate != null && (
          <div className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[12px] font-bold px-2.5 py-1 rounded-full mt-1">
            ${profile.hourly_rate}/hr
          </div>
        )}

        {profile.bio && (
          <p className="text-[14px] text-black leading-relaxed mt-3 mb-5">{profile.bio}</p>
        )}

        {/* Job type tags */}
        {profile.job_types.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {profile.job_types.map((job) => (
              <span key={job}
                className="px-3 py-[6px] rounded-full bg-[#FAFAFA] border border-[#DBDBDB] text-black text-[12px] font-semibold">
                {job}
              </span>
            ))}
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center justify-around bg-[#FAFAFA] rounded-[12px] border border-[#DBDBDB] py-4 px-3 mb-6">
          <StatItem value={profile.pastShifts.length} label="Shifts" />
          <div className="w-px h-8 bg-[#DBDBDB]" />
          <div className="flex flex-col items-center gap-[2px]">
            <span className="text-black font-bold text-[18px] leading-none">
              {profile.rating > 0 ? Number(profile.rating).toFixed(1) : '—'}
            </span>
            <div className="flex items-center gap-[3px] mt-[2px]">
              <Star size={10} className="text-amber-400 fill-amber-400" />
              <span className="text-[#737373] text-[11px] font-medium leading-none">Rating</span>
            </div>
          </div>
          <div className="w-px h-8 bg-[#DBDBDB]" />
          <StatItem value={followerCount} label="Followers" />
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mb-3">
          <FollowButton profileId={profile.id} username={profile.username} />
          {authUser?.id !== profile.id && (
            <button type="button" onClick={() => void handleMessage()} disabled={isStartingChat}
              className="flex-1 bg-white border border-[#DBDBDB] text-black font-bold text-[14px] py-[14px] rounded-[8px] active:scale-[0.98] transition-transform disabled:opacity-50">
              {isStartingChat ? 'Opening…' : 'Message'}
            </button>
          )}
          <button type="button" aria-label="More options"
            className="w-[52px] bg-white border border-[#DBDBDB] text-black font-bold py-[14px] rounded-[8px] active:scale-[0.98] transition-transform flex items-center justify-center">
            <span className="text-[16px] leading-none tracking-widest">···</span>
          </button>
        </div>

        {canRequestShift && (
          <button type="button" onClick={() => setShowRequestSheet(true)}
            className="w-full flex items-center justify-center gap-2 bg-[#0095F6] text-white font-bold text-[14px] py-[14px] rounded-[8px] active:scale-[0.98] transition-transform mb-8">
            <CalendarPlus size={16} aria-hidden />
            Request for shift
          </button>
        )}
        {!canRequestShift && <div className="mb-8" />}

        {/* Posts grid */}
        {workerPosts.filter((p) => p.photo_url).length > 0 && (
          <div className="mb-8">
            <h2 className="text-[13px] font-semibold text-[#737373] uppercase tracking-widest mb-3">
              Posts
            </h2>
            <div className="grid grid-cols-3 gap-[3px]">
              {workerPosts.filter((p) => p.photo_url).map((p) => (
                <button type="button" key={p.id} onClick={() => navigate(`/post/${p.id}`)}
                  aria-label="Open post"
                  className="relative aspect-square overflow-hidden bg-[#EFEFEF] rounded-[4px]">
                  <img src={p.photo_url as string} alt={p.caption ?? 'Post'}
                    loading="lazy" decoding="async" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Certifications */}
        {profile.certifications.length > 0 && (
          <div className="mb-8">
            <h2 className="text-[13px] font-semibold text-[#737373] uppercase tracking-widest mb-3">
              Certifications
            </h2>
            <div className="flex flex-wrap gap-2">
              {profile.certifications.map((cert) => (
                <span key={cert}
                  className="inline-flex items-center gap-[6px] px-3 py-[7px] rounded-full bg-[#FAFAFA] border border-[#DBDBDB] text-[#737373] text-[12px] font-semibold">
                  <BadgeCheck size={12} className="text-[#737373]" />
                  {cert}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Past shifts */}
        {profile.pastShifts.length > 0 ? (
          <div>
            <h2 className="text-[13px] font-semibold text-[#737373] uppercase tracking-widest mb-4">
              Past Shifts
            </h2>
            <div className="flex flex-col gap-3">
              {profile.pastShifts.map((shift) => (
                <div key={shift.id}
                  className="flex items-center gap-4 bg-[#FAFAFA] border border-[#DBDBDB] rounded-[12px] p-4">
                  <div className="w-11 h-11 rounded-[10px] bg-white border border-[#DBDBDB] flex items-center justify-center flex-shrink-0">
                    <Star size={16} className="text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-black font-semibold text-[14px] leading-snug truncate">{shift.name}</p>
                    <p className="text-[#737373] text-[12px] mt-[2px]">
                      {shift.client} · {shift.date}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-[3px] flex-shrink-0">
                    <StarRow rating={shift.rating} />
                    <span className="text-[#737373] text-[11px]">{shift.rating}.0</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-[#737373] text-[14px]">No rated shifts yet.</p>
            <p className="text-[#AAAAAA] text-[12px] mt-1">Shifts appear here after they're reviewed.</p>
          </div>
        )}

        <div className="h-8" />
      </div>

      {showRequestSheet && (
        <RequestShiftSheet
          workerId={profile.id}
          workerUsername={profile.username}
          onClose={() => setShowRequestSheet(false)}
        />
      )}

      {showReport && (
        <ReportSheet
          reportedUserId={profile.id}
          username={profile.username}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}
