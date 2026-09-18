import { useEffect, useRef, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { ChevronLeft, Image as ImageIcon, Video, Mic, Send, Square, Trash2 } from 'lucide-react';
import { uploadChatImage, uploadChatVideo, uploadChatVoice, getSignedChatMediaUrl } from '@/lib/storage';
import type { ConversationRow, UserRow, MessageRow } from '@/lib/supabase';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMessages } from '@/hooks/useMessages';
import { ImageCropper } from '@/components/ImageCropper';

type OtherUser = Pick<UserRow, 'id' | 'username' | 'photo_url'>;

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** "3:42 PM" today, "Yesterday 3:42 PM", or "Mon 3:42 PM" — for read receipts. */
function receiptTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const time = timeLabel(iso);
  if (sameDay) return time;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
  const withinWeek = now.getTime() - d.getTime() < 6 * 86_400_000;
  const day = d.toLocaleDateString('en-US', withinWeek ? { weekday: 'short' } : { month: 'short', day: 'numeric' });
  return `${day} ${time}`;
}

/** "Today", "Yesterday", or "Mon, Sep 14" — separators between days in the thread. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Long-press detection for message bubbles (touch and mouse). */
function useLongPress(onLongPress: () => void, ms = 450) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  return {
    onPointerDown: () => { clear(); timer.current = setTimeout(onLongPress, ms); },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); clear(); onLongPress(); },
  };
}

/** Simplified, deterministic waveform bars derived from the recording's byte length — visual only, not a true amplitude analysis. */
function Waveform({ seed }: { seed: number }) {
  const bars = Array.from({ length: 24 }, (_, i) => 6 + ((seed * (i + 3)) % 18));
  return (
    <div className="flex items-center gap-[2px] h-6" aria-hidden>
      {bars.map((h, i) => (
        <span key={i} className="w-[2px] rounded-full bg-current" style={{ height: `${h}px` }} />
      ))}
    </div>
  );
}

/** Chat media is stored by PATH in a private bucket; resolve to a short-lived signed URL before rendering. */
function useSignedUrl(path: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!path) { setUrl(null); return; }
    void getSignedChatMediaUrl(path).then((signed) => { if (!cancelled) setUrl(signed); });
    return () => { cancelled = true; };
  }, [path]);
  return url;
}

