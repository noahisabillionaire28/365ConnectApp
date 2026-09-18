import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Search, MessageCircle, Users, BellOff, Pin, PinOff, Archive, ArchiveRestore, Trash2, Bell, MoreHorizontal } from 'lucide-react';
import { useLocation } from 'wouter';
import { BottomTabNav } from '@/components/BottomTabNav';
import { useConversations, type ConversationWithOther } from '@/hooks/useConversations';
import { relativeTime } from '@/hooks/useNotifications';
import { useToast } from '@/contexts/ToastContext';

type Filter = 'all' | 'groups' | 'archived';

function Avatar({ photoUrl, alt, size = 48 }: { photoUrl: string | null; alt: string; size?: number }) {
  return photoUrl
    ? <img src={photoUrl} alt={alt} loading="lazy" decoding="async" style={{ width: size, height: size }}
        className="rounded-full object-cover flex-shrink-0 border border-[#DBDBDB]" />
    : <div aria-hidden style={{ width: size, height: size }} className="rounded-full bg-[#F3F4F6] border border-[#DBDBDB] flex items-center justify-center flex-shrink-0">
        <span className="text-[#737373] font-bold text-[16px]">{alt.replace('@', '').slice(0, 1).toUpperCase()}</span>
      </div>;
}

/** Stacked member avatars for a shift group chat. */
function GroupAvatar({ conv }: { conv: ConversationWithOther }) {
  const shown = conv.members.slice(0, 3);
  if (shown.length < 2) {
    return <div className="w-12 h-12 rounded-full bg-[#0A1628] flex items-center justify-center flex-shrink-0"><Users size={20} className="text-white" /></div>;
  }
  return (
    <div className="relative w-12 h-12 flex-shrink-0">
      {shown.map((m, i) => (
        <div key={m.id} className="absolute" style={{ left: i * 12, top: i === 1 ? 14 : i === 2 ? 0 : 6 }}>
          <Avatar photoUrl={m.photo_url} alt={m.username ?? '?'} size={30} />
        </div>
      ))}
    </div>
  );
}

function useLongPress(cb: () => void, ms = 450) {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => { if (t.current) { clearTimeout(t.current); t.current = null; } };
  return {
    onPointerDown: () => { clear(); t.current = setTimeout(cb, ms); },
    onPointerUp: clear, onPointerLeave: clear, onPointerCancel: clear, onPointerMove: clear,
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); clear(); cb(); },
  };
}

