import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Bell, Search, PlusCircle, SlidersHorizontal } from 'lucide-react';
import { BottomTabNav } from '@/components/BottomTabNav';
import { ShiftListCard, ShiftListCardSkeleton } from '@/components/home/ShiftListCard';
import { PeopleCard, PeopleCardSkeleton } from '@/components/home/PeopleCard';
import { useWorkerHomeShifts } from '@/hooks/useWorkerHomeShifts';
import { usePeopleFeed } from '@/hooks/usePeopleFeed';
import { useApplications } from '@/hooks/useApplications';
import { useRole } from '@/contexts/RoleContext';
import { JOB_TYPES } from '@/lib/jobTypes';

/* ─── Shared header ───────────────────────────────────────────────────────── */
function FeedHeader({ subtitle, onPost }: { subtitle: string; onPost?: () => void }) {
  const [, navigate] = useLocation();
  return (
    <div className="flex items-center justify-between px-4 pt-4 pb-2">
      <div>
        <h1 className="text-black font-bold text-[22px] leading-tight">365 Connect</h1>
        <p className="text-[#737373] text-[12px] font-medium mt-[1px]">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2">
        {onPost && (
          <button type="button" aria-label="Post a shift" onClick={onPost}
            className="w-9 h-9 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center">
            <PlusCircle size={16} aria-hidden className="text-black" />
          </button>
        )}
        <button type="button" aria-label="Search" onClick={() => navigate('/explore')}
          className="w-9 h-9 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center">
          <Search size={16} aria-hidden className="text-[#737373]" />
        </button>
        <button type="button" aria-label="Notifications" onClick={() => navigate('/notifications')}
          className="w-9 h-9 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center relative">
          <Bell size={16} aria-hidden className="text-[#737373]" />
          <span aria-hidden className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#0095F6] border-[1.5px] border-white" />
        </button>
      </div>
    </div>
  );
}

