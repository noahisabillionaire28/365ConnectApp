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

/* ──────────────────────────────────────────────────────────────────────────
   Small helpers
────────────────────────────────────────────────────────────────────────── */
function getOtherParticipant(conv: Conversation): Participant {
  return conv.participants[0];
}

function getDisplayName(conv: Conversation): string {
  if (conv.isGroup) return conv.groupName ?? 'Group Chat';
  return getOtherParticipant(conv).displayName;
}

function getSubtitle(conv: Conversation): string {
  if (!conv.isGroup) return `@${getOtherParticipant(conv).username}`;
  return `${conv.participants.length + 1} members`;
}

function getLastMessage(messages: Message[]): Message | undefined {
  return messages[messages.length - 1];
}

function getLastPreview(messages: Message[]): string {
  const last = getLastMessage(messages);
  if (!last) return '';
  if (last.imageUrl && last.text) return `📷 ${last.text}`;
  if (last.imageUrl) return '📷 Photo';
  return last.text ?? '';
}

function getLastTimestamp(messages: Message[]): string {
  return getLastMessage(messages)?.timestamp ?? '';
}

function isFromMe(msg: Message): boolean {
  return msg.senderId === ME.id;
}

function senderName(senderId: string, participants: Participant[]): string {
  if (senderId === ME.id) return 'You';
  return participants.find((p) => p.id === senderId)?.displayName ?? 'Unknown';
}

/* ──────────────────────────────────────────────────────────────────────────
   Avatar components
────────────────────────────────────────────────────────────────────────── */
function SingleAvatar({ participant, size = 48 }: { participant: Participant; size?: number }) {
  return (
    <img
      src={participant.photoUrl}
      alt={participant.displayName}
      loading="lazy"
      decoding="async"
      className="rounded-full object-cover flex-shrink-0 border border-[#1E1E1E]"
      style={{ width: size, height: size }}
    />
  );
}

