import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, MessageCircle } from 'lucide-react';
import { useLocation } from 'wouter';
import { BottomTabNav } from '@/components/BottomTabNav';
import { useConversations, type ConversationWithOther } from '@/hooks/useConversations';
import { relativeTime } from '@/hooks/useNotifications';

function displayName(conv: ConversationWithOther): string {
  return conv.other?.username ? `@${conv.other.username}` : 'Unknown user';
}

function Avatar({ photoUrl, alt }: { photoUrl: string | null; alt: string }) {
  return photoUrl
    ? <img src={photoUrl} alt={alt} loading="lazy" decoding="async"
        className="w-12 h-12 rounded-full object-cover flex-shrink-0 border border-[#DBDBDB]" />
    : <div aria-hidden className="w-12 h-12 rounded-full bg-[#F3F4F6] border border-[#DBDBDB] flex items-center justify-center flex-shrink-0">
        <span className="text-[#737373] font-bold text-[16px]">{alt.slice(1, 2).toUpperCase()}</span>
      </div>;
}

function ConversationRow({ conv, onTap }: { conv: ConversationWithOther; onTap: () => void }) {
  const name    = displayName(conv);
  const preview = conv.last_message || 'Say hello 👋';
  const time    = conv.last_message_at ? relativeTime(conv.last_message_at) : '';

  return (
    <motion.button type="button" aria-label={`Open conversation with ${name}`}
      whileTap={{ backgroundColor: '#FAFAFA' }} onClick={onTap}
      className="w-full flex items-center gap-3.5 px-4 py-3.5 border-b border-[#DBDBDB] text-left transition-colors active:bg-[#FAFAFA]">
      <Avatar photoUrl={conv.other?.photo_url ?? null} alt={name} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <p className={`text-[15px] leading-snug truncate pr-2 ${conv.unread ? 'text-black font-bold' : 'text-black font-semibold'}`}>
            {name}
          </p>
          <p className={`text-[12px] flex-shrink-0 ${conv.unread ? 'text-[#0A1628] font-semibold' : 'text-[#737373]'}`}>
            {time}
          </p>
        </div>
        {conv.shiftTitle && (
          <p className="text-[#737373] text-[11px] font-medium mb-0.5 truncate">📌 {conv.shiftTitle}</p>
        )}
        <div className="flex items-center justify-between gap-2">
          <p className={`text-[13px] truncate ${conv.unread ? 'text-[#262626]' : 'text-[#737373]'}`}>
            {preview}
          </p>
          {conv.unread && <span aria-label="Unread messages" className="w-2.5 h-2.5 rounded-full bg-[#0A1628] flex-shrink-0" />}
        </div>
      </div>
    </motion.button>
  );
}

function MessagesSkeleton() {
  return (
    <div aria-hidden>
      {[1, 2, 3, 4, 5].map((n) => (
        <div key={n} className="flex items-center gap-3.5 px-4 py-3.5 border-b border-[#DBDBDB]">
          <div className="w-12 h-12 rounded-full bg-[#F3F4F6] animate-pulse flex-shrink-0" />
          <div className="flex-1 flex flex-col gap-2">
            <div className="w-1/2 h-3.5 rounded bg-[#F3F4F6] animate-pulse" />
            <div className="w-3/4 h-3 rounded bg-[#F3F4F6] animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MessagesScreen() {
  const [, navigate] = useLocation();
  const { items, isLoading } = useConversations();
  const [search, setSearch] = useState('');

  const filtered = items.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return displayName(c).toLowerCase().includes(q) || (c.last_message ?? '').toLowerCase().includes(q);
  });

  const unreadCount = items.filter((c) => c.unread).length;

  return (
    <div className="flex flex-col min-h-[100dvh] bg-white">
      {/* Header */}
      <div className="px-4 pt-[52px] pb-3 border-b border-[#DBDBDB] bg-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-black font-bold text-[22px] tracking-tight">Messages</h1>
            {unreadCount > 0 && (
              <p className="text-[#0A1628] text-[12px] font-medium mt-0.5">{unreadCount} unread</p>
            )}
          </div>
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-2.5 bg-[#F3F4F6] border border-[#DBDBDB] rounded-[8px] px-3 h-[38px]">
          <Search size={14} aria-hidden className="text-[#737373] flex-shrink-0" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search messages…" aria-label="Search conversations"
            className="flex-1 bg-transparent text-black text-[14px] placeholder:text-[#AAAAAA] focus:outline-none" />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto pb-[64px]">
        {isLoading ? (
          <MessagesSkeleton />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 px-8 text-center">
            <div className="w-16 h-16 rounded-full bg-[#F3F4F6] border border-[#DBDBDB] flex items-center justify-center">
              <MessageCircle size={26} aria-hidden className="text-[#737373]" />
            </div>
            <p className="text-black font-semibold text-[16px]">
              {items.length === 0 ? 'No conversations yet' : 'No conversations found'}
            </p>
            {items.length === 0 && (
              <p className="text-[#737373] text-[13px]">
                Message a worker or client from their profile, or a group chat opens automatically once a shift is confirmed.
              </p>
            )}
          </div>
        ) : (
          filtered.map((conv) => (
            <ConversationRow key={conv.id} conv={conv} onTap={() => navigate(`/messages/${conv.id}`)} />
          ))
        )}
      </div>

      <BottomTabNav />
    </div>
  );
}
