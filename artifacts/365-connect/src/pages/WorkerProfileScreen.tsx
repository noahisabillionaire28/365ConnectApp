import { useParams } from 'wouter';
import { BadgeCheck, Star, ChevronLeft, Heart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { friendlyDate } from '@/lib/supabase';
import { useFollow } from '@/hooks/useFollow';
import { ProfileSkeleton } from '@/components/skeletons/ProfileSkeleton';

type PublicUserRow = {
  id: string;
  role: 'worker' | 'client' | 'staffer';
  username: string;
  photo_url: string | null;
  bio: string | null;
  job_types: string[];
  certifications: string[];
  rating: number;
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

function FollowButton({ profileId }: { profileId: string }) {
  const { isFollowing, followerCount: _count, follow, unfollow, isFollowPending } = useFollow(profileId);

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

export function WorkerProfileScreen() {
  const params = useParams<{ username: string }>();
  const [profile, setProfile] = useState<WorkerProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const { followerCount } = useFollow(profile?.id ?? '');

  useEffect(() => {
    if (!params.username) return;

    async function fetchProfile() {
      setLoading(true);
      setNotFound(false);

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, role, username, photo_url, bio, job_types, certifications, rating, created_at')
        .eq('username', params.username)
        .single();

      if (userError || !userData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const { data: reviewData } = await supabase
        .from('reviews_visible')
        .select(`
          id,
          rating,
          created_at,
          shift:shifts (
            title,
            start_time,
            client:users!shifts_client_id_fkey (
              username
            )
          )
        `)
        .eq('reviewee_id', (userData as PublicUserRow).id)
        .order('created_at', { ascending: false })
        .limit(10)
        .returns<ReviewWithShift[]>();

      const pastShifts: PastShift[] = (reviewData ?? []).map((r) => ({
        id:     r.id,
        name:   r.shift?.title ?? 'Unnamed Shift',
        date:   r.shift?.start_time ? friendlyDate(r.shift.start_time) : '—',
        client: r.shift?.client?.username ? `@${r.shift.client.username}` : 'Private Client',
        rating: r.rating,
      }));

      setProfile({ ...(userData as PublicUserRow), pastShifts });
      setLoading(false);
    }

    fetchProfile();
  }, [params.username]);

  if (loading) return <ProfileSkeleton />;

  if (notFound || !profile) {
    return (
      <div className="flex flex-col h-full bg-white text-black items-center justify-center px-6">
        <button type="button" aria-label="Go back" onClick={() => window.history.back()}
          className="absolute top-12 left-4 w-9 h-9 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center">
          <ChevronLeft size={20} className="text-black" />
        </button>
        <p className="text-[18px] font-bold mb-2">User not found</p>
        <p className="text-[#737373] text-[14px] text-center mb-6">
          @{params.username} doesn't exist on 365 Connect yet.
        </p>
        <button onClick={() => window.history.back()} className="text-[#0095F6] font-semibold text-[14px]">
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
        <button type="button" aria-label="Go back" onClick={() => window.history.back()}
          className="absolute top-12 left-4 z-10 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform">
          <ChevronLeft size={20} className="text-white" />
        </button>

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
        <div className="flex gap-3 mb-8">
          <FollowButton profileId={profile.id} />
          <button type="button"
            className="flex-1 bg-white border border-[#DBDBDB] text-black font-bold text-[14px] py-[14px] rounded-[8px] active:scale-[0.98] transition-transform">
            Message
          </button>
          <button type="button" aria-label="More options"
            className="w-[52px] bg-white border border-[#DBDBDB] text-black font-bold py-[14px] rounded-[8px] active:scale-[0.98] transition-transform flex items-center justify-center">
            <span className="text-[16px] leading-none tracking-widest">···</span>
          </button>
        </div>

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
    </div>
  );
}
