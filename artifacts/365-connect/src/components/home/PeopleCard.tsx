import { useLocation } from 'wouter';
import { AvatarFill } from '@/components/Avatar';
import { personName, handleLine } from '@/lib/person';
import { BadgeCheck, Star } from 'lucide-react';
import type { WorkerPerson } from '@/hooks/usePeopleFeed';
import { useFollow } from '@/hooks/useFollow';
import { useToast } from '@/contexts/ToastContext';

const GOLD = '#E8A800';
const NAVY = '#0A1628';

/**
 * Client/Staffer Home Feed card (spec B) — vertical Instagram-style worker
 * profile card: circular photo, @username + gold checkmark if is_pro,
 * primary job type, star rating, View profile + Follow (writes to `follows`).
 */
export function PeopleCard({ person }: { person: WorkerPerson }) {
  const [, navigate] = useLocation();
  const { showToast } = useToast();
  // For clients/staffers, following a worker is what puts them on your roster
  // (the list you assign shifts from) — so the button says exactly that.
  const { isFollowing, follow, unfollow, isFollowPending } = useFollow(person.id, {
    onFollowSuccess:   () => showToast(`${personName(person)} added to your roster`),
    onUnfollowSuccess: () => showToast(`${personName(person)} removed from your roster`),
    onError:           (msg) => showToast(msg, 'error'),
    // The directory already tells us — no extra request per card.
    initialFollowing:  person.isFollowed,
  });
  const hasDistance = Number.isFinite(person.distanceMiles);

  return (
    <div className="mx-4 rounded-[14px] border border-[#E5E7EB] bg-white px-4 py-4 flex items-center gap-4">
      <button type="button" aria-label={`View ${personName(person)}'s profile`}
        onClick={() => navigate(`/worker/${person.username}`)}
        className="w-16 h-16 rounded-full overflow-hidden bg-[#F3F4F6] flex-shrink-0 flex items-center justify-center">
        <AvatarFill src={person.photoUrl} name={personName(person)} className="text-[#6B7280] font-bold text-[18px]" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[#111827] font-bold text-[15px] truncate">{personName(person)}</p>
          {person.isPro && <BadgeCheck size={15} aria-label="Pro member" fill={GOLD} className="flex-shrink-0 text-white" />}
        </div>
        {(person.primaryJobType || handleLine(person)) && (
          <p className="text-[#6B7280] text-[13px] mt-0.5 truncate">{[person.primaryJobType, handleLine(person)].filter(Boolean).join(' · ')}</p>
        )}
        <div className="flex items-center gap-1 mt-1">
          <Star size={12} aria-hidden className="text-amber-400 fill-amber-400" />
          <span className="text-[#6B7280] text-[12px] font-medium">
            {Number(person.rating) > 0 ? Number(person.rating).toFixed(1) : 'New'}
          </span>
          {hasDistance && (
            <>
              <span className="text-[#D1D5DB]">·</span>
              <span className="text-[#6B7280] text-[12px]">{person.distanceMiles} mi</span>
            </>
          )}
          {!person.isAvailable && (
            <>
              <span className="text-[#D1D5DB]">·</span>
              <span className="text-[#6B7280] text-[12px]">Not taking shifts</span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 flex-shrink-0">
        <button type="button" onClick={() => navigate(`/worker/${person.username}`)}
          className="h-[34px] px-3.5 rounded-[8px] border border-[#E5E7EB] text-[#111827] text-[12px] font-semibold">
          View profile
        </button>
        <button type="button" disabled={isFollowPending}
          onClick={() => (isFollowing ? unfollow() : follow())}
          aria-pressed={isFollowing}
          aria-label={isFollowing ? `Remove @${person.username} from your roster` : `Add @${person.username} to your roster`}
          className="h-[34px] px-3.5 rounded-[8px] text-[12px] font-semibold text-white disabled:opacity-60 whitespace-nowrap"
          style={{ background: isFollowing ? '#6B7280' : NAVY }}>
          {isFollowing ? 'On roster' : 'Add to roster'}
        </button>
      </div>
    </div>
  );
}

export function PeopleCardSkeleton() {
  return (
    <div className="mx-4 rounded-[14px] border border-[#E5E7EB] bg-white px-4 py-4 flex items-center gap-4">
      <div className="w-16 h-16 rounded-full bg-[#F3F4F6] animate-pulse flex-shrink-0" />
      <div className="flex-1 flex flex-col gap-2">
        <div className="w-24 h-4 rounded bg-[#F3F4F6] animate-pulse" />
        <div className="w-32 h-3 rounded bg-[#F3F4F6] animate-pulse" />
      </div>
    </div>
  );
}
