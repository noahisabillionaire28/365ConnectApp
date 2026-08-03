import { useEffect, useRef, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { ChevronLeft, Image as ImageIcon, Video, Mic, Send, Square, Check, CheckCheck } from 'lucide-react';
import { uploadChatImage, uploadChatVideo, uploadChatVoice, getSignedChatMediaUrl } from '@/lib/storage';
import type { ConversationRow, UserRow, MessageRow } from '@/lib/supabase';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages } from '@/hooks/useMessages';
import { ImageCropper } from '@/components/ImageCropper';

type OtherUser = Pick<UserRow, 'id' | 'username' | 'photo_url'>;

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
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

function Bubble({ msg, isMine, showRead }: { msg: MessageRow; isMine: boolean; showRead: boolean }) {
  const bubbleClasses = isMine
    ? 'bg-[#0A1628] text-white rounded-[16px] rounded-br-[4px]'
    : 'bg-[#F3F4F6] text-black rounded-[16px] rounded-bl-[4px]';

  const imageUrl = useSignedUrl(msg.image_url);
  const videoUrl = useSignedUrl(msg.video_url);
  const voiceUrl = useSignedUrl(msg.voice_url);

  return (
    <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} px-4 mb-1.5`}>
      <div className={`max-w-[78%] px-3.5 py-2.5 ${bubbleClasses}`}>
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
        {isMine && showRead && (
          msg.read_at
            ? <CheckCheck size={12} aria-label="Read" className="text-[#0A1628]" />
            : <Check size={12} aria-label="Sent" className="text-[#AAAAAA]" />
        )}
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
  const { messages, isLoading, hasMore, loadOlder, markRead, sendMessage } = useMessages(conversationId ?? null);

  const [conversation, setConversation] = useState<ConversationRow | null>(null);
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
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      const ids = messages.map((m) => (m as { id: string }).id).filter(Boolean);
      if (ids.length) void markRead(ids);
    }
  }, [isLoading, messages.length, markRead]);

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
      <div className="flex items-center gap-3 px-3 pt-[52px] pb-3 border-b border-[#DBDBDB] bg-white flex-shrink-0">
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
            {messages.map((m) => (
              <Bubble key={m.id} msg={m} isMine={m.sender_id === user?.id} showRead={m === messages[messages.length - 1]} />
            ))}
          </>
        )}
        <div ref={bottomRef} />
      </div>

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
