import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { StoryGroup } from '@/hooks/useStories';

const STORY_MS = 5000; // time each story stays on screen

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/**
 * Full-screen Instagram-style story player.
 *
 * Plays every story in the chosen author's group in sequence, then rolls into
 * the next author's group. Tap the right side to advance, the left side to go
 * back; press-and-hold pauses. Segmented progress bars sit across the top.
 */
export function StoryViewer({
  groups, startGroupIndex, onClose, onView, onDelete,
}: {
  groups: StoryGroup[];
  startGroupIndex: number;
  onClose: () => void;
  onView: (storyId: string) => void;
  onDelete?: (storyId: string) => void;
}) {
  const [gi, setGi] = useState(startGroupIndex);
  const [si, setSi] = useState(0);
  const [progress, setProgress] = useState(0); // 0..1 for the current story
  const [paused, setPaused] = useState(false);

  const group = groups[gi];
  const story = group?.stories[si];

  // Advance helpers ---------------------------------------------------------
  const goNext = useCallback(() => {
    setProgress(0);
    const g = groups[gi];
    if (g && si + 1 < g.stories.length) {
      setSi(si + 1);              // next story in the same group
    } else if (gi + 1 < groups.length) {
      setGi(gi + 1); setSi(0);    // first story of the next group
    } else {
      onClose();                  // end of the line
    }
  }, [groups, gi, si, onClose]);

  const goPrev = useCallback(() => {
    setProgress(0);
    if (si > 0) { setSi(si - 1); return; }
    if (gi > 0) { setGi(gi - 1); setSi(0); return; }
    setSi(0); // already at the very first story — just restart it
  }, [gi, si]);

  // Mark the current story as seen -----------------------------------------
  useEffect(() => {
    if (story && !story.viewed_by_me) onView(story.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  // Auto-advance timer (rAF so the bar animates smoothly) -------------------
  useEffect(() => {
    if (!story || paused) return;
    let raf = 0;
    let start = performance.now();
    let elapsedBefore = progress * STORY_MS;
    const tick = (now: number) => {
      const elapsed = elapsedBefore + (now - start);
      const p = Math.min(1, elapsed / STORY_MS);
      setProgress(p);
      if (p >= 1) { goNext(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id, paused, gi, si]);

  // Keyboard support (desktop) ---------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, onClose]);

  if (!group || !story) return null;

  const initials = (group.username ?? '??').slice(0, 2).toUpperCase();

  return (
    <div className="fixed inset-0 z-[120] bg-black flex items-center justify-center select-none">
      <div className="relative w-full max-w-[430px] h-full max-h-[100dvh] bg-black overflow-hidden">
        {/* The photo */}
        <img
          src={story.photo_url}
          alt={story.caption ?? 'Story'}
          className="absolute inset-0 w-full h-full object-contain bg-black"
          draggable={false}
        />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

        {/* Progress segments */}
        <div className="absolute top-2 left-2 right-2 flex gap-1 z-20">
          {group.stories.map((s, i) => (
            <div key={s.id} className="flex-1 h-[2.5px] rounded-full bg-white/35 overflow-hidden">
              <div className="h-full bg-white rounded-full"
                style={{ width: i < si ? '100%' : i === si ? `${progress * 100}%` : '0%' }} />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-5 left-3 right-3 flex items-center gap-2.5 z-20">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-white/20 flex items-center justify-center flex-shrink-0 ring-1 ring-white/40">
            {group.photo_url
              ? <img src={group.photo_url} alt="" className="w-full h-full object-cover" />
              : <span className="text-white text-[11px] font-bold">{initials}</span>}
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-white font-semibold text-[14px] truncate">
              {group.is_me ? 'Your story' : `@${group.username ?? 'user'}`}
            </span>
            <span className="text-white/70 text-[12px] flex-shrink-0">{timeAgo(story.created_at)}</span>
          </div>
          <div className="ml-auto flex items-center gap-1 flex-shrink-0">
            {group.is_me && onDelete && (
              <button type="button" aria-label="Delete story"
                onClick={(e) => { e.stopPropagation(); onDelete(story.id); }}
                className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95">
                <Trash2 size={18} className="text-white" />
              </button>
            )}
            <button type="button" aria-label="Close stories"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95">
              <X size={22} className="text-white" />
            </button>
          </div>
        </div>

        {/* Tap zones — left = back, right = forward. Hold to pause. */}
        <button type="button" aria-label="Previous"
          onClick={goPrev}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerLeave={() => setPaused(false)}
          className="absolute left-0 top-0 bottom-0 w-1/3 z-10" />
        <button type="button" aria-label="Next"
          onClick={goNext}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerLeave={() => setPaused(false)}
          className="absolute right-0 top-0 bottom-0 w-2/3 z-10" />

        {/* Desktop arrows */}
        <button type="button" aria-hidden onClick={goPrev}
          className="hidden sm:flex absolute left-1 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/15 items-center justify-center">
          <ChevronLeft size={20} className="text-white" />
        </button>
        <button type="button" aria-hidden onClick={goNext}
          className="hidden sm:flex absolute right-1 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/15 items-center justify-center">
          <ChevronRight size={20} className="text-white" />
        </button>

        {/* Caption */}
        {story.caption && (
          <div className="absolute bottom-8 left-4 right-4 z-20">
            <p className="text-white text-[15px] leading-snug drop-shadow-lg">{story.caption}</p>
          </div>
        )}
      </div>
    </div>
  );
}
