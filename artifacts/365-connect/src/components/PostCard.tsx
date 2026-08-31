import { useState } from 'react';
import { Heart, MessageCircle, MoreHorizontal, Trash2 } from 'lucide-react';
import { useLocation } from 'wouter';
import { relativeTime } from '@/hooks/useNotifications';
import { useDeletePost, type FeedPost } from '@/hooks/useFeed';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/contexts/ToastContext';

/** A single feed post — author header, photo, like + comment actions, caption. */
export function PostCard({ post, onLike, onOpenComments, onDeleted }: {
  post: FeedPost;
  onLike: (id: string) => void;
  onOpenComments: (id: string) => void;
  /** called after this post is deleted (e.g. to navigate away from a detail view) */
  onDeleted?: () => void;
}) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { role } = useProfile();
  const { showToast } = useToast();
  const deletePost = useDeletePost();
  const [menuOpen, setMenuOpen] = useState(false);

  const goAuthor = () => { if (post.author_username) navigate(`/worker/${post.author_username}`); };
  const initials = (post.author_username ?? 'W').slice(0, 2).toUpperCase();
  const canDelete = post.user_id === user?.id || role === 'admin';

  function handleDelete() {
    deletePost.mutate(post.id, {
      onSuccess: () => { showToast('Post deleted.'); setMenuOpen(false); onDeleted?.(); },
      onError: () => { showToast('Could not delete this post.'); setMenuOpen(false); },
    });
  }

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
        {canDelete && (
          <button type="button" aria-label="Post options" onClick={() => setMenuOpen(true)}
            className="w-8 h-8 -mr-1.5 rounded-full flex items-center justify-center text-[#6B7280] active:bg-[#F3F4F6]">
            <MoreHorizontal size={20} aria-hidden />
          </button>
        )}
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

      {/* Options action sheet (Instagram-style) */}
      {menuOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center" role="dialog" aria-modal="true">
          <button type="button" aria-label="Close" onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-[430px] bg-white rounded-t-[18px] pb-6 pt-2 px-3">
            <div className="w-10 h-1 rounded-full bg-[#E5E7EB] mx-auto my-2" aria-hidden />
            <button type="button" onClick={handleDelete} disabled={deletePost.isPending}
              className="w-full flex items-center justify-center gap-2 h-[52px] rounded-[12px] text-[#EF4444] font-bold text-[15px] active:bg-[#FEF2F2] disabled:opacity-60">
              <Trash2 size={18} aria-hidden />
              {deletePost.isPending ? 'Deleting…' : 'Delete post'}
            </button>
            <button type="button" onClick={() => setMenuOpen(false)}
              className="w-full h-[52px] rounded-[12px] text-[#111827] font-semibold text-[15px] active:bg-[#F3F4F6]">
              Cancel
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