/* ─── (A) Worker Home Feed ────────────────────────────────────────────────── */
function WorkerHomeFeed() {
  const [, navigate] = useLocation();
  const { shifts, isLoading, error } = useWorkerHomeShifts();
  const { appliedShiftIds } = useApplications();

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col pb-[64px]">
      <div className="bg-white sticky top-0 z-40 border-b border-[#DBDBDB]">
        <FeedHeader subtitle="Shifts near you" />
      </div>

      <main className="flex-1 overflow-y-auto" aria-label="Shift feed">
        <div className="pt-4 pb-4">
          {isLoading && (
            <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading shifts">
              {[1, 2, 3].map((n) => <ShiftListCardSkeleton key={n} />)}
            </div>
          )}

          {error && !isLoading && (
            <div className="mx-4 rounded-[12px] bg-[#FAFAFA] border border-[#DBDBDB] px-6 py-10 text-center">
              <p className="text-[#737373] text-[14px]">Couldn't load shifts right now.</p>
              <p className="text-[#AAAAAA] text-[12px] mt-1">Pull down to try again.</p>
            </div>
          )}

          {!isLoading && !error && (
            <div className="flex flex-col gap-4" role="feed" aria-label="Available shifts near you">
              {shifts.map((shift, i) => (
                <motion.div key={shift.id}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3, ease: 'easeOut' }}>
                  <ShiftListCard shift={shift} applied={appliedShiftIds.has(shift.id)}
                    onTap={() => navigate(`/shift/${shift.id}`)} />
                </motion.div>
              ))}

              {shifts.length === 0 && (
                <div className="mx-4 rounded-[12px] bg-[#FAFAFA] border border-[#DBDBDB] px-6 py-10 text-center">
                  <p className="text-[#737373] text-[14px]">No shifts near you right now. Check back soon.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <BottomTabNav />
    </div>
  );
}

/* ─── (B) Client / Staffer Home Feed ─────────────────────────────────────── */
const RATING_FILTERS = ['Any rating', '4.0+', '4.5+'] as const;
const DISTANCE_FILTERS = ['Any distance', '< 5 mi', '< 15 mi', '< 25 mi'] as const;

function ClientHomeFeed() {
  const { people, isLoading, error } = usePeopleFeed();
  const [jobType, setJobType]   = useState<string | null>(null);
  const [rating, setRating]     = useState<typeof RATING_FILTERS[number]>('Any rating');
  const [distance, setDistance] = useState<typeof DISTANCE_FILTERS[number]>('Any distance');
  const [availableOnly, setAvailableOnly] = useState(false);

  const minRating = rating === '4.5+' ? 4.5 : rating === '4.0+' ? 4.0 : 0;
  const maxDistance = distance === '< 5 mi' ? 5 : distance === '< 15 mi' ? 15 : distance === '< 25 mi' ? 25 : Infinity;

  const filtered = people.filter((p) => {
    if (jobType && p.primaryJobType !== jobType) return false;
    if (p.rating < minRating) return false;
    if (p.distanceMiles > maxDistance) return false;
    if (availableOnly && !p.availableToday) return false;
    return true;
  });

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col pb-[64px]">
      <div className="bg-white sticky top-0 z-40 border-b border-[#DBDBDB]">
        <FeedHeader subtitle="Discover workers" />

        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-none" role="group" aria-label="Filters"
          style={{ WebkitOverflowScrolling: 'touch' }}>
          <select aria-label="Filter by job type" value={jobType ?? ''}
            onChange={(e) => setJobType(e.target.value || null)}
            className="h-[32px] px-3 rounded-full text-[12px] font-semibold border border-[#DBDBDB] bg-white text-black flex-shrink-0">
            <option value="">All job types</option>
            {JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select aria-label="Filter by rating" value={rating}
            onChange={(e) => setRating(e.target.value as typeof rating)}
            className="h-[32px] px-3 rounded-full text-[12px] font-semibold border border-[#DBDBDB] bg-white text-black flex-shrink-0">
            {RATING_FILTERS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select aria-label="Filter by distance" value={distance}
            onChange={(e) => setDistance(e.target.value as typeof distance)}
            className="h-[32px] px-3 rounded-full text-[12px] font-semibold border border-[#DBDBDB] bg-white text-black flex-shrink-0">
            {DISTANCE_FILTERS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <button type="button" role="switch" aria-checked={availableOnly}
            onClick={() => setAvailableOnly((v) => !v)}
            className={`h-[32px] px-3 rounded-full text-[12px] font-semibold border flex items-center gap-1.5 flex-shrink-0 ${
              availableOnly ? 'bg-black text-white border-black' : 'bg-white text-black border-[#DBDBDB]'
            }`}>
            <SlidersHorizontal size={12} aria-hidden />
            Available today
          </button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto" aria-label="Worker feed">
        <div className="pt-4 pb-4 flex flex-col gap-3">
          {isLoading && Array.from({ length: 4 }).map((_, i) => <PeopleCardSkeleton key={i} />)}

          {error && !isLoading && (
            <div className="mx-4 rounded-[12px] bg-[#FAFAFA] border border-[#DBDBDB] px-6 py-10 text-center">
              <p className="text-[#737373] text-[14px]">Couldn't load workers right now.</p>
            </div>
          )}

          {!isLoading && !error && filtered.map((person) => (
            <PeopleCard key={person.id} person={person} />
          ))}

          {!isLoading && !error && filtered.length === 0 && (
            <div className="mx-4 rounded-[12px] bg-[#FAFAFA] border border-[#DBDBDB] px-6 py-10 text-center">
              <p className="text-[#737373] text-[14px]">No workers found. Try adjusting your filters.</p>
            </div>
          )}
        </div>
      </main>

      <BottomTabNav />
    </div>
  );
}

/* ─── HomeScreen — role router ────────────────────────────────────────────── */
export function HomeScreen() {
  const { role, roleLoading } = useRole();

  if (roleLoading) {
    return (
      <div className="min-h-[100dvh] bg-white flex flex-col pb-[64px]">
        <div className="pt-4 flex flex-col gap-4">
          {[1, 2, 3].map((n) => <ShiftListCardSkeleton key={n} />)}
        </div>
        <BottomTabNav />
      </div>
    );
  }

  return role === 'worker' ? <WorkerHomeFeed /> : <ClientHomeFeed />;
}
