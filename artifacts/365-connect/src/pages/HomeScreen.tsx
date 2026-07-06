import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MapPin, Clock, Sparkles, Bell, Search, Users, PlusCircle } from 'lucide-react';
import { BottomTabNav } from '@/components/BottomTabNav';
import { STORY_WORKERS, type MockShift } from '@/data/mockFeed';
import { useFeedStore, toggleSaved } from '@/store/feedStore';
import { useShifts } from '@/hooks/useShifts';

/* ─── Stories Row ─────────────────────────────────────────────────────────── */

function StoryBubbleSkeleton() {
  return (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
      <div className="w-[63px] h-[63px] rounded-full bg-[#1A1A1A] animate-pulse" />
      <div className="w-10 h-2.5 rounded-full bg-[#1A1A1A] animate-pulse" />
    </div>
  );
}

function StoryBubble({ worker }: { worker: (typeof STORY_WORKERS)[0] }) {
  const [tapped, setTapped] = useState(false);
  const [, navigate] = useLocation();

  return (
    <button
      type="button"
      aria-label={`View ${worker.username}'s profile`}
      onClick={() => { setTapped(true); navigate(`/worker/${worker.username}`); }}
      className="flex flex-col items-center gap-1.5 flex-shrink-0 active:scale-95 transition-transform"
    >
      <div
        className={`p-[2.5px] rounded-full ${
          worker.isPremium
            ? 'bg-gradient-to-br from-[#FFD700] via-[#FFA500] to-[#FFD700]'
            : tapped
            ? 'bg-[#333]'
            : 'bg-gradient-to-br from-[#444] to-[#2A2A2A]'
        }`}
      >
        <div className="p-[2px] rounded-full bg-black">
          <img
            src={worker.photoUrl}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="w-[58px] h-[58px] rounded-full object-cover"
          />
        </div>
      </div>
      <span className="text-[#9A9A9A] text-[11px] font-medium max-w-[66px] truncate">
        {worker.username}
      </span>
    </button>
  );
}

