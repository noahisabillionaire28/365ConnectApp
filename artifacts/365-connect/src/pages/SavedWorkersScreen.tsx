import { useLocation } from 'wouter';
import { ChevronLeft, Bookmark, Star, BadgeCheck } from 'lucide-react';
import { useSavedWorkers, type SavedWorker } from '@/hooks/useSavedWorkers';
import { BottomTabNav } from '@/components/BottomTabNav';

function SavedCard({ w, onTap }: { w: SavedWorker; onTap: () => void }) {
  const initials = (w.username ?? 'W').slice(0, 2).toUpperCase();
  return (
    <button type="button" onClick={onTap}
      className="w-full flex items-center gap-3 bg-white border border-[#E5E7EB] rounded-[14px] px-4 py-3 text-left active:bg-[#FAFAFA]">
      <div className="w-12 h-12 rounded-full overflow-hidden bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center flex-shrink-0">
        {w.photo_url
          ? <img src={w.photo_url} alt={w.username ?? 'Worker'} className="w-full h-full object-cover" />
          : <span className="text-[14px] font-bold text-[#0A1628]">{initials}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[#111827] font-bold text-[14px] truncate">@{w.username ?? 'worker'}</p>
          {w.is_pro && <BadgeCheck size={14} aria-label="Pro" className="text-[#FFD700] flex-shrink-0" />}
        </div>
        <p className="text-[#6B7280] text-[12px] truncate">
          {w.primary_job_type ?? 'Worker'}{w.hourly_rate != null ? ` · $${w.hourly_rate}/hr` : ''}
        </p>
      </div>
      {w.rating > 0 && (
        <span className="flex items-center gap-1 text-[#111827] text-[13px] font-semibold flex-shrink-0">
          <Star size={13} aria-hidden className="fill-amber-400 text-amber-400" />
          {Number(w.rating).toFixed(1)}
        </span>
      )}
    </button>
  );
}

export function SavedWorkersScreen() {
  const [, navigate] = useLocation();
  const { workers, isLoading } = useSavedWorkers();

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col pb-[56px]">
      <div className="sticky top-0 z-20 bg-white border-b border-[#EFEFEF] px-4 pt-[52px] pb-3 flex items-center gap-3">
        <button type="button" aria-label="Back"
          onClick={() => { if (window.history.length > 1) window.history.back(); else navigate('/home'); }}
          className="w-9 h-9 rounded-full bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-center flex-shrink-0">
          <ChevronLeft size={18} aria-hidden className="text-[#0A1628]" />
        </button>
        <h1 className="text-[#111827] font-bold text-[20px]">Saved Workers</h1>
      </div>

      <main className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {isLoading && [1, 2, 3].map((n) => (
          <div key={n} className="h-[72px] bg-[#FAFAFA] border border-[#E5E7EB] rounded-[14px] animate-pulse" />
        ))}
        {!isLoading && workers.length === 0 && (
          <div className="mt-8 rounded-[12px] bg-[#FAFAFA] border border-[#DBDBDB] px-6 py-12 text-center">
            <Bookmark size={26} aria-hidden className="text-[#DBDBDB] mx-auto mb-2" />
            <p className="text-[#111827] text-[15px] font-semibold">No saved workers yet</p>
            <p className="text-[#737373] text-[13px] mt-1">Tap the bookmark on a worker's profile to save them here for fast re-hire.</p>
          </div>
        )}
        {!isLoading && workers.map((w) => (
          <SavedCard key={w.id} w={w} onTap={() => navigate(`/worker/${w.username}`)} />
        ))}
      </main>

      <BottomTabNav />
    </div>
  );
}
