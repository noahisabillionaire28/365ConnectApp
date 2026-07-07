import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, ChevronLeft, ImagePlus, ArrowUp,
  CheckCheck, Users,
} from 'lucide-react';
import { BottomTabNav } from '@/components/BottomTabNav';
import {
  ME,
  MOCK_CONVERSATIONS,
  type Conversation,
  type Message,
  type Participant,
} from '@/data/mockMessages';

/* ── Helpers ────────────────────────────────────────────────────────────────── */
function getOtherParticipant(conv: Conversation): Participant { return conv.participants[0]; }
function getDisplayName(conv: Conversation): string {
  if (conv.isGroup) return conv.groupName ?? 'Group Chat';
  return getOtherParticipant(conv).displayName;
}
function getSubtitle(conv: Conversation): string {
  if (!conv.isGroup) return `@${getOtherParticipant(conv).username}`;
  return `${conv.participants.length + 1} members`;
}
function getLastMessage(messages: Message[]): Message | undefined { return messages[messages.length - 1]; }
function getLastPreview(messages: Message[]): string {
  const last = getLastMessage(messages);
  if (!last) return '';
  if (last.imageUrl && last.text) return `📷 ${last.text}`;
  if (last.imageUrl) return '📷 Photo';
  return last.text ?? '';
}
function getLastTimestamp(messages: Message[]): string { return getLastMessage(messages)?.timestamp ?? ''; }
function isFromMe(msg: Message): boolean { return msg.senderId === ME.id; }
function senderName(senderId: string, participants: Participant[]): string {
  if (senderId === ME.id) return 'You';
  return participants.find((p) => p.id === senderId)?.displayName ?? 'Unknown';
}

/* ── Avatars ────────────────────────────────────────────────────────────────── */
function SingleAvatar({ participant, size = 48 }: { participant: Participant; size?: number }) {
  return (
    <img src={participant.photoUrl} alt={participant.displayName} loading="lazy" decoding="async"
      className="rounded-full object-cover flex-shrink-0 border border-[#DBDBDB]"
      style={{ width: size, height: size }} />
  );
}

function GroupAvatar({ participants }: { participants: Participant[] }) {
  const shown = participants.slice(0, 4);
  return (
    <div className="rounded-full overflow-hidden grid flex-shrink-0 border border-[#DBDBDB]"
      style={{ width: 48, height: 48, gridTemplateColumns: '1fr 1fr' }} aria-label="Group conversation">
      {shown.map((p) => (
        <img key={p.id} src={p.photoUrl} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
      ))}
    </div>
  );
}

