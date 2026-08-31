import { Heart, MessageCircle } from 'lucide-react';
import { useLocation } from 'wouter';
import { relativeTime } from '@/hooks/useNotifications';
import type { FeedPost } from '@/hooks/useFeed';

/** A single feed post — author header, photo, like + comment actions, caption. */
export function PostCard({ post, onLike, onOpenComments }: {
  post: FeedPost;
  onLike: (id: string) => void;
  onOpenComments: (id: string) => void;
}) {
  const [, navigate] = useLocation();
  const goAuthor = () => { if (post.author_username) navigate(`/worker/${post.author_username}`); };
  const initials = (post.author_username ?? 'W').slice(0, 2).toUpperCase();

  return (
    <article className="bg-white border-b border-[#EFEFEF]">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <button type="button" onClick={goAuthor}
          className="w-9 h-9 rounded-full overflow-hidden bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center flex-shrink-0">
          {post.author_photo_url
            ? <img src={post.author_photo_url} alt={post.author_username ?? 'Worker'} className="w-full h-full object-cover" />
            : <span className="text-[12px] font-bold text-[#0A1628]">{initials}</span>}
        </button>
        <button type="button" onClick={goAuthor} className="min-w-0 text-left">
          <p className="text-[#111827] font-semibold text-[13px] truncate">
            {post.author_username ? `@${post.author_username}` : 'Worker'}
          </p>
        </button>
        <span className="ml-auto text-[#9CA3AF] text-[11px] flex-shrink-0">{relativeTime(post.created_at)}</span>
      </div>

      {post.photo_url && (
        <button type="button" onClick={() => onOpenComments(post.id)} className="block w-full" aria-label="Open post">
          <img src={post.photo_url} alt={post.caption ?? 'Post'}
            className="w-full max-h-[520px] object-cover bg-[#FAFAFA]" />
        </button>
      )}

      <div className="flex items-center gap-5 px-4 pt-3">
        <button type="button" onClick={() => onLike(post.id)}
          aria-label={post.liked_by_me ? 'Unlike' : 'Like'} className="flex items-center gap-1.5 active:scale-95 transition-transform">
          <Heart size={22} aria-hidden className={post.liked_by_me ? 'fill-[#EF4444] text-[#EF4444]' : 'text-[#111827]'} />
          <span className="text-[13px] font-semibold text-[#111827]">{post.like_count}</span>
        </button>
        <button type="button" onClick={() => onOpenComments(post.id)}
          aria-label="Comments" className="flex items-center gap-1.5">
          <MessageCircle size={22} aria-hidden className="text-[#111827]" />
          <span className="text-[13px] font-semibold text-[#111827]">{post.comment_count}</span>
        </button>
      </div>

      {post.caption
        ? (
          <p className="px-4 pt-2 pb-3.5 text-[13px] text-[#111827] leading-snug">
            {post.author_username && <span className="font-semibold">@{post.author_username} </span>}
            {post.caption}
          </p>
        )
        : <div className="pb-3.5" />}
    </article>
  );
}
