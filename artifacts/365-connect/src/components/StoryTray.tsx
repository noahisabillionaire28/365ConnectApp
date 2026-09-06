import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { uploadStoryPhoto } from '@/lib/storage';
import {
  useStoryTray, useCreateStory, useMarkStoryViewed, useDeleteStory, type StoryGroup,
} from '@/hooks/useStories';
import { StoryViewer } from '@/components/StoryViewer';

/** One avatar with a gradient (unseen) or grey (seen) ring. */
function Ring({ group, onTap }: { group: StoryGroup; onTap: () => void }) {
  const initials = (group.username ?? '??').slice(0, 2).toUpperCase();
  return (
    <button type="button" onClick={onTap}
      aria-label={group.is_me ? 'View your story' : `View @${group.username}'s story`}
      className="flex flex-col items-center gap-1 flex-shrink-0 w-[70px]">
      <span
        className={`w-[64px] h-[64px] rounded-full p-[2.5px] flex items-center justify-center ${
          group.has_unseen
            ? 'bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]'
            : 'bg-[#DBDBDB]'
        }`}>
        <span className="w-full h-full rounded-full bg-white p-[2px] flex items-center justify-center overflow-hidden">
          {group.photo_url ? (
            <img src={group.photo_url} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            <span className="w-full h-full rounded-full bg-[#EFEFEF] flex items-center justify-center text-[#6B7280] font-bold text-[15px]">
              {initials}
            </span>
          )}
        </span>
      </span>
      <span className="text-[11px] text-[#262626] font-medium truncate max-w-[64px]">
        {group.is_me ? 'Your story' : group.username}
      </span>
    </button>
  );
}

/**
 * Horizontal story tray for the top of the Explore feed.
 * Always leads with a "Your story" add tile, then rings for people you follow.
 */
export function StoryTray() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { groups } = useStoryTray();
  const createStory = useCreateStory();
  const markViewed  = useMarkStoryViewed();
  const deleteStory = useDeleteStory();

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [viewerAt, setViewerAt] = useState<number | null>(null);

  const myGroup = groups.find((g) => g.is_me) ?? null;
  const otherGroups = groups.filter((g) => !g.is_me);
  const myAvatar = myGroup?.photo_url ?? user?.imageUrl ?? null;

  async function handlePick(file: File | undefined) {
    if (!file || !user?.id || uploading) return;
    setUploading(true);
    try {
      const url = await uploadStoryPhoto(user.id, file);
      await createStory.mutateAsync({ photo_url: url, caption: null });
      showToast('Added to your story! It disappears in 24 hours.');
    } catch {
      showToast('Could not post your story — try again.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function openMine() {
    if (myGroup) {
      const idx = groups.findIndex((g) => g.is_me);
      setViewerAt(idx);
    } else {
      fileRef.current?.click();
    }
  }

  return (
    <>
      <div className="flex gap-1 px-3 py-3 overflow-x-auto scrollbar-none border-b border-[#EFEFEF]"
        style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* Your story — add tile */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0 w-[70px]">
          <button type="button" onClick={openMine} disabled={uploading}
            aria-label={myGroup ? 'View your story' : 'Add to your story'}
            className="relative w-[64px] h-[64px] rounded-full">
            <span className={`w-[64px] h-[64px] rounded-full p-[2.5px] flex items-center justify-center ${
              myGroup?.has_unseen
                ? 'bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]'
                : 'bg-[#DBDBDB]'
            }`}>
              <span className="w-full h-full rounded-full bg-white p-[2px] flex items-center justify-center overflow-hidden">
                {myAvatar ? (
                  <img src={myAvatar} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span className="w-full h-full rounded-full bg-[#EFEFEF]" />
                )}
              </span>
            </span>
            <span className="absolute bottom-0 right-0 w-[20px] h-[20px] rounded-full bg-[#0095F6] border-2 border-white flex items-center justify-center">
              <Plus size={12} className="text-white" strokeWidth={3} />
            </span>
          </button>
          <span className="text-[11px] text-[#262626] font-medium">
            {uploading ? 'Posting…' : 'Your story'}
          </span>
        </div>

        {/* Followed users' stories */}
        {otherGroups.map((g) => (
          <Ring key={g.user_id} group={g}
            onTap={() => setViewerAt(groups.findIndex((x) => x.user_id === g.user_id))} />
        ))}
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => void handlePick(e.target.files?.[0])} />

      {viewerAt !== null && groups[viewerAt] && (
        <StoryViewer
          groups={groups}
          startGroupIndex={viewerAt}
          onClose={() => setViewerAt(null)}
          onView={(id) => markViewed.mutate(id)}
          onDelete={(id) => {
            deleteStory.mutate(id, {
              onSuccess: () => { showToast('Story deleted.'); setViewerAt(null); },
            });
          }}
        />
      )}
    </>
  );
}
