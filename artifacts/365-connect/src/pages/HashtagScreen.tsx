import { useParams, useLocation } from 'wouter';
import { ChevronLeft, Hash } from 'lucide-react';
import { useHashtagFeed, useToggleLike } from '@/hooks/useFeed';
import { PostCard } from '@/components/PostCard';
import { BottomTabNav } from '@/components/BottomTabNav';

export function HashtagScreen() {
  const params = useParams();
  const tag = (params.tag as string) ?? '';
  const [, navigate] = useLocation();
  const { posts, isLoading } = useHashtagFeed(tag);
  const toggleLike = useToggleLike();

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col pb-[56px]">
      <div className="sticky top-0 z-20 bg-white border-b border-[#EFEFEF] px-4 pt-[52px] pb-3 flex items-center gap-3">
        <button type="button" aria-label="Back"
          onClick={() => { if (window.history.length > 1) window.history.back(); else navigate('/explore'); }}
          className="w-9 h-9 rounded-full bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-center flex-shrink-0">
          <ChevronLeft size={18} aria-hidden className="text-[#0A1628]" />
        </button>
        <div className="flex items-center gap-1.5 min-w-0">
          <Hash size={18} aria-hidden className="text-[#0A1628] flex-shrink-0" />
          <h1 className="text-[#111827] font-bold text-[19px] truncate">{tag}</h1>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto">
        {isLoading && <div className="h-[320px] bg-[#FAFAFA] animate-pulse" />}
        {!isLoading && posts.length === 0 && (
          <div className="mx-4 mt-8 rounded-[12px] bg-[#FAFAFA] border border-[#DBDBDB] px-6 py-12 text-center">
            <p className="text-[#111827] text-[15px] font-semibold">No posts yet for #{tag}</p>
            <p className="text-[#737373] text-[13px] mt-1">Be the first to tag a post with #{tag}.</p>
          </div>
        )}
        {!isLoading && posts.map((post) => (
          <PostCard key={post.id} post={post}
            onLike={(id) => toggleLike.mutate(id)}
            onOpenComments={(id) => navigate(`/post/${id}`)} />
        ))}
      </main>

      <BottomTabNav />
    </div>
  );
}
