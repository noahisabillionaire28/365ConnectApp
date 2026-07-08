import { useState } from 'react';
import { useLocation } from 'wouter';
import { Search, BadgeCheck } from 'lucide-react';
import { BottomTabNav } from '@/components/BottomTabNav';
import { usePeopleFeed, type WorkerPerson } from '@/hooks/usePeopleFeed';
import { JOB_TYPES } from '@/lib/jobTypes';

const GOLD = '#FFD700';

function ExploreTile({ person, onTap }: { person: WorkerPerson; onTap: () => void }) {
  return (
    <button type="button" onClick={onTap} aria-label={`View @${person.username}'s profile`}
      className="relative aspect-square w-full overflow-hidden bg-[#EFEFEF]">
      {person.photoUrl ? (
        <img src={person.photoUrl} alt="" aria-hidden loading="lazy" decoding="async"
          className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-[#6B7280] font-bold text-[20px]">{person.username.slice(0, 2).toUpperCase()}</span>
        </div>
      )}
      {person.isPro && (
        <div className="absolute top-1.5 right-1.5 bg-black/60 rounded-full p-0.5">
          <BadgeCheck size={13} aria-label="Pro verified" style={{ color: GOLD }} />
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1">
        <p className="text-white text-[10px] font-semibold truncate">@{person.username}</p>
      </div>
    </button>
  );
}

function ExploreTileSkeleton() {
  return <div className="aspect-square w-full bg-[#EFEFEF] animate-pulse" />;
}

export function ExploreScreen() {
  const [, navigate] = useLocation();
  const { people, isLoading, error } = usePeopleFeed();
  const [query, setQuery]     = useState('');
  const [jobType, setJobType] = useState<string | null>(null);

  const filtered = people.filter((p) => {
    if (jobType && p.primaryJobType !== jobType) return false;
    if (query && !p.username.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col pb-[56px]">
      <div className="sticky top-0 z-20 bg-white border-b border-[#DBDBDB]">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2 bg-[#FAFAFA] border border-[#DBDBDB] rounded-[10px] px-3.5 h-[42px]">
            <Search size={15} aria-hidden className="text-[#737373] flex-shrink-0" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search workers" aria-label="Search workers"
              className="flex-1 bg-transparent text-black text-[14px] placeholder:text-[#AAAAAA] outline-none" />
          </div>
        </div>
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-none" role="radiogroup" aria-label="Filter by job type"
          style={{ WebkitOverflowScrolling: 'touch' }}>
          <button type="button" role="radio" aria-checked={jobType === null} onClick={() => setJobType(null)}
            className={`flex-shrink-0 h-[30px] px-3.5 rounded-full text-[12px] font-semibold border whitespace-nowrap ${
              jobType === null ? 'bg-black text-white border-black' : 'bg-white text-black border-[#DBDBDB]'
            }`}>
            All
          </button>
          {JOB_TYPES.map((t) => (
            <button key={t} type="button" role="radio" aria-checked={jobType === t}
              onClick={() => setJobType(t)}
              className={`flex-shrink-0 h-[30px] px-3.5 rounded-full text-[12px] font-semibold border whitespace-nowrap ${
                jobType === t ? 'bg-black text-white border-black' : 'bg-white text-black border-[#DBDBDB]'
              }`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto">
        {error && !isLoading && (
          <div className="mx-4 mt-6 rounded-[12px] bg-[#FAFAFA] border border-[#DBDBDB] px-6 py-10 text-center">
            <p className="text-[#737373] text-[14px]">Couldn't load workers right now.</p>
          </div>
        )}

        {isLoading && (
          <div className="grid grid-cols-3 gap-[2px]" aria-busy="true" aria-label="Loading workers">
            {Array.from({ length: 12 }).map((_, i) => <ExploreTileSkeleton key={i} />)}
          </div>
        )}

        {!isLoading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-3 gap-[2px]" role="grid" aria-label="Worker profiles">
            {filtered.map((p) => (
              <ExploreTile key={p.id} person={p} onTap={() => navigate(`/worker/${p.username}`)} />
            ))}
          </div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <div className="mx-4 mt-6 rounded-[12px] bg-[#FAFAFA] border border-[#DBDBDB] px-6 py-10 text-center">
            <p className="text-[#737373] text-[14px]">No workers found. Try adjusting your filters.</p>
          </div>
        )}
      </main>

      <BottomTabNav />
    </div>
  );
}