function GroupAvatar({ participants }: { participants: Participant[] }) {
  const shown = participants.slice(0, 4);
  return (
    <div
      className="rounded-full overflow-hidden grid flex-shrink-0 border border-[#1E1E1E]"
      style={{ width: 48, height: 48, gridTemplateColumns: '1fr 1fr' }}
      aria-label="Group conversation"
    >
      {shown.map((p) => (
        <img
          key={p.id}
          src={p.photoUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
        />
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Conversation row
────────────────────────────────────────────────────────────────────────── */
function ConversationRow({
  conv,
  messages,
  unread,
  onTap,
}: {
  conv: Conversation;
  messages: Message[];
  unread: boolean;
  onTap: () => void;
}) {
  const name    = getDisplayName(conv);
  const preview = getLastPreview(messages);
  const time    = getLastTimestamp(messages);
  const isMe    = getLastMessage(messages)?.senderId === ME.id;

  return (
    <motion.button
      type="button"
      aria-label={`Open conversation with ${name}`}
      whileTap={{ backgroundColor: '#0A0A0A' }}
      onClick={onTap}
      className="w-full flex items-center gap-3.5 px-4 py-3.5 border-b border-[#0E0E0E] text-left transition-colors active:bg-[#0A0A0A]"
    >
      {/* Avatar */}
      {conv.isGroup
        ? <GroupAvatar participants={conv.participants} />
        : <SingleAvatar participant={getOtherParticipant(conv)} />}

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <p className={`text-[15px] leading-snug truncate pr-2 ${unread ? 'text-white font-bold' : 'text-white font-semibold'}`}>
            {name}
          </p>
          <p className={`text-[12px] flex-shrink-0 ${unread ? 'text-primary font-semibold' : 'text-[#444]'}`}>
            {time}
          </p>
        </div>
        {!conv.isGroup && (
          <p className="text-[#3A3A3A] text-[11px] font-medium mb-0.5 truncate">
            @{getOtherParticipant(conv).username}
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <p className={`text-[13px] truncate ${unread ? 'text-[#888]' : 'text-[#444]'}`}>
            {isMe && !unread ? `You: ${preview}` : preview}
          </p>
          {unread && (
            <span
              aria-label="Unread messages"
              className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0"
            />
          )}
        </div>
      </div>
    </motion.button>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Conversation list screen
────────────────────────────────────────────────────────────────────────── */
function ConversationListScreen({
  convMessages,
  convUnread,
  onOpen,
}: {
  convMessages: Record<string, Message[]>;
  convUnread: Record<string, boolean>;
  onOpen: (id: string) => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = MOCK_CONVERSATIONS.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      getDisplayName(c).toLowerCase().includes(q) ||
      getLastPreview(convMessages[c.id] ?? []).toLowerCase().includes(q)
    );
  });

  const unreadCount = Object.values(convUnread).filter(Boolean).length;

  return (
    <div className="flex flex-col min-h-[100dvh] bg-black">
      {/* Header */}
      <div className="px-4 pt-[52px] pb-3 border-b border-[#111]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-white font-bold text-[22px] tracking-tight">Messages</h1>
            {unreadCount > 0 && (
              <p className="text-primary text-[12px] font-medium mt-0.5">
                {unreadCount} unread
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Search conversations"
            className="w-9 h-9 rounded-full bg-[#111] border border-[#1E1E1E] flex items-center justify-center"
          >
            <Search size={15} aria-hidden className="text-[#555]" />
          </button>
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-2.5 bg-[#0E0E0E] border border-[#1A1A1A] rounded-[12px] px-3 h-[38px]">
          <Search size={14} aria-hidden className="text-[#3A3A3A] flex-shrink-0" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search messages…"
            aria-label="Search conversations"
            className="flex-1 bg-transparent text-white text-[14px] placeholder:text-[#2A2A2A] focus:outline-none"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto pb-[80px]">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
            <p className="text-[#333] text-[14px]">No conversations found</p>
          </div>
        ) : (
          filtered.map((conv) => (
            <ConversationRow
              key={conv.id}
              conv={conv}
              messages={convMessages[conv.id] ?? []}
              unread={convUnread[conv.id] ?? false}
              onTap={() => onOpen(conv.id)}
            />
          ))
        )}
      </div>

      <BottomTabNav />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Message bubble
────────────────────────────────────────────────────────────────────────── */
function ReadReceipt({ status }: { status: 'sent' | 'read' }) {
  return (
    <CheckCheck
      size={13}
      aria-label={status === 'read' ? 'Read' : 'Sent'}
      className={`flex-shrink-0 ${status === 'read' ? 'text-primary' : 'text-[#444]'}`}
    />
  );
}

function MessageBubble({
  msg,
  showSender,
  senderLabel,
  senderPhoto,
}: {
  msg: Message;
  showSender: boolean;
  senderLabel: string;
  senderPhoto?: string;
}) {
  const mine = isFromMe(msg);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={`flex items-end gap-2 mb-1.5 ${mine ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Other sender avatar (shown once per sender streak) */}
      {!mine && (
        <div className="w-7 flex-shrink-0">
          {showSender && senderPhoto ? (
            <img
              src={senderPhoto}
              alt={senderLabel}
              loading="lazy"
              decoding="async"
              className="w-7 h-7 rounded-full object-cover border border-[#1E1E1E]"
            />
          ) : (
            <div className="w-7 h-7" />
          )}
        </div>
      )}

      <div className={`flex flex-col max-w-[72%] ${mine ? 'items-end' : 'items-start'}`}>
        {/* Sender label (group chats only, first in streak) */}
        {showSender && !mine && (
          <p className="text-[#555] text-[11px] font-medium mb-1 ml-1">{senderLabel}</p>
        )}

        {/* Bubble — image (optional) + text together in one container */}
        {(msg.imageUrl || msg.text) && (
          <div
            className={`overflow-hidden rounded-[18px] border border-[#1E1E1E] ${
              mine
                ? 'bg-[#3D3000] rounded-br-[4px]'
                : 'bg-[#1A1A1A] rounded-bl-[4px]'
            }`}
            style={{ maxWidth: 260 }}
          >
            {msg.imageUrl && (
              <img
                src={msg.imageUrl}
                alt="Shared image"
                loading="lazy"
                decoding="async"
                className="w-full object-cover block"
                style={{ maxHeight: 200 }}
              />
            )}
            {msg.text && (
              <p className={`text-white text-[15px] leading-[1.45] px-3.5 py-2.5 ${msg.imageUrl ? 'border-t border-white/5' : ''}`}>
                {msg.text}
              </p>
            )}
          </div>
        )}

        {/* Timestamp + read receipt */}
        <div className={`flex items-center gap-1 mt-0.5 px-1 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
          <p className="text-[#333] text-[10px]">{msg.timestamp}</p>
          {mine && <ReadReceipt status={msg.status} />}
        </div>
      </div>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Date divider
────────────────────────────────────────────────────────────────────────── */
function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-5 px-4" role="separator" aria-label={label}>
      <div className="flex-1 h-px bg-[#111]" />
      <p className="text-[#3A3A3A] text-[11px] font-medium">{label}</p>
      <div className="flex-1 h-px bg-[#111]" />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Chat header
────────────────────────────────────────────────────────────────────────── */
function ChatHeader({
  conv,
  onBack,
}: {
  conv: Conversation;
  onBack: () => void;
}) {
  const name   = getDisplayName(conv);
  const sub    = getSubtitle(conv);
  const isGrp  = conv.isGroup;

  return (
    <div className="flex items-center gap-3 px-3 pt-[52px] pb-3 border-b border-[#111] bg-black">
      <button
        type="button"
        aria-label="Back to messages list"
        onClick={onBack}
        className="w-9 h-9 rounded-full bg-[#0E0E0E] border border-[#1A1A1A] flex items-center justify-center flex-shrink-0"
      >
        <ChevronLeft size={18} aria-hidden className="text-[#666]" />
      </button>

      {isGrp
        ? <GroupAvatar participants={conv.participants} />
        : <SingleAvatar participant={getOtherParticipant(conv)} size={38} />}

      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-[15px] leading-tight truncate">{name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {isGrp && <Users size={10} aria-hidden className="text-[#444] flex-shrink-0" />}
          <p className="text-[#444] text-[12px] truncate">{sub}</p>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Chat input bar
────────────────────────────────────────────────────────────────────────── */
function ChatInputBar({
  onSend,
}: {
  onSend: (text: string) => void;
}) {
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
    <div className="px-3 py-3 border-t border-[#111] bg-black flex items-end gap-2.5">
      {/* Photo attach */}
      <button
        type="button"
        aria-label="Attach a photo"
        className="w-9 h-9 rounded-full bg-[#111] border border-[#1A1A1A] flex items-center justify-center flex-shrink-0 mb-0.5"
      >
        <ImagePlus size={16} aria-hidden className="text-[#555]" />
      </button>

      {/* Text area */}
      <div className="flex-1 bg-[#0E0E0E] border border-[#1A1A1A] rounded-[20px] px-4 py-2.5 flex items-end gap-2">
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => { setText(e.target.value); adjustHeight(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Message…"
          aria-label="Type a message"
          rows={1}
          className="flex-1 bg-transparent text-white text-[15px] placeholder:text-[#2A2A2A] focus:outline-none resize-none leading-[1.4]"
          style={{ maxHeight: 120 }}
        />
      </div>

      {/* Send */}
      <motion.button
        type="button"
        aria-label={canSend ? 'Send message' : 'Send button — type a message first'}
        aria-disabled={!canSend}
        whileTap={canSend ? { scale: 0.88 } : {}}
        onClick={handleSend}
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mb-0.5 transition-all duration-150 ${
          canSend
            ? 'bg-primary shadow-[0_0_10px_rgba(255,215,0,0.3)]'
            : 'bg-[#111] border border-[#1A1A1A]'
        }`}
      >
        <ArrowUp
          size={17}
          aria-hidden
          className={canSend ? 'text-black' : 'text-[#333]'}
        />
      </motion.button>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Chat screen
────────────────────────────────────────────────────────────────────────── */
function ChatScreen({
  conv,
  messages,
  onBack,
  onSend,
}: {
  conv: Conversation;
  messages: Message[];
  onBack: () => void;
  onSend: (text: string) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Build participant map for quick lookup
  const participantMap = new Map<string, Participant>(
    [...conv.participants, ME].map((p) => [p.id, p])
  );

  // Group consecutive messages from same sender for avatar/label display
  function shouldShowSender(index: number): boolean {
    if (index === 0) return true;
    return messages[index].senderId !== messages[index - 1].senderId;
  }

  // Inject date dividers
  const hasYesterday = messages.some((m) => m.timestamp === 'Yesterday');
  const hasToday = messages.some((m) => m.timestamp !== 'Yesterday');

  return (
    <div className="flex flex-col min-h-[100dvh] bg-black">
      <ChatHeader conv={conv} onBack={onBack} />

      {/* Message list */}
      <div
        className="flex-1 overflow-y-auto px-3 pt-4 pb-3"
        role="log"
        aria-label={`Messages in ${getDisplayName(conv)}`}
        aria-live="polite"
      >
        {hasYesterday && <DateDivider label="Yesterday" />}

        {messages.map((msg, i) => {
          const isFirst = shouldShowSender(i);
          const sender  = participantMap.get(msg.senderId);

          // Inject "Today" divider when switching from yesterday to today
          const prevMsg = messages[i - 1];
          const showTodayDivider =
            hasYesterday &&
            hasToday &&
            prevMsg?.timestamp === 'Yesterday' &&
            msg.timestamp !== 'Yesterday';

          return (
            <div key={msg.id}>
              {showTodayDivider && <DateDivider label="Today" />}
              <MessageBubble
                msg={msg}
                showSender={isFirst && (conv.isGroup || false)}
                senderLabel={sender ? senderName(msg.senderId, conv.participants) : ''}
                senderPhoto={!isFromMe(msg) ? sender?.photoUrl : undefined}
              />
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      <ChatInputBar onSend={onSend} />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   MessagesScreen — root
────────────────────────────────────────────────────────────────────────── */
export function MessagesScreen() {
  const [activeConvId, setActiveConvId] = useState<string | null>(null);

  // Local mutable copies of messages + unread state
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

  const handleSend = useCallback(
    (text: string) => {
      if (!activeConvId) return;
      const newMsg: Message = {
        id: `msg-${Date.now()}`,
        senderId: ME.id,
        text,
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        }),
        status: 'sent',
      };
      setConvMessages((prev) => ({
        ...prev,
        [activeConvId]: [...(prev[activeConvId] ?? []), newMsg],
      }));
      // Simulate read receipt after 2s
      setTimeout(() => {
        setConvMessages((prev) => ({
          ...prev,
          [activeConvId]: (prev[activeConvId] ?? []).map((m) =>
            m.id === newMsg.id ? { ...m, status: 'read' } : m
          ),
        }));
      }, 2000);
    },
    [activeConvId]
  );

  return (
    <div className="relative min-h-[100dvh] bg-black overflow-hidden">
      <AnimatePresence mode="wait">
        {activeConv === null ? (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="absolute inset-0"
          >
            <ConversationListScreen
              convMessages={convMessages}
              convUnread={convUnread}
              onOpen={handleOpen}
            />
          </motion.div>
        ) : (
          <motion.div
            key={activeConv.id}
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className="absolute inset-0"
          >
            <ChatScreen
              conv={activeConv}
              messages={convMessages[activeConv.id] ?? []}
              onBack={handleBack}
              onSend={handleSend}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