function Bubble({ msg, isMine, receipt, otherName, onLongPress }: {
  msg: MessageRow;
  isMine: boolean;
  /** Read receipt line under my latest message ("Read 3:42 PM" / "Delivered"). */
  receipt: 'read' | 'delivered' | null;
  otherName: string;
  onLongPress?: () => void;
}) {
  const bubbleClasses = isMine
    ? 'bg-[#0A1628] text-white rounded-[16px] rounded-br-[4px]'
    : 'bg-[#F3F4F6] text-black rounded-[16px] rounded-bl-[4px]';

  const imageUrl = useSignedUrl(msg.image_url);
  const videoUrl = useSignedUrl(msg.video_url);
  const voiceUrl = useSignedUrl(msg.voice_url);
  const press = useLongPress(() => onLongPress?.());

  // iMessage-style note where the message used to be.
  if (msg.deleted_at) {
    return (
      <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} px-4 mb-1.5`}>
        <div className="max-w-[78%] px-3.5 py-2 rounded-[16px] border border-dashed border-[#D1D5DB] bg-white">
          <p className="text-[13px] italic text-[#9CA3AF] flex items-center gap-1.5">
            <Trash2 size={12} aria-hidden />
            {isMine ? 'You deleted this message' : `${otherName} deleted this message`}
          </p>
        </div>
        <span className="text-[10.5px] text-[#C4C4C4] font-medium mt-1 px-1">{timeLabel(msg.created_at)}</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} px-4 mb-1.5`}>
      <div className={`max-w-[78%] px-3.5 py-2.5 select-none ${bubbleClasses}`}
        {...(isMine && onLongPress ? press : {})}
        role={isMine && onLongPress ? 'button' : undefined}
        aria-label={isMine && onLongPress ? 'Hold for message options' : undefined}>
        {msg.text && <p className="text-[14.5px] leading-[1.4] whitespace-pre-wrap break-words">{msg.text}</p>}
        {msg.image_url && (
          imageUrl
            ? <img src={imageUrl} alt="Shared photo" loading="lazy"
                className="rounded-[10px] max-w-full max-h-[260px] object-cover" />
            : <div className="w-40 h-40 rounded-[10px] bg-black/10 animate-pulse" aria-label="Loading photo" />
        )}
        {msg.video_url && (
          videoUrl
            ? <video src={videoUrl} controls className="rounded-[10px] max-w-full max-h-[260px]" />
            : <div className="w-40 h-40 rounded-[10px] bg-black/10 animate-pulse" aria-label="Loading video" />
        )}
        {msg.voice_url && (
          <div className="flex items-center gap-2 py-1">
            <Waveform seed={msg.id.charCodeAt(0)} />
            {voiceUrl && <audio src={voiceUrl} controls className="h-8 max-w-[160px]" />}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 mt-1 px-1">
        <span className="text-[10.5px] text-[#AAAAAA] font-medium">{timeLabel(msg.created_at)}</span>
      </div>
      {/* Read receipt — only under my most recent message, like iMessage */}
      {isMine && receipt && (
        <p className="text-[11px] font-semibold mt-0.5 px-1 text-[#6B7280]" aria-live="polite">
          {receipt === 'read' && msg.read_at ? `Read ${receiptTime(msg.read_at)}` : 'Delivered'}
        </p>
      )}
    </div>
  );
}

/** Bottom sheet with actions for one of my messages. */
function MessageActionSheet({ msg, onDelete, onClose, busy }: {
  msg: MessageRow; onDelete: () => void; onClose: () => void; busy: boolean;
}) {
  const preview = msg.text
    ? msg.text.length > 80 ? `${msg.text.slice(0, 80)}…` : msg.text
    : msg.image_url ? 'Photo' : msg.video_url ? 'Video' : msg.voice_url ? 'Voice message' : 'Message';
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40"
      role="dialog" aria-modal="true" aria-label="Message options"
      onClick={() => { if (!busy) onClose(); }}>
      <div className="w-full max-w-[390px] bg-white rounded-t-[20px] px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+16px)]"
        onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-[#E5E7EB] mx-auto mb-4" />
        <p className="text-[#6B7280] text-[12px] truncate mb-3 px-1">“{preview}”</p>
        <button type="button" onClick={onDelete} disabled={busy}
          className="w-full h-[50px] rounded-[10px] bg-red-50 border border-red-200 text-[#EF4444] font-bold text-[15px] flex items-center justify-center gap-2 disabled:opacity-60">
          <Trash2 size={16} aria-hidden />
          {busy ? 'Deleting…' : 'Delete message'}
        </button>
        <p className="text-[#9CA3AF] text-[11px] text-center mt-2 mb-3">
          Both of you will see “deleted this message” in its place.
        </p>
        <button type="button" onClick={onClose} disabled={busy}
          className="w-full h-[48px] rounded-[10px] bg-white border border-[#DBDBDB] text-[#111827] font-semibold text-[15px]">
          Cancel
        </button>
      </div>
    </div>
  );
}

function ChatSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-4 py-4" aria-hidden>
      {[1, 2, 3, 4].map((n) => (
        <div key={n} className={`flex ${n % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
          <div className="w-1/2 h-9 rounded-2xl bg-[#F3F4F6] animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function ChatScreen() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { messages, isLoading, hasMore, loadOlder, markRead, sendMessage, deleteMessage } = useMessages(conversationId ?? null);

  const [conversation, setConversation] = useState<ConversationRow | null>(null);
  const [actionMsg, setActionMsg] = useState<MessageRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [other, setOther]     = useState<OtherUser | null>(null);
  const [shiftTitle, setShiftTitle] = useState<string | null>(null);
  const [text, setText]       = useState('');
  const [isSending, setSending] = useState(false);
  const [isRecording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  // ImageCropper state — set when the user picks a photo; cleared after crop/cancel
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  // Ref keeps cropSrc visible to the unmount cleanup (closure captures stale state otherwise)
  const cropSrcRef = useRef<string | null>(null);
  useEffect(() => { cropSrcRef.current = cropSrc; }, [cropSrc]);
  // Unmount: revoke any lingering crop URL if the user navigates away mid-crop
  useEffect(() => () => { if (cropSrcRef.current) URL.revokeObjectURL(cropSrcRef.current); }, []);

  const scrollRef      = useRef<HTMLDivElement>(null);
  const bottomRef       = useRef<HTMLDivElement>(null);
  const fileInputRef    = useRef<HTMLInputElement>(null);
  const videoInputRef   = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunks   = useRef<Blob[]>([]);
  const recordTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!conversationId || !user?.id) return;
    (async () => {
      const conv = await apiClient(user.id).get<ConversationRow & {
        participant_a_username?: string | null; participant_a_photo?: string | null;
        participant_b_username?: string | null; participant_b_photo?: string | null;
        shift_title?: string | null;
      }>(`/conversations/${conversationId}`).catch(() => null);
      if (!conv) return;
      setConversation(conv as ConversationRow);
      const isA = conv.participant_a_id === user.id;
      const otherId = isA ? conv.participant_b_id : conv.participant_a_id;
      const otherUsername = isA ? conv.participant_b_username : conv.participant_a_username;
      const otherPhoto = isA ? conv.participant_b_photo : conv.participant_a_photo;
      setOther(otherId ? { id: otherId, username: otherUsername ?? null, photo_url: otherPhoto ?? null } as OtherUser : null);
      setShiftTitle(conv.shift_title ?? null);
    })();
  }, [conversationId, user?.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);
  // Mark the other person's unread messages as read whenever they appear on
  // screen (initial load and live arrivals) — this is what sends them a receipt.
  useEffect(() => {
    if (isLoading || !user?.id) return;
    const ids = messages
      .filter((m) => m.sender_id !== user.id && !m.read_at && !m.deleted_at)
      .map((m) => m.id);
    if (ids.length) void markRead(ids);
  }, [isLoading, messages, user?.id, markRead]);

  async function handleDelete() {
    if (!actionMsg || deleting) return;
    setDeleting(true);
    const err = await deleteMessage(actionMsg.id);
    setDeleting(false);
    if (err) { showToast(err, 'error'); return; }
    setActionMsg(null);
  }

  // The receipt line belongs under my LAST message only.
  const lastMine = [...messages].reverse().find((m) => m.sender_id === user?.id && !m.deleted_at);
  const otherName = other?.username ? `@${other.username}` : 'They';

  function handleScroll() {
    if (scrollRef.current && scrollRef.current.scrollTop < 40 && hasMore) void loadOlder();
  }

  async function handleSendText() {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    setSending(true);
    setText('');
    const { error } = await sendMessage({ text: trimmed });
    if (error) setText(trimmed);
    setSending(false);
  }

  async function handleFileChange(kind: 'image' | 'video', e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user?.id || !conversationId || isSending) return;

    if (kind === 'image') {
      // Route images through the cropper before uploading
      if (cropSrc) URL.revokeObjectURL(cropSrc);
      setCropSrc(URL.createObjectURL(file));
      return;
    }

    // Videos are uploaded directly (cropping video is not practical)
    setSending(true);
    const url = await uploadChatVideo(conversationId, file);
    if (url) await sendMessage({ videoUrl: url });
    setSending(false);
  }

  async function handleCropDone(blob: Blob, previewUrl: string) {
    // Revoke both the source URL and the preview URL produced by ImageCropper
    // (we upload directly to Supabase and don't need the local preview URL in chat)
    URL.revokeObjectURL(previewUrl);
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    if (!user?.id || !conversationId) return;
    setSending(true);
    const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
    const url = await uploadChatImage(conversationId, file);
    if (url) await sendMessage({ imageUrl: url });
    setSending(false);
  }

  function cancelCrop() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  async function startRecording() {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordedChunks.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        const blob = new Blob(recordedChunks.current, { type: 'audio/webm' });
        setRecording(false);
        setRecordSeconds(0);
        if (blob.size > 0 && user?.id && conversationId) {
          setSending(true);
          const url = await uploadChatVoice(conversationId, blob);
          if (url) await sendMessage({ voiceUrl: url });
          setSending(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      // Mic permission denied or unavailable — silently no-op, button returns to idle state.
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      {/* Image cropper — shown as a full-screen overlay when user picks a photo */}
      {cropSrc && (
        <ImageCropper
          imageSrc={cropSrc}
          defaultAspect={1}
          onDone={(blob, previewUrl) => void handleCropDone(blob, previewUrl)}
          onCancel={cancelCrop}
        />
      )}
      {/* Header */}
      <div className="flex items-center gap-3 px-3 pt-[calc(env(safe-area-inset-top)+16px)] pb-3 border-b border-[#DBDBDB] bg-white flex-shrink-0">
        <button type="button" aria-label="Back to messages" onClick={() => navigate('/messages')}
          className="w-9 h-9 flex items-center justify-center active:opacity-60 transition-opacity flex-shrink-0">
          <ChevronLeft size={22} className="text-black" />
        </button>
        {other?.photo_url
          ? <img src={other.photo_url} alt={other.username ?? 'User'} className="w-9 h-9 rounded-full object-cover border border-[#DBDBDB]" />
          : <div className="w-9 h-9 rounded-full bg-[#F3F4F6] border border-[#DBDBDB] flex items-center justify-center">
              <span className="text-[#737373] font-bold text-[13px]">{(other?.username ?? '?').slice(0, 1).toUpperCase()}</span>
            </div>}
        <div className="min-w-0">
          <p className="text-black font-bold text-[15px] truncate">{other?.username ? `@${other.username}` : 'Conversation'}</p>
          {shiftTitle && <p className="text-[#737373] text-[11px] font-medium truncate">📌 {shiftTitle}</p>}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto py-3">
        {isLoading ? (
          <ChatSkeleton />
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 px-8 text-center">
            <p className="text-black font-semibold text-[15px]">Say hello 👋</p>
            <p className="text-[#737373] text-[13px]">Your messages are private between you and {other?.username ? `@${other.username}` : 'this user'}.</p>
          </div>
        ) : (
          <>
            {hasMore && <p className="text-center text-[#AAAAAA] text-[11px] py-2">Scroll up for earlier messages</p>}
            {messages.map((m, i) => {
              const isMine = m.sender_id === user?.id;
              const prev = messages[i - 1];
              const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
              return (
                <div key={m.id}>
                  {newDay && (
                    <p className="text-center text-[#9CA3AF] text-[11px] font-semibold py-2 select-none">
                      {dayLabel(m.created_at)}
                    </p>
                  )}
                  <Bubble msg={m} isMine={isMine} otherName={otherName}
                    receipt={lastMine && m.id === lastMine.id ? (m.read_at ? 'read' : 'delivered') : null}
                    onLongPress={isMine && !m.deleted_at ? () => setActionMsg(m) : undefined} />
                </div>
              );
            })}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {actionMsg && (
        <MessageActionSheet msg={actionMsg} busy={deleting}
          onDelete={() => void handleDelete()} onClose={() => setActionMsg(null)} />
      )}

      {/* Composer */}
      <div className="flex-shrink-0 border-t border-[#DBDBDB] px-3 py-2.5 bg-white">
        {isRecording ? (
          <div className="flex items-center gap-3 px-1">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" aria-hidden />
            <span className="text-black text-[13px] font-medium tabular-nums w-10">
              {`0:${recordSeconds.toString().padStart(2, '0')}`}
            </span>
            <div className="flex-1 text-[#0A1628]"><Waveform seed={recordSeconds + 1} /></div>
            <button type="button" aria-label="Stop recording" onClick={stopRecording}
              className="w-10 h-10 rounded-full bg-[#0A1628] flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform">
              <Square size={15} className="text-white fill-white" />
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handleFileChange('image', e)} />
            <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => void handleFileChange('video', e)} />
            <button type="button" aria-label="Attach photo" disabled={isSending} onClick={() => fileInputRef.current?.click()}
              className="w-9 h-9 flex items-center justify-center flex-shrink-0 active:opacity-60 transition-opacity disabled:opacity-40">
              <ImageIcon size={19} className="text-[#0A1628]" />
            </button>
            <button type="button" aria-label="Attach video" disabled={isSending} onClick={() => videoInputRef.current?.click()}
              className="w-9 h-9 flex items-center justify-center flex-shrink-0 active:opacity-60 transition-opacity disabled:opacity-40">
              <Video size={19} className="text-[#0A1628]" />
            </button>

            <div className="flex-1 flex items-center bg-[#F3F4F6] border border-[#DBDBDB] rounded-[20px] px-3.5 min-h-[38px]">
              <input type="text" value={text} onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleSendText(); }}
                placeholder="Message…" aria-label="Message text" disabled={isSending}
                className="flex-1 bg-transparent text-black text-[14px] placeholder:text-[#AAAAAA] focus:outline-none py-2" />
            </div>

            {text.trim() ? (
              <button type="button" aria-label="Send message" disabled={isSending} onClick={() => void handleSendText()}
                className="w-9 h-9 rounded-full bg-[#0A1628] flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform disabled:opacity-50">
                <Send size={15} className="text-white" />
              </button>
            ) : (
              <button type="button" aria-label="Hold to record voice message"
                onPointerDown={() => void startRecording()} onPointerUp={stopRecording} onPointerLeave={() => { if (isRecording) stopRecording(); }}
                className="w-9 h-9 rounded-full bg-[#0A1628] flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform">
                <Mic size={15} className="text-white" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
