import { useLocation } from 'wouter';
import { BadgeCheck, Star } from 'lucide-react';
import type { WorkerPerson } from '@/hooks/usePeopleFeed';
import { useFollow } from '@/hooks/useFollow';
import { useToast } from '@/contexts/ToastContext';

const GOLD = '#FFD700';
const NAVY = '#0A1628';

/**
 * Client/Staffer Home Feed card (spec B) — vertical Instagram-style worker
 * profile card: circular photo, @username + gold checkmark if is_pro,
 * primary job type, star rating, View Profile + Follow (writes to `follows`).
 */
export function PeopleCard({ person }: { person: WorkerPerson }) {
  const [, navigate] = useLocation();
  const { showToast } = useToast();
  const { isFollowing, follow, unfollow, isFollowPending } = useFollow(person.id, {
    onFollowSuccess:   () => showToast(`Following @${person.username}`),
    onUnfollowSuccess: () => showToast(`Unfollowed @${person.username}`),
  });

  return (
    <div className="mx-4 rounded-[14px] border border-[#E5E7EB] bg-white px-4 py-4 flex items-center gap-4">
      <button type="button" aria-label={`View ${person.username}'s profile`}
        onClick={() => navigate(`/worker/${person.username}`)}
        className="w-16 h-16 rounded-full overflow-hidden bg-[#EFEFEF] flex-shrink-0 flex items-center justify-center">
        {person.photoUrl ? (
          <img src={person.photoUrl} alt="" aria-hidden loading="lazy" decoding="async"
            className="w-full h-full object-cover" />
        ) : (
          <span className="text-[#6B7280] font-bold text-[18px]">{person.username.slice(0, 2).toUpperCase()}</span>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[#111827] font-bold text-[15px] truncate">@{person.username}</p>
          {person.isPro && <BadgeCheck size={15} aria-label="Pro verified" style={{ color: GOLD }} className="flex-shrink-0" />}
        </div>
        {person.primaryJobType && (
          <p className="text-[#6B7280] text-[13px] mt-0.5 truncate">{person.primaryJobType}</p>
        )}
        <div className="flex items-center gap-1 mt-1">
          <Star size={12} aria-hidden className="text-amber-400 fill-amber-400" />
          <span className="text-[#6B7280] text-[12px] font-medium">
            {person.rating > 0 ? person.rating.toFixed(1) : 'New'}
          </span>
          <span className="text-[#D1D5DB]">·</span>
          <span className="text-[#6B7280] text-[12px]">{person.distanceMiles} mi</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 flex-shrink-0">
        <button type="button" onClick={() => navigate(`/worker/${person.username}`)}
          className="h-[34px] px-3.5 rounded-[8px] border border-[#E5E7EB] text-[#111827] text-[12px] font-semibold">
          View Profile
        </button>
        <button type="button" disabled={isFollowPending}
          onClick={() => (isFollowing ? unfollow() : follow())}
          aria-pressed={isFollowing}
          className="h-[34px] px-3.5 rounded-[8px] text-[12px] font-semibold text-white disabled:opacity-60"
          style={{ background: isFollowing ? '#6B7280' : NAVY }}>
          {isFollowing ? 'Following' : 'Follow'}
        </button>
      </div>
    </div>
  );
}

export function PeopleCardSkeleton() {
  return (
    <div className="mx-4 rounded-[14px] border border-[#E5E7EB] bg-white px-4 py-4 flex items-center gap-4">
      <div className="w-16 h-16 rounded-full bg-[#EFEFEF] animate-pulse flex-shrink-0" />
      <div className="flex-1 flex flex-col gap-2">
        <div className="w-24 h-4 rounded bg-[#EFEFEF] animate-pulse" />
        <div className="w-32 h-3 rounded bg-[#EFEFEF] animate-pulse" />
      </div>
    </div>
  );
}