function ConversationRow({ conv, onTap, onMore }: { conv: ConversationWithOther; onTap: () => void; onMore: () => void }) {
  const name    = conv.displayName;
  const preview = conv.last_message || (conv.isGroup ? 'Shift chat created' : 'Say hello 👋');
  const time    = conv.last_message_at ? relativeTime(conv.last_message_at) : '';
  const press   = useLongPress(onMore);
  const shiftDate = conv.isGroup && conv.shift_start
    ? new Date(conv.shift_start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : null;

  return (
    <motion.div whileTap={{ backgroundColor: '#FAFAFA' }}
      className="w-full flex items-center gap-3.5 px-4 py-3.5 border-b border-[#DBDBDB] transition-colors active:bg-[#FAFAFA] select-none"
      {...press}>
      <button type="button" aria-label={`Open conversation with ${name}`} onClick={onTap} className="flex items-center gap-3.5 flex-1 min-w-0 text-left">
        {conv.isGroup ? <GroupAvatar conv={conv} /> : <Avatar photoUrl={conv.other?.photo_url ?? null} alt={name} />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5 gap-2">
            <p className={`text-[15px] leading-snug truncate flex items-center gap-1.5 ${conv.unread ? 'text-black font-bold' : 'text-black font-semibold'}`}>
              {conv.is_pinned && <Pin size={12} className="text-[#9CA3AF] flex-shrink-0" aria-label="Pinned" />}
              <span className="truncate">{name}</span>
              {conv.is_muted && <BellOff size={12} className="text-[#9CA3AF] flex-shrink-0" aria-label="Muted" />}
            </p>
            <p className={`text-[12px] flex-shrink-0 ${conv.unread ? 'text-[#0A1628] font-semibold' : 'text-[#737373]'}`}>{time}</p>
          </div>
          {conv.isGroup
            ? <p className="text-[#737373] text-[11px] font-medium mb-0.5 truncate">👥 {conv.members.length} members{shiftDate ? ` · ${shiftDate}` : ''}</p>
            : conv.shiftTitle && <p className="text-[#737373] text-[11px] font-medium mb-0.5 truncate">📌 {conv.shiftTitle}</p>}
          <div className="flex items-center justify-between gap-2">
            <p className={`text-[13px] truncate ${conv.unread ? 'text-[#262626]' : 'text-[#737373]'}`}>{preview}</p>
            {conv.unread && (
              <span aria-label={`${conv.unread_count ?? 1} unread`}
                className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#0A1628] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                {conv.unread_count ?? 1}
              </span>
            )}
          </div>
        </div>
      </button>
      <button type="button" aria-label="More options" onClick={onMore} className="w-8 h-8 flex items-center justify-center text-[#9CA3AF] flex-shrink-0">
        <MoreHorizontal size={18} />
      </button>
    </motion.div>
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

function ThreadActionSheet({ conv, onClose, onPref, onDelete }: {
  conv: ConversationWithOther; onClose: () => void;
  onPref: (p: { muted?: boolean; pinned?: boolean; archived?: boolean }) => void; onDelete: () => void;
}) {
  const Row = ({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) => (
    <button type="button" onClick={onClick}
      className={`w-full h-[48px] rounded-[10px] px-3.5 flex items-center gap-3 text-[15px] font-semibold border mb-2 ${
        danger ? 'bg-red-50 border-red-200 text-[#EF4444]' : 'bg-white border-[#E5E7EB] text-[#111827]'}`}>{icon}{label}</button>
  );
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40" role="dialog" aria-modal="true" aria-label="Conversation options" onClick={onClose}>
      <div className="w-full max-w-[390px] bg-white rounded-t-[20px] px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+16px)]" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-[#E5E7EB] mx-auto mb-3" />
        <p className="text-[#111827] font-bold text-[16px] mb-3 truncate">{conv.displayName}</p>
        <Row icon={conv.is_pinned ? <PinOff size={17} /> : <Pin size={17} />} label={conv.is_pinned ? 'Unpin' : 'Pin to top'} onClick={() => onPref({ pinned: !conv.is_pinned })} />
        <Row icon={conv.is_muted ? <Bell size={17} /> : <BellOff size={17} />} label={conv.is_muted ? 'Unmute' : 'Mute notifications'} onClick={() => onPref({ muted: !conv.is_muted })} />
        <Row icon={conv.is_archived ? <ArchiveRestore size={17} /> : <Archive size={17} />} label={conv.is_archived ? 'Unarchive' : 'Archive'} onClick={() => onPref({ archived: !conv.is_archived })} />
        <Row icon={<Trash2 size={17} />} label="Delete conversation" onClick={onDelete} danger />
        <button type="button" onClick={onClose} className="w-full h-[44px] text-[#6B7280] font-semibold text-[14px]">Cancel</button>
      </div>
    </div>
  );
}

export function MessagesScreen() {
  const [, navigate] = useLocation();
  const { showToast } = useToast();
  const [filter, setFilter] = useState<Filter>('all');
  const inbox = useConversations();
  const archive = useConversations({ archived: true });
  const [search, setSearch] = useState('');
  const [actionConv, setActionConv] = useState<ConversationWithOther | null>(null);

  const source = filter === 'archived' ? archive : inbox;
  const filtered = source.items.filter((c) => {
    if (filter === 'groups' && !c.isGroup) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.displayName.toLowerCase().includes(q) || (c.last_message ?? '').toLowerCase().includes(q) || (c.shiftTitle ?? '').toLowerCase().includes(q);
  });
  const unreadCount = inbox.items.reduce((n, c) => n + (c.unread_count ?? 0), 0);

  async function pref(c: ConversationWithOther, p: { muted?: boolean; pinned?: boolean; archived?: boolean }) {
    setActionConv(null);
    const err = await source.setPrefs(c.id, p);
    if (err) { showToast(err, 'error'); return; }
    if (p.archived !== undefined) { showToast(p.archived ? 'Archived.' : 'Moved back to your inbox.'); void inbox.refetch(); void archive.refetch(); }
    else if (p.muted !== undefined) showToast(p.muted ? 'Muted.' : 'Unmuted.');
    else if (p.pinned !== undefined) showToast(p.pinned ? 'Pinned to the top.' : 'Unpinned.');
  }
  async function del(c: ConversationWithOther) {
    setActionConv(null);
    const err = await source.deleteConversation(c.id);
    if (err) showToast(err, 'error'); else showToast('Conversation deleted.');
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-white">
      {/* Header */}
      <div className="px-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-3 border-b border-[#DBDBDB] bg-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-black font-bold text-[22px] tracking-tight">Messages</h1>
            {unreadCount > 0 && <p className="text-[#0A1628] text-[12px] font-medium mt-0.5">{unreadCount} unread</p>}
          </div>
        </div>
        <div className="flex items-center gap-2.5 bg-[#F3F4F6] border border-[#DBDBDB] rounded-[8px] px-3 h-[38px] mb-3">
          <Search size={14} aria-hidden className="text-[#737373] flex-shrink-0" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search messages…" aria-label="Search conversations"
            className="flex-1 bg-transparent text-black text-[14px] placeholder:text-[#AAAAAA] focus:outline-none" />
        </div>
        <div className="flex gap-2" role="tablist" aria-label="Filter conversations">
          {([['all', 'All'], ['groups', 'Shift chats'], ['archived', 'Archived']] as [Filter, string][]).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
              className={`h-8 px-3.5 rounded-full text-[12px] font-bold border ${filter === k ? 'bg-black text-white border-black' : 'bg-white text-black border-[#DBDBDB]'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto pb-[64px]">
        {source.isLoading ? (
          <MessagesSkeleton />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 px-8 text-center">
            <div className="w-16 h-16 rounded-full bg-[#F3F4F6] border border-[#DBDBDB] flex items-center justify-center">
              <MessageCircle size={26} aria-hidden className="text-[#737373]" />
            </div>
            <p className="text-black font-semibold text-[16px]">
              {filter === 'archived' ? 'No archived conversations' : filter === 'groups' ? 'No shift chats yet' : source.items.length === 0 ? 'No conversations yet' : 'No conversations found'}
            </p>
            <p className="text-[#737373] text-[13px]">
              {filter === 'groups'
                ? 'A group chat opens automatically for every shift once workers are confirmed.'
                : filter === 'archived' ? 'Archived threads live here until you unarchive them.'
                : 'Message a worker or client from their profile, or open a shift chat from the Roster.'}
            </p>
          </div>
        ) : (
          filtered.map((conv) => (
            <ConversationRow key={conv.id} conv={conv} onTap={() => navigate(`/messages/${conv.id}`)} onMore={() => setActionConv(conv)} />
          ))
        )}
      </div>

      {actionConv && (
        <ThreadActionSheet conv={actionConv} onClose={() => setActionConv(null)}
          onPref={(p) => void pref(actionConv, p)} onDelete={() => void del(actionConv)} />
      )}

      <BottomTabNav />
    </div>
  );
}