function StoriesRow() {
  return (
    <div className="py-3">
      <div
        role="list"
        aria-label="Available workers nearby"
        className="flex gap-4 px-4 overflow-x-auto scrollbar-none"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {STORY_WORKERS.map((w) => (
          <div key={w.id} role="listitem">
            <StoryBubble worker={w} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Shift Card skeleton ─────────────────────────────────────────────────── */

function ShiftCardSkeleton() {
  return (
    <div className="mx-4 rounded-[18px] overflow-hidden bg-[#0E0E0E] border border-[#1E1E1E]">
      <div className="w-full h-[220px] bg-[#1A1A1A] animate-pulse" />
      <div className="px-4 pt-3.5 pb-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="w-16 h-7 rounded-lg bg-[#1A1A1A] animate-pulse" />
          <div className="w-32 h-7 rounded-full bg-[#1A1A1A] animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="w-20 h-6 rounded-full bg-[#1A1A1A] animate-pulse" />
          <div className="w-16 h-6 rounded-full bg-[#1A1A1A] animate-pulse" />
          <div className="w-20 h-6 rounded-full bg-[#1A1A1A] animate-pulse" />
        </div>
      </div>
    </div>
  );
}

/* ─── Shift Card ──────────────────────────────────────────────────────────── */

function ShiftCard({ shift, onTap }: { shift: MockShift; onTap: () => void }) {
  const store    = useFeedStore();
  const saved    = store.isSaved(shift.id);
  const spotsLow = shift.spotsAvailable < 3;

  function handleSave(e: React.MouseEvent) {
    e.stopPropagation();
    toggleSaved(shift.id);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTap();
    }
  }

  return (
    <div
      role="article"
      aria-label={`${shift.jobType} shift at ${shift.companyName}, $${shift.payRate} per ${shift.payPeriod}`}
      tabIndex={0}
      onClick={onTap}
      onKeyDown={handleKeyDown}
      className="mx-4 rounded-[18px] overflow-hidden bg-[#0E0E0E] border border-[#1E1E1E] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary active:opacity-90"
    >
      {/* Cover photo */}
      <div className="relative w-full h-[220px] overflow-hidden">
        <img
          src={shift.coverImage}
          alt={`${shift.jobType} at ${shift.companyName}`}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/30" />

        {/* Job type pill */}
        <div className="absolute top-3 left-3">
          <span className="bg-primary text-black text-[11px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wide shadow-lg">
            {shift.jobType}
          </span>
        </div>

        {/* Save button */}
        <button
          type="button"
          aria-label={saved ? `Remove ${shift.companyName} from saved` : `Save ${shift.companyName} shift`}
          aria-pressed={saved}
          onClick={handleSave}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center"
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={saved ? 'saved' : 'unsaved'}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Heart
                size={15}
                aria-hidden="true"
                className={saved ? 'text-primary fill-primary' : 'text-white fill-transparent'}
              />
            </motion.span>
          </AnimatePresence>
        </button>

        {/* Company name overlay */}
        <div className="absolute bottom-3 left-3 right-16">
          <p className="text-white font-bold text-[16px] leading-tight drop-shadow-md truncate">
            {shift.companyName}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin size={11} aria-hidden="true" className="text-white/60 flex-shrink-0" />
            <span className="text-white/60 text-[11px] truncate">{shift.location}</span>
          </div>
        </div>

        {/* AI Match badge */}
        <div className="absolute bottom-3 right-3" aria-label={`${shift.aiMatchPct}% AI match`}>
          <div className="flex items-center gap-1 bg-black/70 backdrop-blur-sm border border-primary/40 rounded-full px-2.5 py-1">
            <Sparkles size={10} aria-hidden="true" className="text-primary" />
            <span className="text-primary text-[11px] font-bold">{shift.aiMatchPct}%</span>
          </div>
        </div>
      </div>

      {/* Card body */}
      <div className="px-4 pt-3.5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-baseline gap-1">
            <span className="text-primary font-bold text-[22px]">${shift.payRate}</span>
            <span className="text-[#666] text-[13px] font-medium">/{shift.payPeriod}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-[#161616] border border-[#2A2A2A] rounded-full px-3 py-1.5">
            <Clock size={12} aria-hidden="true" className="text-[#666]" />
            <span className="text-[#9A9A9A] text-[12px] font-medium">
              {shift.startTime} – {shift.endTime}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-[#161616] border border-[#2A2A2A] rounded-full px-3 py-1.5">
            <span className="text-[#9A9A9A] text-[12px] font-medium">{shift.date}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-[#161616] border border-[#2A2A2A] rounded-full px-3 py-1.5">
            <MapPin size={11} aria-hidden="true" className="text-[#666]" />
            <span className="text-[#9A9A9A] text-[12px] font-medium">{shift.distanceMiles} mi</span>
          </div>
          <div
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 border ${
              spotsLow ? 'bg-red-500/10 border-red-500/30' : 'bg-[#161616] border-[#2A2A2A]'
            }`}
          >
            <Users size={11} aria-hidden="true" className={spotsLow ? 'text-red-400' : 'text-[#666]'} />
            <span className={`text-[12px] font-medium ${spotsLow ? 'text-red-400' : 'text-[#9A9A9A]'}`}>
              {shift.spotsAvailable} spot{shift.spotsAvailable !== 1 ? 's' : ''} left
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Header ──────────────────────────────────────────────────────────────── */

function FeedHeader() {
  const [, navigate] = useLocation();
  return (
    <div className="flex items-center justify-between px-4 pt-4 pb-2">
      <div>
        <h1 className="text-white font-bold text-[22px] leading-tight">
          <span className="text-primary">365</span> Connect
        </h1>
        <p className="text-[#666] text-[12px] font-medium mt-[1px]">Miami Beach, FL</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Post a shift"
          onClick={() => navigate('/post-shift/step1')}
          className="w-9 h-9 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center"
        >
          <PlusCircle size={16} aria-hidden="true" className="text-primary" />
        </button>
        <button
          type="button"
          aria-label="Search shifts"
          onClick={() => navigate('/jobs')}
          className="w-9 h-9 rounded-full bg-[#161616] border border-[#2A2A2A] flex items-center justify-center"
        >
          <Search size={16} aria-hidden="true" className="text-[#9A9A9A]" />
        </button>
        <button
          type="button"
          aria-label="Notifications — 1 unread"
          onClick={() => navigate('/notifications')}
          className="w-9 h-9 rounded-full bg-[#161616] border border-[#2A2A2A] flex items-center justify-center relative"
        >
          <Bell size={16} aria-hidden="true" className="text-[#9A9A9A]" />
          <span aria-hidden="true" className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary border-[1.5px] border-black" />
        </button>
      </div>
    </div>
  );
}

function SectionLabel({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between px-4 mb-3">
      <div>
        <h2 className="text-white font-bold text-[16px]">{title}</h2>
        {sub && <p className="text-[#666] text-[11px] mt-[1px]">{sub}</p>}
      </div>
    </div>
  );
}

/* ─── HomeScreen ──────────────────────────────────────────────────────────── */

export function HomeScreen() {
  const [, navigate]          = useLocation();
  const { shifts, isLoading, error } = useShifts();

  return (
    <div className="min-h-[100dvh] bg-black flex flex-col pb-[72px]">
      {/* Sticky header + stories */}
      <div className="bg-black sticky top-0 z-40 border-b border-[#111]">
        <FeedHeader />
        <div className="border-t border-[#111] pt-1">
          <SectionLabel title="Available Nearby" sub="Tap to view profiles" />
          <StoriesRow />
        </div>
      </div>

      {/* Scrollable feed */}
      <main className="flex-1 overflow-y-auto" aria-label="Shift feed">
        <div className="pt-4 pb-4">
          <SectionLabel title="Shifts For You" sub="Based on your profile · Miami Beach" />

          {/* Loading skeletons */}
          {isLoading && (
            <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading shifts">
              {[1, 2, 3].map((n) => <ShiftCardSkeleton key={n} />)}
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div className="mx-4 rounded-[18px] bg-[#0E0E0E] border border-[#1E1E1E] px-6 py-10 text-center">
              <p className="text-[#555] text-[14px]">Couldn't load shifts right now.</p>
              <p className="text-[#333] text-[12px] mt-1">Pull down to try again.</p>
            </div>
          )}

          {/* Shift feed */}
          {!isLoading && !error && (
            <div className="flex flex-col gap-4" role="feed" aria-label="Available shifts">
              {shifts.map((shift, i) => (
                <motion.div
                  key={shift.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.055, duration: 0.3, ease: 'easeOut' }}
                >
                  <ShiftCard shift={shift} onTap={() => navigate(`/shift/${shift.id}`)} />
                </motion.div>
              ))}

              {shifts.length === 0 && (
                <div className="mx-4 rounded-[18px] bg-[#0E0E0E] border border-[#1E1E1E] px-6 py-10 text-center">
                  <p className="text-[#555] text-[14px]">No open shifts right now.</p>
                  <p className="text-[#333] text-[12px] mt-1">Check back soon or post a shift.</p>
                </div>
              )}
            </div>
          )}

          {!isLoading && shifts.length > 0 && (
            <div className="mt-8 flex flex-col items-center gap-2" aria-hidden="true">
              <div className="w-8 h-[3px] rounded-full bg-[#222]" />
              <p className="text-[#444] text-[12px]">You're all caught up</p>
            </div>
          )}
        </div>
      </main>

      <BottomTabNav />
    </div>
  );
}
