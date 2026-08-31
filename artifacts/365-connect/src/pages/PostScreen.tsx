import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { ChevronLeft, Send, Trash2 } from 'lucide-react';
import { usePost, useToggleLike } from '@/hooks/useFeed';
import { usePostComments, useAddComment, useDeleteComment, type PostComment } from '@/hooks/usePostComments';
import { PostCard } from '@/components/PostCard';
import { relativeTime } from '@/hooks/useNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';

function CommentRow({ c, canDelete, onDelete }: {
  c: PostComment; canDelete: boolean; onDelete: (id: string) => void;
}) {
  const [, navigate] = useLocation();
  const [confirming, setConfirming] = useState(false);
  const initials = (c.author_username ?? 'W').slice(0, 2).toUpperCase();
  const goAuthor = () => { if (c.author_username) navigate(`/worker/${c.author_username}`); };
  return (
    <div className="flex items-start gap-2.5 px-4 py-3 group">
      <button type="button" onClick={goAuthor}
        className="w-8 h-8 rounded-full overflow-hidden bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center flex-shrink-0">
        {c.author_photo_url
          ? <img src={c.author_photo_url} alt={c.author_username ?? 'Worker'} className="w-full h-full object-cover" />
          : <span className="text-[11px] font-bold text-[#0A1628]">{initials}</span>}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-[#111827] leading-snug">
          <button type="button" onClick={goAuthor} className="font-semibold">
            @{c.author_username ?? 'worker'}
          </button>{' '}
          {c.body}
        </p>
        <div className="flex items-center gap-3 mt-0.5">
          <p className="text-[#9CA3AF] text-[11px]">{relativeTime(c.created_at)}</p>
          {canDelete && (confirming
            ? (
              <>
                <button type="button" onClick={() => onDelete(c.id)} className="text-[#EF4444] text-[11px] font-bold">Delete</button>
                <button type="button" onClick={() => setConfirming(false)} className="text-[#9CA3AF] text-[11px]">Cancel</button>
              </>
            )
            : (
              <button type="button" aria-label="Delete comment" onClick={() => setConfirming(true)}
                className="text-[#9CA3AF]">
                <Trash2 size={13} aria-hidden />
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

export function PostScreen() {
  const params = useParams();
  const postId = params.id as string;
  const [, navigate] = useLocation();
  const { post, isLoading } = usePost(postId);
  const { comments, isLoading: commentsLoading } = usePostComments(postId);
  const addComment = useAddComment(postId);
  const deleteComment = useDeleteComment(postId);
  const toggleLike = useToggleLike();
  const { user } = useAuth();
  const { role } = useProfile();
  const [text, setText] = useState('');

  // A comment can be deleted by its author, the post's author, or an admin.
  const canDeleteComment = (c: PostComment) =>
    c.user_id === user?.id || post?.user_id === user?.id || role === 'admin';

  function submit() {
    const body = text.trim();
    if (!body || addComment.isPending) return;
    addComment.mutate(body, { onSuccess: () => setText('') });
  }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <div className="sticky top-0 z-20 bg-white border-b border-[#EFEFEF] px-4 pt-[52px] pb-3 flex items-center gap-3">
        <button type="button" aria-label="Back"
          onClick={() => { if (window.history.length > 1) window.history.back(); else navigate('/explore'); }}
          className="w-9 h-9 rounded-full bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-center flex-shrink-0">
          <ChevronLeft size={18} aria-hidden className="text-[#0A1628]" />
        </button>
        <h1 className="text-[#111827] font-bold text-[18px]">Post</h1>
      </div>

      <div className="flex-1 overflow-y-auto pb-[76px]">
        {isLoading && <div className="h-[380px] bg-[#FAFAFA] animate-pulse" />}
        {!isLoading && !post && (
          <p className="text-center text-[#737373] text-[14px] py-20">This post is no longer available.</p>
        )}
        {post && (
          <PostCard post={post} onLike={(id) => toggleLike.mutate(id)}
            onOpenComments={() => { /* already here */ }}
            onDeleted={() => { if (window.history.length > 1) window.history.back(); else navigate('/explore'); }} />
        )}

        {post && (
          <div>
            <p className="px-4 pt-3 pb-1 text-[#6B7280] text-[12px] font-bold uppercase tracking-wide">
              {comments.length} comment{comments.length !== 1 ? 's' : ''}
            </p>
            {commentsLoading && <div className="px-4 py-3 text-[#9CA3AF] text-[13px]">Loading…</div>}
            {!commentsLoading && comments.length === 0 && (
              <p className="px-4 py-6 text-[#9CA3AF] text-[13px] text-center">Be the first to comment.</p>
            )}
            {comments.map((c) => (
              <CommentRow key={c.id} c={c}
                canDelete={canDeleteComment(c)}
                onDelete={(id) => deleteComment.mutate(id)} />
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-[#EFEFEF] px-3 py-2.5 flex items-center gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="Add a comment…"
          aria-label="Add a comment"
          className="flex-1 h-[42px] rounded-full bg-[#F3F4F6] border border-[#E5E7EB] px-4 text-[14px] text-[#111827] placeholder:text-[#9CA3AF] outline-none"
        />
        <button type="button" onClick={submit} disabled={!text.trim() || addComment.isPending}
          aria-label="Post comment"
          className="w-[42px] h-[42px] rounded-full bg-[#0A1628] flex items-center justify-center disabled:opacity-40 flex-shrink-0">
          <Send size={17} aria-hidden className="text-white" />
        </button>
      </div>
    </div>
  );
}