/* ── Conversation row ───────────────────────────────────────────────────────── */
function ConversationRow({ conv, messages, unread, onTap }: {
  conv: Conversation; messages: Message[]; unread: boolean; onTap: () => void;
}) {
  const name    = getDisplayName(conv);
  const preview = getLastPreview(messages);
  const time    = getLastTimestamp(messages);
  const isMe    = getLastMessage(messages)?.senderId === ME.id;

  return (
    <motion.button type="button" aria-label={`Open conversation with ${name}`}
      whileTap={{ backgroundColor: '#FAFAFA' }} onClick={onTap}
      className="w-full flex items-center gap-3.5 px-4 py-3.5 border-b border-[#DBDBDB] text-left transition-colors active:bg-[#FAFAFA]">
      {conv.isGroup ? <GroupAvatar participants={conv.participants} /> : <SingleAvatar participant={getOtherParticipant(conv)} />}

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <p className={`text-[15px] leading-snug truncate pr-2 ${unread ? 'text-black font-bold' : 'text-black font-semibold'}`}>
            {name}
          </p>
          <p className={`text-[12px] flex-shrink-0 ${unread ? 'text-[#0095F6] font-semibold' : 'text-[#737373]'}`}>
            {time}
          </p>
        </div>
        {!conv.isGroup && (
          <p className="text-[#737373] text-[11px] font-medium mb-0.5 truncate">
            @{getOtherParticipant(conv).username}
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <p className={`text-[13px] truncate ${unread ? 'text-[#262626]' : 'text-[#737373]'}`}>
            {isMe && !unread ? `You: ${preview}` : preview}
          </p>
          {unread && <span aria-label="Unread messages" className="w-2.5 h-2.5 rounded-full bg-[#0095F6] flex-shrink-0" />}
        </div>
      </div>
    </motion.button>
  );
}

/* ── Conversation list ──────────────────────────────────────────────────────── */
function ConversationListScreen({ convMessages, convUnread, onOpen }: {
  convMessages: Record<string, Message[]>; convUnread: Record<string, boolean>; onOpen: (id: string) => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = MOCK_CONVERSATIONS.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return getDisplayName(c).toLowerCase().includes(q) ||
      getLastPreview(convMessages[c.id] ?? []).toLowerCase().includes(q);
  });

  const unreadCount = Object.values(convUnread).filter(Boolean).length;

  return (
    <div className="flex flex-col min-h-[100dvh] bg-white">
      {/* Header */}
      <div className="px-4 pt-[52px] pb-3 border-b border-[#DBDBDB] bg-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-black font-bold text-[22px] tracking-tight">Messages</h1>
            {unreadCount > 0 && (
              <p className="text-[#0095F6] text-[12px] font-medium mt-0.5">{unreadCount} unread</p>
            )}
          </div>
          <button type="button" aria-label="Search conversations"
            className="w-9 h-9 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center">
            <Search size={15} aria-hidden className="text-[#737373]" />
          </button>
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-2.5 bg-[#FAFAFA] border border-[#DBDBDB] rounded-[8px] px-3 h-[38px]">
          <Search size={14} aria-hidden className="text-[#737373] flex-shrink-0" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search messages…" aria-label="Search conversations"
            className="flex-1 bg-transparent text-black text-[14px] placeholder:text-[#AAAAAA] focus:outline-none" />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto pb-[64px]">
        {filtered.length === 0
          ? <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
              <p className="text-[#737373] text-[14px]">No conversations found</p>
            </div>
          : filtered.map((conv) => (
              <ConversationRow key={conv.id} conv={conv}
                messages={convMessages[conv.id] ?? []}
                unread={convUnread[conv.id] ?? false}
                onTap={() => onOpen(conv.id)} />
            ))}
      </div>

      <BottomTabNav />
    </div>
  );
}

/* ── Read receipt ───────────────────────────────────────────────────────────── */
function ReadReceipt({ status }: { status: 'sent' | 'read' }) {
  return (
    <CheckCheck size={13} aria-label={status === 'read' ? 'Read' : 'Sent'}
      className={`flex-shrink-0 ${status === 'read' ? 'text-[#0095F6]' : 'text-[#AAAAAA]'}`} />
  );
}

/* ── Message bubble ─────────────────────────────────────────────────────────── */
function MessageBubble({ msg, showSender, senderLabel, senderPhoto }: {
  msg: Message; showSender: boolean; senderLabel: string; senderPhoto?: string;
}) {
  const mine = isFromMe(msg);

  // Plain div — no entrance animation.
  // A motion.div with initial/animate here stalls mid-animation because
  // the parent ChatScreen container is itself animating (spring slide-in from
  // x:100%), causing the browser to throttle rAF for partially off-screen
  // children. This left every bubble stuck at opacity≈0.26, scale≈0.978.
  return (
    <div className={`flex items-end gap-2 mb-1.5 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>

      {!mine && (
        <div className="w-7 flex-shrink-0">
          {showSender && senderPhoto
            ? <img src={senderPhoto} alt={senderLabel} loading="lazy" decoding="async"
                className="w-7 h-7 rounded-full object-cover border border-[#DBDBDB]" />
            : <div className="w-7 h-7" />}
        </div>
      )}

      <div className={`flex flex-col max-w-[72%] ${mine ? 'items-end' : 'items-start'}`}>
        {showSender && !mine && (
          <p className="text-[#737373] text-[11px] font-medium mb-1 ml-1">{senderLabel}</p>
        )}

        {(msg.imageUrl || msg.text) && (
          <div className={`overflow-hidden rounded-[18px] ${
            mine
              ? 'bg-black rounded-br-[4px]'
              : 'bg-[#EFEFEF] rounded-bl-[4px]'
          }`} style={{ maxWidth: 260 }}>
            {msg.imageUrl && (
              <img src={msg.imageUrl} alt="Shared image" loading="lazy" decoding="async"
                className="w-full object-cover block" style={{ maxHeight: 200 }} />
            )}
            {msg.text && (
              <p className={`text-[15px] leading-[1.45] px-3.5 py-2.5 ${
                mine ? 'text-white' : 'text-black'
              } ${msg.imageUrl ? (mine ? 'border-t border-white/10' : 'border-t border-[#DBDBDB]') : ''}`}>
                {msg.text}
              </p>
            )}
          </div>
        )}

        <div className={`flex items-center gap-1 mt-0.5 px-1 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
          <p className="text-[#AAAAAA] text-[10px]">{msg.timestamp}</p>
          {mine && <ReadReceipt status={msg.status} />}
        </div>
      </div>
    </div>
  );
}

/* ── Date divider ───────────────────────────────────────────────────────────── */
function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-5 px-4" role="separator" aria-label={label}>
      <div className="flex-1 h-px bg-[#DBDBDB]" />
      <p className="text-[#737373] text-[11px] font-medium">{label}</p>
      <div className="flex-1 h-px bg-[#DBDBDB]" />
    </div>
  );
}

/* ── Chat header ────────────────────────────────────────────────────────────── */
function ChatHeader({ conv, onBack }: { conv: Conversation; onBack: () => void }) {
  const name  = getDisplayName(conv);
  const sub   = getSubtitle(conv);
  const isGrp = conv.isGroup;

  return (
    <div className="flex items-center gap-3 px-3 pt-[52px] pb-3 border-b border-[#DBDBDB] bg-white">
      <button type="button" aria-label="Back to messages list" onClick={onBack}
        className="w-9 h-9 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center flex-shrink-0">
        <ChevronLeft size={18} aria-hidden className="text-black" />
      </button>

      {isGrp ? <GroupAvatar participants={conv.participants} /> : <SingleAvatar participant={getOtherParticipant(conv)} size={38} />}

      <div className="flex-1 min-w-0">
        <p className="text-black font-bold text-[15px] leading-tight truncate">{name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {isGrp && <Users size={10} aria-hidden className="text-[#737373] flex-shrink-0" />}
          <p className="text-[#737373] text-[12px] truncate">{sub}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Chat input bar ─────────────────────────────────────────────────────────── */
function ChatInputBar({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  function adjustHeight() {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
    if (taRef.current) taRef.current.style.height = 'auto';
  }

  const canSend = text.trim().length > 0;

  return (
    <div className="px-3 py-3 border-t border-[#DBDBDB] bg-white flex items-end gap-2.5">
      <button type="button" aria-label="Attach a photo"
        className="w-9 h-9 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center flex-shrink-0 mb-0.5">
        <ImagePlus size={16} aria-hidden className="text-[#737373]" />
      </button>

      <div className="flex-1 bg-[#FAFAFA] border border-[#DBDBDB] rounded-[20px] px-4 py-2.5 flex items-end gap-2">
        <textarea ref={taRef} value={text}
          onChange={(e) => { setText(e.target.value); adjustHeight(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Message…" aria-label="Type a message" rows={1}
          className="flex-1 bg-transparent text-black text-[15px] placeholder:text-[#AAAAAA] focus:outline-none resize-none leading-[1.4]"
          style={{ maxHeight: 120 }} />
      </div>

      <motion.button type="button"
        aria-label={canSend ? 'Send message' : 'Send button — type a message first'}
        aria-disabled={!canSend} whileTap={canSend ? { scale: 0.88 } : {}} onClick={handleSend}
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mb-0.5 transition-all duration-150 ${
          canSend ? 'bg-black' : 'bg-[#EFEFEF] border border-[#DBDBDB]'
        }`}>
        <ArrowUp size={17} aria-hidden className={canSend ? 'text-white' : 'text-[#AAAAAA]'} />
      </motion.button>
    </div>
  );
}

/* ── Chat screen ────────────────────────────────────────────────────────────── */
function ChatScreen({ conv, messages, onBack, onSend }: {
  conv: Conversation; messages: Message[]; onBack: () => void; onSend: (text: string) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const participantMap = new Map<string, Participant>(
    [...conv.participants, ME].map((p) => [p.id, p])
  );

  function shouldShowSender(index: number): boolean {
    if (index === 0) return true;
    return messages[index].senderId !== messages[index - 1].senderId;
  }

  const hasYesterday = messages.some((m) => m.timestamp === 'Yesterday');
  const hasToday = messages.some((m) => m.timestamp !== 'Yesterday');

  return (
    <div className="flex flex-col min-h-[100dvh] bg-white">
      <ChatHeader conv={conv} onBack={onBack} />

      <div className="flex-1 overflow-y-auto px-3 pt-4 pb-3" role="log"
        aria-label={`Messages in ${getDisplayName(conv)}`} aria-live="polite">
        {hasYesterday && <DateDivider label="Yesterday" />}

        {messages.map((msg, i) => {
          const isFirst = shouldShowSender(i);
          const sender  = participantMap.get(msg.senderId);
          const prevMsg = messages[i - 1];
          const showTodayDivider =
            hasYesterday && hasToday &&
            prevMsg?.timestamp === 'Yesterday' && msg.timestamp !== 'Yesterday';

          return (
            <div key={msg.id}>
              {showTodayDivider && <DateDivider label="Today" />}
              <MessageBubble msg={msg}
                showSender={isFirst && (conv.isGroup || false)}
                senderLabel={sender ? senderName(msg.senderId, conv.participants) : ''}
                senderPhoto={!isFromMe(msg) ? sender?.photoUrl : undefined} />
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      <ChatInputBar onSend={onSend} />
    </div>
  );
}

/* ── MessagesScreen root ────────────────────────────────────────────────────── */
export function MessagesScreen() {
  const [activeConvId, setActiveConvId] = useState<string | null>(null);

  const [convMessages, setConvMessages] = useState<Record<string, Message[]>>(
    () => Object.fromEntries(MOCK_CONVERSATIONS.map((c) => [c.id, c.messages]))
  );
  const [convUnread, setConvUnread] = useState<Record<string, boolean>>(
    () => Object.fromEntries(MOCK_CONVERSATIONS.map((c) => [c.id, c.unread]))
  );

  const activeConv = MOCK_CONVERSATIONS.find((c) => c.id === activeConvId) ?? null;

  const handleOpen = useCallback((id: string) => {
    setActiveConvId(id);
    setConvUnread((prev) => ({ ...prev, [id]: false }));
  }, []);

  const handleBack = useCallback(() => setActiveConvId(null), []);

  const handleSend = useCallback((text: string) => {
    if (!activeConvId) return;
    const newMsg: Message = {
      id: `msg-${Date.now()}`, senderId: ME.id, text,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      status: 'sent',
    };
    setConvMessages((prev) => ({ ...prev, [activeConvId]: [...(prev[activeConvId] ?? []), newMsg] }));
    setTimeout(() => {
      setConvMessages((prev) => ({
        ...prev,
        [activeConvId]: (prev[activeConvId] ?? []).map((m) =>
          m.id === newMsg.id ? { ...m, status: 'read' } : m
        ),
      }));
    }, 2000);
  }, [activeConvId]);

  return (
    <div className="relative min-h-[100dvh] bg-white overflow-hidden">
      <AnimatePresence mode="wait">
        {activeConv === null ? (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.22, ease: 'easeOut' }}
            className="absolute inset-0">
            <ConversationListScreen convMessages={convMessages} convUnread={convUnread} onOpen={handleOpen} />
          </motion.div>
        ) : (
          <motion.div key={activeConv.id} initial={{ x: '100%' }}
            animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className="absolute inset-0">
            <ChatScreen conv={activeConv} messages={convMessages[activeConv.id] ?? []}
              onBack={handleBack} onSend={handleSend} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
