import { useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { Search, BadgeCheck, ImagePlus } from 'lucide-react';
import { BottomTabNav } from '@/components/BottomTabNav';
import { PostCard } from '@/components/PostCard';
import { usePeopleFeed, type WorkerPerson } from '@/hooks/usePeopleFeed';
import { useFeed, useToggleLike, useCreatePost } from '@/hooks/useFeed';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { uploadPostPhoto } from '@/lib/storage';
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
          <span className="text-[#6B7280] font-bold text-[20px]">{(person.username ?? '??').slice(0, 2).toUpperCase()}</span>
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
  const { user } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<'feed' | 'people'>('feed');

  // People tab
  const { people, isLoading, error } = usePeopleFeed();
  const [query, setQuery]     = useState('');
  const [jobType, setJobType] = useState<string | null>(null);
  const filtered = people.filter((p) => {
    if (jobType && p.primaryJobType !== jobType) return false;
    if (query && !(p.username ?? '').toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  // Feed tab
  const { posts, isLoading: feedLoading } = useFeed();
  const toggleLike = useToggleLike();
  const createPost = useCreatePost();
  const [posting, setPosting] = useState(false);
  const [composeFile, setComposeFile] = useState<File | null>(null);
  const [composePreview, setComposePreview] = useState<string | null>(null);
  const [composeCaption, setComposeCaption] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function handlePick(file: File | undefined) {
    if (!file) return;
    setComposeFile(file);
    setComposePreview(URL.createObjectURL(file));
    setComposeCaption('');
    if (fileRef.current) fileRef.current.value = '';
  }

  function closeCompose() {
    if (composePreview) URL.revokeObjectURL(composePreview);
    setComposeFile(null);
    setComposePreview(null);
    setComposeCaption('');
  }

  async function handlePost() {
    if (!composeFile || !user?.id || posting) return;
    setPosting(true);
    try {
      const url = await uploadPostPhoto(user.id, composeFile);
      await createPost.mutateAsync({ photo_url: url, caption: composeCaption.trim() || null });
      showToast('Posted to the feed!');
      closeCompose();
    } catch {
      showToast('Could not post — try again.');
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col pb-[56px]">
      <div className="sticky top-0 z-20 bg-white border-b border-[#DBDBDB]">
        {/* Feed / People toggle */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-3">
          <div className="flex bg-[#F3F4F6] rounded-full p-[3px] flex-1" role="tablist" aria-label="Explore view">
            <button type="button" role="tab" aria-selected={tab === 'feed'} onClick={() => setTab('feed')}
              className={`flex-1 h-[34px] rounded-full text-[13px] font-bold transition-all ${
                tab === 'feed' ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280]'}`}>
              Feed
            </button>
            <button type="button" role="tab" aria-selected={tab === 'people'} onClick={() => setTab('people')}
              className={`flex-1 h-[34px] rounded-full text-[13px] font-bold transition-all ${
                tab === 'people' ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280]'}`}>
              People
            </button>
          </div>
        </div>

        {/* People search + filters */}
        {tab === 'people' && (
          <>
            <div className="px-4 pb-3">
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
                  jobType === null ? 'bg-black text-white border-black' : 'bg-white text-black border-[#DBDBDB]'}`}>
                All
              </button>
              {JOB_TYPES.map((t) => (
                <button key={t} type="button" role="radio" aria-checked={jobType === t}
                  onClick={() => setJobType(t)}
                  className={`flex-shrink-0 h-[30px] px-3.5 rounded-full text-[12px] font-semibold border whitespace-nowrap ${
                    jobType === t ? 'bg-black text-white border-black' : 'bg-white text-black border-[#DBDBDB]'}`}>
                  {t}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <main className="flex-1 overflow-y-auto">
        {tab === 'people' ? (
          <>
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
          </>
        ) : (
          <>
            {feedLoading && (
              <div className="flex flex-col">
                {[1, 2].map((n) => (
                  <div key={n} className="border-b border-[#EFEFEF] pb-4">
                    <div className="flex items-center gap-2.5 px-4 py-3">
                      <div className="w-9 h-9 rounded-full bg-[#EFEFEF] animate-pulse" />
                      <div className="w-24 h-3 rounded bg-[#EFEFEF] animate-pulse" />
                    </div>
                    <div className="w-full h-[320px] bg-[#EFEFEF] animate-pulse" />
                  </div>
                ))}
              </div>
            )}
            {!feedLoading && posts.length === 0 && (
              <div className="mx-4 mt-8 rounded-[12px] bg-[#FAFAFA] border border-[#DBDBDB] px-6 py-12 text-center">
                <p className="text-[#111827] text-[15px] font-semibold">No posts yet</p>
                <p className="text-[#737373] text-[13px] mt-1">Be the first — tap the camera to share a moment from a shift.</p>
              </div>
            )}
            {!feedLoading && posts.map((post) => (
              <PostCard key={post.id} post={post}
                onLike={(id) => toggleLike.mutate(id)}
                onOpenComments={(id) => navigate(`/post/${id}`)} />
            ))}
          </>
        )}
      </main>

      {/* Compose FAB (feed tab) */}
      {tab === 'feed' && (
        <>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => handlePick(e.target.files?.[0])} />
          <button type="button" aria-label="Share a photo"
            onClick={() => fileRef.current?.click()}
            className="fixed bottom-[72px] right-4 z-40 w-14 h-14 rounded-full bg-[#0A1628] text-white shadow-lg flex items-center justify-center">
            <ImagePlus size={22} aria-hidden />
          </button>
        </>
      )}

      {/* Compose sheet — photo preview + caption with #hashtags */}
      {composeFile && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-white max-w-[430px] mx-auto" role="dialog" aria-label="New post">
          <div className="flex items-center justify-between px-4 pt-[52px] pb-3 border-b border-[#EFEFEF]">
            <button type="button" onClick={closeCompose} disabled={posting}
              className="text-[#111827] text-[15px] font-medium disabled:opacity-50">Cancel</button>
            <h1 className="text-[#111827] font-bold text-[16px]">New post</h1>
            <button type="button" onClick={() => void handlePost()} disabled={posting}
              className="text-[#2563EB] text-[15px] font-bold disabled:opacity-50">
              {posting ? 'Posting…' : 'Share'}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {composePreview && (
              <img src={composePreview} alt="Preview"
                className="w-full max-h-[340px] object-cover rounded-[12px] border border-[#E5E7EB] mb-3" />
            )}
            <textarea
              value={composeCaption}
              onChange={(e) => setComposeCaption(e.target.value)}
              placeholder="Write a caption… add #hashtags like #bartender #miami #wedding"
              rows={4}
              aria-label="Caption"
              className="w-full bg-[#FAFAFA] border border-[#E5E7EB] rounded-[12px] px-3.5 py-3 text-[14px] text-[#111827] placeholder:text-[#9CA3AF] outline-none focus:border-[#0A1628]"
            />
            <p className="text-[#9CA3AF] text-[12px] mt-2">Tip: #hashtags make your post discoverable by clients searching for talent.</p>
          </div>
        </div>
      )}

      <BottomTabNav />
    </div>
  );
}
