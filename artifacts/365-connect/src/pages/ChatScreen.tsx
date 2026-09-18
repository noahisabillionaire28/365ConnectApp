import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  ChevronLeft, Image as ImageIcon, Video, Mic, Send, Square, Trash2, Reply, Copy, Pencil,
  Forward, Smile, Plus, Paperclip, Briefcase, Clock, Search, Info, X, Play, Pause,
  FileText, Download, ArrowDown, Users, BellOff, Bell, Pin, PinOff, Archive, ArchiveRestore,
  Ban, Flag, Images, Check, MapPin, Calendar, Zap, ExternalLink,
} from 'lucide-react';
import { uploadChatImage, uploadChatVideo, uploadChatVoice, uploadChatFile, getSignedChatMediaUrl } from '@/lib/storage';
import type { MessageRow, ConversationMember } from '@/lib/supabase';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useProfile } from '@/hooks/useProfile';
import { useMessages } from '@/hooks/useMessages';
import { useTyping } from '@/hooks/useTyping';
import { useConversations, shapeConversation, type ConversationWithOther } from '@/hooks/useConversations';
import { useMyPostedShifts } from '@/hooks/useMyPostedShifts';
import { ImageCropper } from '@/components/ImageCropper';

/* ─── Formatting helpers ─────────────────────────────────────────────────────── */
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

function fmtBytes(n: number | null | undefined): string {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDuration(s: number): string {
  if (!Number.isFinite(s)) return '0:00';
  const m = Math.floor(s / 60); const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, '0')}`;
}

const REACTIONS = ['👍', '❤️', '😂', '‼️', '❓', '🙌'];
const EMOJI_GRID = [
  '😀','😂','🥲','😍','😎','🤔','😴','😅','🙌','👏','👍','👎','🙏','💪','🔥','✨','🎉','💯','✅','❌',
  '⏰','📍','🚗','🍽️','🍸','🎤','📸','💵','📋','📞','❤️','💙','🖤','🤝','👋','🫡','😬','🤯','😤','🥳',
];

const DEFAULT_QUICK_REPLIES: Record<string, string[]> = {
  worker:  ['On my way 🚗', 'Running 10 min late, sorry!', 'Just arrived 👋', 'Confirmed ✅', 'Where should I park?', 'Who do I check in with?'],
  client:  ['Confirmed ✅', 'Call time is firm, please arrive 15 min early', 'Parking is in the back lot', 'All black, non-slip shoes', 'Text me when you arrive', 'Great work today, thank you!'],
  staffer: ['Confirmed ✅', 'Call time is firm, please arrive 15 min early', 'Parking is in the back lot', 'All black, non-slip shoes', 'Text me when you arrive', 'Great work today, thank you!'],
};

/* ─── Rich text: links, phone numbers, street addresses become tappable ───────── */
const URL_RE   = /\bhttps?:\/\/[^\s<]+|\bwww\.[^\s<]+/gi;
const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
const ADDR_RE  = /\b\d{1,5}\s+(?:[A-Z][a-zA-Z0-9.']*\s){1,5}(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl|Terrace|Ter|Highway|Hwy|Parkway|Pkwy)\b\.?(?:,?\s*(?:Suite|Ste|Unit|Apt|#)\s*[\w-]+)?(?:,?\s*[A-Z][a-zA-Z .]+(?:,\s*[A-Z]{2})?(?:\s+\d{5})?)?/g;

function firstUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(URL_RE);
  if (!m) return null;
  return m[0].startsWith('http') ? m[0] : `https://${m[0]}`;
}

function RichText({ text, mine }: { text: string; mine: boolean }) {
  const linkCls = mine ? 'underline text-white' : 'underline text-[#0A1628]';
  type Part = { s: number; e: number; kind: 'url' | 'phone' | 'addr'; v: string };
  const parts: Part[] = [];
  for (const re of [URL_RE, ADDR_RE, PHONE_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const s = m.index, e = s + m[0].length;
      if (parts.some((p) => s < p.e && p.s < e)) continue; // overlap
      parts.push({ s, e, kind: re === URL_RE ? 'url' : re === ADDR_RE ? 'addr' : 'phone', v: m[0] });
    }
  }
  if (!parts.length) return <>{text}</>;
  parts.sort((a, b) => a.s - b.s);
  const out: React.ReactNode[] = [];
  let cursor = 0;
  parts.forEach((p, i) => {
    if (p.s > cursor) out.push(text.slice(cursor, p.s));
    const href = p.kind === 'url' ? (p.v.startsWith('http') ? p.v : `https://${p.v}`)
      : p.kind === 'phone' ? `tel:${p.v.replace(/[^\d+]/g, '')}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.v)}`;
    out.push(
      <a key={i} href={href} target={p.kind === 'phone' ? undefined : '_blank'} rel="noreferrer"
        className={linkCls} onClick={(e) => e.stopPropagation()}>{p.v}</a>,
    );
    cursor = p.e;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return <>{out}</>;
}

/* ─── Link preview card ──────────────────────────────────────────────────────── */
type Preview = { url: string; title: string | null; description: string | null; image: string | null; site: string | null };
const previewCache = new Map<string, Preview | null>();

function LinkPreview({ url, mine }: { url: string; mine: boolean }) {
  const { user } = useAuth();
  const [p, setP] = useState<Preview | null | undefined>(previewCache.get(url));
  useEffect(() => {
    if (p !== undefined || !user?.id) return;
    let cancelled = false;
    apiClient(user.id).get<Preview | null>(`/link-preview?url=${encodeURIComponent(url)}`)
      .then((v) => { previewCache.set(url, v); if (!cancelled) setP(v); })
      .catch(() => { previewCache.set(url, null); if (!cancelled) setP(null); });
    return () => { cancelled = true; };
  }, [url, user?.id, p]);
  if (!p || (!p.title && !p.image)) return null;
  return (
    <a href={p.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
      className={`mt-2 block rounded-[10px] overflow-hidden border ${mine ? 'border-white/20 bg-white/10' : 'border-[#E5E7EB] bg-white'}`}>
      {p.image && <img src={p.image} alt="" className="w-full max-h-[140px] object-cover" loading="lazy" />}
      <div className="px-3 py-2">
        <p className={`text-[12px] font-bold truncate ${mine ? 'text-white' : 'text-[#111827]'}`}>{p.title ?? p.site}</p>
        {p.description && <p className={`text-[11px] line-clamp-2 ${mine ? 'text-white/80' : 'text-[#6B7280]'}`}>{p.description}</p>}
        <p className={`text-[10px] mt-0.5 flex items-center gap-1 ${mine ? 'text-white/60' : 'text-[#9CA3AF]'}`}><ExternalLink size={10} aria-hidden />{p.site}</p>
      </div>
    </a>
  );
}

/* ─── Voice player (play/pause, scrub, speed) ───────────────────────────────── */
function VoicePlayer({ src, mine }: { src: string; mine: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [rate, setRate] = useState(1);
  const bars = useMemo(() => Array.from({ length: 28 }, (_, i) => 5 + ((src.length * (i + 7)) % 17)), [src]);
  const pct = dur > 0 ? Math.min(1, t / dur) : 0;

  function toggle() {
    const a = ref.current; if (!a) return;
    if (a.paused) { void a.play(); } else { a.pause(); }
  }
  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const a = ref.current; if (!a || !dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    a.currentTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * dur;
  }
  function cycleRate() {
    const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
    setRate(next); if (ref.current) ref.current.playbackRate = next;
  }
  const fg = mine ? 'text-white' : 'text-[#0A1628]';
  return (
    <div className="flex items-center gap-2 py-1 min-w-[210px]" onClick={(e) => e.stopPropagation()}>
      <audio ref={ref} src={src} preload="metadata"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onTimeUpdate={() => setT(ref.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDur(ref.current?.duration ?? 0)}
        onEnded={() => { setPlaying(false); setT(0); }} />
      <button type="button" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${mine ? 'bg-white/20' : 'bg-[#0A1628]/10'}`}>
        {playing ? <Pause size={14} className={fg} /> : <Play size={14} className={`${fg} ml-0.5`} />}
      </button>
      <div className="flex-1 h-7 flex items-center gap-[2px] cursor-pointer" onClick={seek} role="slider" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Seek">
        {bars.map((h, i) => (
          <span key={i} className="w-[2px] rounded-full" style={{ height: `${h}px`, background: 'currentColor', opacity: i / bars.length <= pct ? 1 : 0.35 }} />
        ))}
      </div>
      <span className={`text-[10.5px] tabular-nums ${mine ? 'text-white/80' : 'text-[#6B7280]'}`}>{fmtDuration(playing || t > 0 ? t : dur)}</span>
      <button type="button" onClick={cycleRate} aria-label="Playback speed"
        className={`text-[10px] font-bold px-1.5 h-5 rounded-full ${mine ? 'bg-white/20 text-white' : 'bg-[#0A1628]/10 text-[#0A1628]'}`}>{rate}×</button>
    </div>
  );
}

/* ─── Shift card (a shift shared into the chat) ─────────────────────────────── */
function ShiftCard({ card, mine, onOpen }: { card: NonNullable<MessageRow['shift_card']>; mine: boolean; onOpen: () => void }) {
  const start = new Date(card.start_time);
  const left = Math.max(0, (card.spots_available ?? 1) - (card.spots_filled ?? 0));
  const ended = Date.parse(card.end_time) < Date.now() || card.status === 'cancelled';
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(); }}
      className={`mt-1 w-full text-left rounded-[12px] border p-3 ${mine ? 'border-white/25 bg-white/10' : 'border-[#E5E7EB] bg-white'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${mine ? 'bg-white/20 text-white' : 'bg-[#0A1628] text-white'}`}>
          {card.job_type ?? 'Shift'}
        </span>
        {ended
          ? <span className={`text-[10px] font-bold ${mine ? 'text-white/70' : 'text-[#9CA3AF]'}`}>Ended</span>
          : <span className={`text-[10px] font-bold ${left === 0 ? (mine ? 'text-white/70' : 'text-[#9CA3AF]') : 'text-emerald-500'}`}>{left === 0 ? 'Full' : `${left} spot${left === 1 ? '' : 's'} left`}</span>}
      </div>
      <p className={`font-bold text-[14px] leading-tight ${mine ? 'text-white' : 'text-[#111827]'}`}>{card.title ?? 'Shift'}</p>
      <p className={`text-[12px] mt-1 flex items-center gap-1 ${mine ? 'text-white/85' : 'text-[#6B7280]'}`}>
        <Calendar size={11} aria-hidden />
        {start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })}
      </p>
      {card.location && (
        <p className={`text-[12px] flex items-center gap-1 truncate ${mine ? 'text-white/85' : 'text-[#6B7280]'}`}><MapPin size={11} aria-hidden />{card.location}</p>
      )}
      <div className="flex items-center justify-between mt-2">
        <span className={`font-bold text-[15px] ${mine ? 'text-white' : 'text-[#111827]'}`}>${Number(card.pay_rate ?? 0)}<span className="text-[11px] font-medium">/{card.pay_period ?? 'hr'}</span></span>
        <span className={`text-[12px] font-bold ${mine ? 'text-white' : 'text-[#0A1628]'}`}>View shift →</span>
      </div>
    </button>
  );
}

/* ─── Message bubble ────────────────────────────────────────────────────────── */
function useSignedUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!path) { setUrl(null); return; }
    void getSignedChatMediaUrl(path).then((signed) => { if (!cancelled) setUrl(signed); });
    return () => { cancelled = true; };
  }, [path]);
  return url;
}

function useLongPress(onLongPress: () => void, ms = 420) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moved = useRef(false);
  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  return {
    onPointerDown: () => { moved.current = false; clear(); timer.current = setTimeout(() => { if (!moved.current) onLongPress(); }, ms); },
    onPointerMove: () => { moved.current = true; clear(); },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); clear(); onLongPress(); },
  };
}

function Avatar({ url, name, size = 28 }: { url: string | null | undefined; name: string | null | undefined; size?: number }) {
  return url
    ? <img src={url} alt="" style={{ width: size, height: size }} className="rounded-full object-cover border border-[#DBDBDB] flex-shrink-0" />
    : <div style={{ width: size, height: size }} className="rounded-full bg-[#F3F4F6] border border-[#DBDBDB] flex items-center justify-center flex-shrink-0">
        <span className="text-[#737373] font-bold" style={{ fontSize: Math.max(10, size * 0.4) }}>{(name ?? '?').replace('@', '').slice(0, 1).toUpperCase()}</span>
      </div>;
}

type Receipt = { kind: 'read'; at: string } | { kind: 'delivered' } | { kind: 'group'; readBy: string[]; total: number } | null;

function Bubble({ msg, isMine, isGroup, senderName, senderPhoto, receipt, myId, onLongPress, onReact, onRetry, onDiscard, onOpenShift, onScrollToReply }: {
  msg: MessageRow; isMine: boolean; isGroup: boolean;
  senderName: string; senderPhoto: string | null | undefined;
  receipt: Receipt; myId: string | undefined;
  onLongPress?: () => void; onReact: (emoji: string) => void;
  onRetry?: () => void; onDiscard?: () => void;
  onOpenShift: (id: string) => void; onScrollToReply: (id: string) => void;
}) {
  const imageUrl = useSignedUrl(msg.image_url);
  const videoUrl = useSignedUrl(msg.video_url);
  const voiceUrl = useSignedUrl(msg.voice_url);
  const press = useLongPress(() => onLongPress?.());
  const [showReaders, setShowReaders] = useState(false);
  const url = firstUrl(msg.text);
  const reactions = Object.entries(msg.reactions ?? {}).filter(([, ids]) => ids.length);

  if (msg.kind === 'system') {
    return (
      <p className="text-center text-[#9CA3AF] text-[11.5px] px-6 py-1.5 select-none">{msg.text}</p>
    );
  }

  if (msg.deleted_at) {
    return (
      <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} px-4 mb-1.5`}>
        <div className="max-w-[78%] px-3.5 py-2 rounded-[16px] border border-dashed border-[#D1D5DB] bg-white">
          <p className="text-[13px] italic text-[#9CA3AF] flex items-center gap-1.5">
            <Trash2 size={12} aria-hidden />
            {isMine ? 'You deleted this message' : `${senderName} deleted this message`}
          </p>
        </div>
        <span className="text-[10.5px] text-[#C4C4C4] font-medium mt-1 px-1">{timeLabel(msg.created_at)}</span>
      </div>
    );
  }

  const bubbleClasses = isMine
    ? 'bg-[#0A1628] text-white rounded-[16px] rounded-br-[4px]'
    : 'bg-[#F3F4F6] text-black rounded-[16px] rounded-bl-[4px]';
  const failed = msg._status === 'failed';

  return (
    <div id={`msg-${msg.id}`} className={`flex ${isMine ? 'justify-end' : 'justify-start'} px-4 mb-1.5 gap-2`}>
      {!isMine && isGroup && <div className="self-end mb-5"><Avatar url={senderPhoto} name={senderName} size={26} /></div>}
      <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[80%]`}>
        {!isMine && isGroup && <p className="text-[11px] text-[#6B7280] font-semibold mb-0.5 px-1">{senderName}</p>}
        <div className={`px-3.5 py-2.5 select-none ${bubbleClasses} ${failed ? 'opacity-70' : ''}`}
          {...(onLongPress ? press : {})}
          role={onLongPress ? 'button' : undefined}
          aria-label={onLongPress ? 'Hold for message options' : undefined}>
          {msg.reply_to && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onScrollToReply(msg.reply_to!.id); }}
              className={`w-full text-left mb-1.5 pl-2.5 pr-2 py-1.5 rounded-[8px] border-l-2 ${isMine ? 'border-white/60 bg-white/10' : 'border-[#0A1628] bg-white'}`}>
              <p className={`text-[11px] font-bold ${isMine ? 'text-white/90' : 'text-[#0A1628]'}`}>
                {msg.reply_to.sender_id === myId ? 'You' : `@${msg.reply_to.sender_username ?? 'user'}`}
              </p>
              <p className={`text-[12px] truncate ${isMine ? 'text-white/75' : 'text-[#6B7280]'}`}>{msg.reply_to.preview}</p>
            </button>
          )}
          {msg.text && (
            <p className="text-[14.5px] leading-[1.4] whitespace-pre-wrap break-words select-text">
              <RichText text={msg.text} mine={isMine} />
              {msg.edited_at && <span className={`text-[10px] ml-1.5 ${isMine ? 'text-white/60' : 'text-[#9CA3AF]'}`}>(edited)</span>}
            </p>
          )}
          {url && !msg.image_url && <LinkPreview url={url} mine={isMine} />}
          {msg.image_url && (
            imageUrl
              ? <img src={imageUrl} alt="Shared photo" loading="lazy" className="rounded-[10px] max-w-full max-h-[260px] object-cover mt-1" />
              : <div className="w-40 h-40 rounded-[10px] bg-black/10 animate-pulse" aria-label="Loading photo" />
          )}
          {msg.video_url && (
            videoUrl
              ? <video src={videoUrl} controls className="rounded-[10px] max-w-full max-h-[260px] mt-1" />
              : <div className="w-40 h-40 rounded-[10px] bg-black/10 animate-pulse" aria-label="Loading video" />
          )}
          {msg.voice_url && (voiceUrl ? <VoicePlayer src={voiceUrl} mine={isMine} /> : <div className="w-40 h-8 rounded bg-black/10 animate-pulse" />)}
          {msg.file_url && (
            <a href={msg.file_url} target="_blank" rel="noreferrer" download={msg.file_name ?? undefined}
              onClick={(e) => e.stopPropagation()}
              className={`mt-1 flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 border ${isMine ? 'border-white/25 bg-white/10' : 'border-[#E5E7EB] bg-white'}`}>
              <div className={`w-9 h-9 rounded-[8px] flex items-center justify-center flex-shrink-0 ${isMine ? 'bg-white/20' : 'bg-[#F3F4F6]'}`}>
                <FileText size={17} className={isMine ? 'text-white' : 'text-[#0A1628]'} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-[13px] font-semibold truncate ${isMine ? 'text-white' : 'text-[#111827]'}`}>{msg.file_name ?? 'File'}</p>
                <p className={`text-[11px] ${isMine ? 'text-white/70' : 'text-[#9CA3AF]'}`}>{fmtBytes(msg.file_size)}{msg.file_size ? ' · ' : ''}Tap to open</p>
              </div>
              <Download size={15} className={isMine ? 'text-white/80' : 'text-[#6B7280]'} />
            </a>
          )}
          {msg.shift_card && <ShiftCard card={msg.shift_card} mine={isMine} onOpen={() => onOpenShift(msg.shift_card!.id)} />}
        </div>

        {reactions.length > 0 && (
          <div className={`flex flex-wrap gap-1 -mt-1.5 ${isMine ? 'justify-end mr-1' : 'ml-1'}`}>
            {reactions.map(([emoji, ids]) => {
              const mineToo = !!myId && ids.includes(myId);
              return (
                <button key={emoji} type="button" onClick={() => onReact(emoji)}
                  aria-label={`${emoji} ${ids.length}`}
                  className={`h-6 px-2 rounded-full border text-[12px] flex items-center gap-1 bg-white ${mineToo ? 'border-[#0A1628]' : 'border-[#E5E7EB]'}`}>
                  <span>{emoji}</span>{ids.length > 1 && <span className="text-[11px] font-bold text-[#111827]">{ids.length}</span>}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-1 mt-1 px-1">
          <span className="text-[10.5px] text-[#AAAAAA] font-medium">{timeLabel(msg.created_at)}</span>
        </div>
        {isMine && msg._status === 'sending' && <p className="text-[11px] text-[#9CA3AF] font-semibold px-1">Sending…</p>}
        {isMine && failed && (
          <p className="text-[11px] font-semibold px-1 text-[#EF4444] flex items-center gap-2">
            Not delivered
            <button type="button" className="underline" onClick={onRetry}>Retry</button>
            <button type="button" className="underline text-[#9CA3AF]" onClick={onDiscard}>Delete</button>
          </p>
        )}
        {isMine && !msg._status && receipt && (
          <button type="button" onClick={() => receipt.kind === 'group' && setShowReaders((v) => !v)}
            className="text-[11px] font-semibold mt-0.5 px-1 text-[#6B7280] text-right" aria-live="polite">
            {receipt.kind === 'read' ? `Read ${receiptTime(receipt.at)}`
              : receipt.kind === 'delivered' ? 'Delivered'
              : receipt.readBy.length === 0 ? 'Delivered'
              : receipt.readBy.length >= receipt.total ? `Read by everyone`
              : `Read by ${receipt.readBy.length} of ${receipt.total}`}
            {receipt.kind === 'group' && showReaders && receipt.readBy.length > 0 && (
              <span className="block text-[10.5px] font-medium text-[#9CA3AF]">{receipt.readBy.join(', ')}</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Sheets ────────────────────────────────────────────────────────────────── */
function Sheet({ children, onClose, label, busy }: { children: React.ReactNode; onClose: () => void; label: string; busy?: boolean }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40" role="dialog" aria-modal="true" aria-label={label}
      onClick={() => { if (!busy) onClose(); }}>
      <div className="w-full max-w-[390px] max-h-[85dvh] overflow-y-auto bg-white rounded-t-[20px] px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+16px)]"
        onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-[#E5E7EB] mx-auto mb-4" />
        {children}
      </div>
    </div>
  );
}

function ActionRow({ icon, label, onClick, danger, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`w-full h-[48px] rounded-[10px] px-3.5 flex items-center gap-3 text-[15px] font-semibold border mb-2 disabled:opacity-50 ${
        danger ? 'bg-red-50 border-red-200 text-[#EF4444]' : 'bg-white border-[#E5E7EB] text-[#111827]'}`}>
      {icon}{label}
    </button>
  );
}

function MessageActionSheet({ msg, isMine, myId, onClose, onReact, onReply, onCopy, onForward, onEdit, onDelete, busy }: {
  msg: MessageRow; isMine: boolean; myId: string | undefined; onClose: () => void;
  onReact: (e: string) => void; onReply: () => void; onCopy: () => void; onForward: () => void;
  onEdit: () => void; onDelete: () => void; busy: boolean;
}) {
  const preview = msg.text ? (msg.text.length > 80 ? `${msg.text.slice(0, 80)}…` : msg.text)
    : msg.image_url ? 'Photo' : msg.video_url ? 'Video' : msg.voice_url ? 'Voice message' : msg.file_name ?? (msg.shift_card ? 'Shared shift' : 'Message');
  return (
    <Sheet onClose={onClose} label="Message options" busy={busy}>
      <p className="text-[#6B7280] text-[12px] truncate mb-3 px-1">“{preview}”</p>
      <div className="flex justify-between mb-4 px-1">
        {REACTIONS.map((e) => {
          const on = !!myId && (msg.reactions?.[e] ?? []).includes(myId);
          return (
            <button key={e} type="button" onClick={() => onReact(e)} aria-label={`React ${e}`}
              className={`w-11 h-11 rounded-full text-[22px] flex items-center justify-center border ${on ? 'bg-[#0A1628]/10 border-[#0A1628]' : 'bg-[#F9FAFB] border-[#E5E7EB]'} active:scale-95`}>
              {e}
            </button>
          );
        })}
      </div>
      <ActionRow icon={<Reply size={17} />} label="Reply" onClick={onReply} />
      {msg.text && <ActionRow icon={<Copy size={17} />} label="Copy text" onClick={onCopy} />}
      <ActionRow icon={<Forward size={17} />} label="Forward" onClick={onForward} />
      {isMine && msg.text && !msg.image_url && !msg.video_url && !msg.voice_url && <ActionRow icon={<Pencil size={17} />} label="Edit" onClick={onEdit} />}
      {isMine && <ActionRow icon={<Trash2 size={17} />} label={busy ? 'Deleting…' : 'Delete message'} onClick={onDelete} danger disabled={busy} />}
      <button type="button" onClick={onClose} disabled={busy} className="w-full h-[46px] mt-1 text-[#6B7280] font-semibold text-[14px]">Cancel</button>
    </Sheet>
  );
}

function ForwardSheet({ excludeId, onPick, onClose }: { excludeId: string; onPick: (conversationId: string) => void; onClose: () => void }) {
  const { items, isLoading } = useConversations();
  const list = items.filter((c) => c.id !== excludeId);
  return (
    <Sheet onClose={onClose} label="Forward to">
      <p className="text-[#111827] font-bold text-[16px] mb-3">Forward to…</p>
      {isLoading && <p className="text-[#9CA3AF] text-[13px] py-6 text-center">Loading…</p>}
      {!isLoading && list.length === 0 && <p className="text-[#9CA3AF] text-[13px] py-6 text-center">No other conversations yet.</p>}
      {list.map((c) => (
        <button key={c.id} type="button" onClick={() => onPick(c.id)}
          className="w-full flex items-center gap-3 py-2.5 border-b border-[#F3F4F6] text-left">
          {c.isGroup
            ? <div className="w-9 h-9 rounded-full bg-[#0A1628] flex items-center justify-center"><Users size={16} className="text-white" /></div>
            : <Avatar url={c.other?.photo_url} name={c.other?.username} size={36} />}
          <div className="min-w-0 flex-1">
            <p className="text-[#111827] font-semibold text-[14px] truncate">{c.displayName}</p>
            {c.isGroup && <p className="text-[#9CA3AF] text-[11px]">{c.members.length} members</p>}
          </div>
          <Forward size={15} className="text-[#9CA3AF]" />
        </button>
      ))}
    </Sheet>
  );
}

function ShareShiftSheet({ onPick, onClose }: { onPick: (shiftId: string) => void; onClose: () => void }) {
  const { shifts, isLoading } = useMyPostedShifts();
  const upcoming = shifts.filter((s) => s.status !== 'cancelled' && Date.parse(s.endTimeISO) > Date.now());
  return (
    <Sheet onClose={onClose} label="Share a shift">
      <p className="text-[#111827] font-bold text-[16px] mb-1">Share a shift</p>
      <p className="text-[#6B7280] text-[12px] mb-3">Sends a card they can tap to view and apply.</p>
      {isLoading && <p className="text-[#9CA3AF] text-[13px] py-6 text-center">Loading…</p>}
      {!isLoading && upcoming.length === 0 && <p className="text-[#9CA3AF] text-[13px] py-6 text-center">No upcoming shifts to share. Post one first.</p>}
      {upcoming.map((s) => (
        <button key={s.id} type="button" onClick={() => onPick(s.id)}
          className="w-full flex items-center gap-3 py-2.5 border-b border-[#F3F4F6] text-left">
          <div className="w-9 h-9 rounded-[8px] bg-[#F3F4F6] flex items-center justify-center flex-shrink-0"><Briefcase size={16} className="text-[#0A1628]" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-[#111827] font-semibold text-[14px] truncate">{s.jobType} · {s.companyName}</p>
            <p className="text-[#9CA3AF] text-[11px] truncate">{s.date} · {s.startTime} · ${s.payRate}/{s.payPeriod} · {s.spotsAvailable} left</p>
          </div>
        </button>
      ))}
    </Sheet>
  );
}

type Scheduled = { id: string; text: string; send_at: string };
function ScheduleSheet({ conversationId, draft, onClose, onScheduled }: { conversationId: string; draft: string; onClose: () => void; onScheduled: () => void }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [text, setText] = useState(draft);
  const [when, setWhen] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000); d.setSeconds(0, 0);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [pending, setPending] = useState<Scheduled[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try { setPending(await apiClient(user.id).get<Scheduled[]>(`/messages/schedule/${conversationId}`)); } catch { /* ignore */ }
  }, [user?.id, conversationId]);
  useEffect(() => { void load(); }, [load]);

  async function schedule() {
    if (!user?.id || !text.trim() || busy) return;
    setBusy(true);
    try {
      await apiClient(user.id).post('/messages/schedule', { conversation_id: conversationId, text: text.trim(), send_at: new Date(when).toISOString() });
      showToast(`Scheduled for ${new Date(when).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}.`);
      setText(''); onScheduled(); await load();
    } catch (e) { showToast(e instanceof Error ? e.message : 'Could not schedule.', 'error'); }
    finally { setBusy(false); }
  }
  async function cancel(id: string) {
    if (!user?.id) return;
    try { await apiClient(user.id).delete(`/messages/schedule/${id}`); await load(); } catch { showToast('Could not cancel.', 'error'); }
  }
  return (
    <Sheet onClose={onClose} label="Schedule a message" busy={busy}>
      <p className="text-[#111827] font-bold text-[16px] mb-1">Schedule a message</p>
      <p className="text-[#6B7280] text-[12px] mb-3">It sends automatically at the time you choose (delivered on the next app activity after that time).</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Message…" aria-label="Scheduled message"
        className="w-full bg-[#FAFAFA] border border-[#E5E7EB] rounded-[10px] px-3 py-2.5 text-[14px] text-[#111827] outline-none focus:border-[#0A1628] mb-2" />
      <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Send at"
        className="w-full h-[44px] bg-[#FAFAFA] border border-[#E5E7EB] rounded-[10px] px-3 text-[14px] text-[#111827] outline-none focus:border-[#0A1628] mb-3" />
      <button type="button" onClick={() => void schedule()} disabled={busy || !text.trim()}
        className="w-full h-[48px] rounded-[10px] bg-[#0A1628] text-white font-bold text-[15px] disabled:opacity-50 flex items-center justify-center gap-2">
        <Clock size={16} aria-hidden /> {busy ? 'Scheduling…' : 'Schedule'}
      </button>
      {pending.length > 0 && (
        <div className="mt-4">
          <p className="text-[#6B7280] text-[11px] font-bold uppercase tracking-[0.14em] mb-2">Scheduled</p>
          {pending.map((p) => (
            <div key={p.id} className="flex items-start gap-2 py-2 border-t border-[#F3F4F6]">
              <div className="min-w-0 flex-1">
                <p className="text-[#111827] text-[13px] truncate">{p.text}</p>
                <p className="text-[#9CA3AF] text-[11px]">{new Date(p.send_at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
              </div>
              <button type="button" onClick={() => void cancel(p.id)} className="text-[#EF4444] text-[12px] font-bold">Cancel</button>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}

type MediaItem = { id: string; image_url: string | null; video_url: string | null; file_url: string | null; file_name: string | null; created_at: string };
function GallerySheet({ conversationId, onClose }: { conversationId: string; onClose: () => void }) {
  const { user } = useAuth();
  const [items, setItems] = useState<MediaItem[] | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    apiClient(user.id).get<MediaItem[]>(`/messages/${conversationId}/media`).then(setItems).catch(() => setItems([]));
  }, [user?.id, conversationId]);
  const media = (items ?? []).filter((m) => m.image_url || m.video_url);
  const files = (items ?? []).filter((m) => m.file_url);
  return (
    <Sheet onClose={onClose} label="Shared media">
      <p className="text-[#111827] font-bold text-[16px] mb-3">Photos, videos &amp; files</p>
      {items === null && <p className="text-[#9CA3AF] text-[13px] py-6 text-center">Loading…</p>}
      {items && items.length === 0 && <p className="text-[#9CA3AF] text-[13px] py-6 text-center">Nothing shared yet.</p>}
      {media.length > 0 && (
        <div className="grid grid-cols-3 gap-1 mb-4">
          {media.map((m) => (
            <a key={m.id} href={m.image_url ?? m.video_url ?? '#'} target="_blank" rel="noreferrer" className="aspect-square bg-[#F3F4F6] rounded-[6px] overflow-hidden relative">
              {m.image_url ? <img src={m.image_url} alt="" className="w-full h-full object-cover" loading="lazy" /> : <video src={m.video_url ?? undefined} className="w-full h-full object-cover" />}
              {m.video_url && <span className="absolute bottom-1 right-1 bg-black/60 rounded-full p-1"><Play size={10} className="text-white" /></span>}
            </a>
          ))}
        </div>
      )}
      {files.map((f) => (
        <a key={f.id} href={f.file_url ?? '#'} target="_blank" rel="noreferrer" className="flex items-center gap-3 py-2.5 border-t border-[#F3F4F6]">
          <FileText size={18} className="text-[#0A1628]" />
          <div className="min-w-0 flex-1"><p className="text-[#111827] text-[13px] font-semibold truncate">{f.file_name ?? 'File'}</p>
            <p className="text-[#9CA3AF] text-[11px]">{new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p></div>
          <Download size={15} className="text-[#6B7280]" />
        </a>
      ))}
    </Sheet>
  );
}

const REPORT_TYPES = [
  { key: 'harassment', label: 'Harassment or abuse' }, { key: 'no-show', label: 'No-show' },
  { key: 'payment', label: 'Payment issue' }, { key: 'other', label: 'Something else' },
];

function InfoSheet({ conv, myId, blocked, onClose, onChanged, onOpenGallery, onOpenSearch, onBlockToggle }: {
  conv: ConversationWithOther; myId: string; blocked: boolean; onClose: () => void; onChanged: () => void;
  onOpenGallery: () => void; onOpenSearch: () => void; onBlockToggle: (next: boolean) => Promise<void>;
}) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [, navigate] = useLocation();
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportType, setReportType] = useState('harassment');
  const [reportReason, setReportReason] = useState('');

  async function pref(p: { muted?: boolean; pinned?: boolean; archived?: boolean }, msg: string) {
    if (!user?.id) return;
    setBusy(true);
    try { await apiClient(user.id).patch(`/conversations/${conv.id}/prefs`, p); showToast(msg); onChanged(); }
    catch (e) { showToast(e instanceof Error ? e.message : 'Could not update.', 'error'); }
    finally { setBusy(false); }
  }
  async function del() {
    if (!user?.id) return;
    setBusy(true);
    try { await apiClient(user.id).delete(`/conversations/${conv.id}`); showToast('Conversation deleted.'); navigate('/messages'); }
    catch (e) { showToast(e instanceof Error ? e.message : 'Could not delete.', 'error'); setBusy(false); }
  }
  async function submitReport() {
    if (!user?.id || !conv.other || !reportReason.trim()) return;
    setBusy(true);
    try {
      await apiClient(user.id).post('/disputes', { reported_user_id: conv.other.id, type: reportType, reason: reportReason.trim(), shift_id: conv.shift_id ?? undefined });
      showToast('Report sent. Our team will review it.'); setReporting(false); setReportReason('');
    } catch (e) { showToast(e instanceof Error ? e.message : 'Could not send the report.', 'error'); }
    finally { setBusy(false); }
  }

  return (
    <Sheet onClose={onClose} label="Conversation info" busy={busy}>
      <div className="flex items-center gap-3 mb-4">
        {conv.isGroup
          ? <div className="w-12 h-12 rounded-full bg-[#0A1628] flex items-center justify-center"><Users size={20} className="text-white" /></div>
          : <Avatar url={conv.other?.photo_url} name={conv.other?.username} size={48} />}
        <div className="min-w-0">
          <p className="text-[#111827] font-bold text-[17px] truncate">{conv.displayName}</p>
          <p className="text-[#6B7280] text-[12px] truncate">
            {conv.isGroup ? `${conv.members.length} members` : conv.other?.role ? conv.other.role.charAt(0).toUpperCase() + conv.other.role.slice(1) : ''}
            {conv.shiftTitle && !conv.isGroup ? ` · 📌 ${conv.shiftTitle}` : ''}
          </p>
        </div>
      </div>

      {conv.isGroup && (
        <div className="mb-4">
          <p className="text-[#6B7280] text-[11px] font-bold uppercase tracking-[0.14em] mb-2">Members</p>
          <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto">
            {conv.members.map((m) => (
              <button key={m.id} type="button" onClick={() => m.username && navigate(`/worker/${m.username}`)}
                className="flex items-center gap-2.5 py-1 text-left">
                <Avatar url={m.photo_url} name={m.username} size={30} />
                <span className="text-[#111827] text-[13px] font-semibold">{m.username ? `@${m.username}` : 'Member'}{m.id === myId ? ' (you)' : ''}</span>
                {m.id === conv.shift_owner_id && <span className="text-[10px] font-bold text-[#0A1628] bg-[#0A1628]/10 rounded-full px-2 py-0.5">Manager</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {conv.shift_id && (
        <ActionRow icon={<Briefcase size={17} />} label={conv.isGroup ? 'View shift' : `View shift: ${conv.shiftTitle ?? ''}`} onClick={() => navigate(`/shift/${conv.shift_id}`)} />
      )}
      {!conv.isGroup && conv.other?.username && (
        <ActionRow icon={<Users size={17} />} label="View profile" onClick={() => navigate(`/worker/${conv.other!.username}`)} />
      )}
      <ActionRow icon={<Search size={17} />} label="Search in conversation" onClick={onOpenSearch} />
      <ActionRow icon={<Images size={17} />} label="Photos, videos & files" onClick={onOpenGallery} />
      <ActionRow icon={conv.is_muted ? <Bell size={17} /> : <BellOff size={17} />} label={conv.is_muted ? 'Unmute notifications' : 'Mute notifications'} disabled={busy}
        onClick={() => void pref({ muted: !conv.is_muted }, conv.is_muted ? 'Notifications on.' : 'Muted. You will not get push alerts for this thread.')} />
      <ActionRow icon={conv.is_pinned ? <PinOff size={17} /> : <Pin size={17} />} label={conv.is_pinned ? 'Unpin' : 'Pin to top'} disabled={busy}
        onClick={() => void pref({ pinned: !conv.is_pinned }, conv.is_pinned ? 'Unpinned.' : 'Pinned to the top.')} />
      <ActionRow icon={conv.is_archived ? <ArchiveRestore size={17} /> : <Archive size={17} />} label={conv.is_archived ? 'Unarchive' : 'Archive'} disabled={busy}
        onClick={() => void pref({ archived: !conv.is_archived }, conv.is_archived ? 'Moved back to your inbox.' : 'Archived.')} />
      {!conv.isGroup && conv.other && (
        <>
          <ActionRow icon={<Ban size={17} />} label={blocked ? `Unblock @${conv.other.username ?? 'user'}` : `Block @${conv.other.username ?? 'user'}`} danger={!blocked} disabled={busy}
            onClick={() => { setBusy(true); void onBlockToggle(!blocked).finally(() => setBusy(false)); }} />
          {!reporting
            ? <ActionRow icon={<Flag size={17} />} label="Report" danger onClick={() => setReporting(true)} />
            : (
              <div className="rounded-[12px] border border-red-200 bg-red-50 p-3 mb-2">
                <p className="text-[#111827] font-bold text-[14px] mb-2">Report @{conv.other.username ?? 'user'}</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {REPORT_TYPES.map((t) => (
                    <button key={t.key} type="button" onClick={() => setReportType(t.key)}
                      className={`h-8 px-3 rounded-full text-[12px] font-semibold border ${reportType === t.key ? 'bg-[#0A1628] text-white border-[#0A1628]' : 'bg-white text-[#111827] border-[#E5E7EB]'}`}>{t.label}</button>
                  ))}
                </div>
                <textarea value={reportReason} onChange={(e) => setReportReason(e.target.value)} rows={3} placeholder="What happened?" aria-label="Report details"
                  className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-3 py-2 text-[13px] text-[#111827] outline-none mb-2" />
                <div className="flex gap-2">
                  <button type="button" onClick={() => void submitReport()} disabled={busy || !reportReason.trim()}
                    className="flex-1 h-10 rounded-[8px] bg-[#EF4444] text-white text-[13px] font-bold disabled:opacity-50">Send report</button>
                  <button type="button" onClick={() => setReporting(false)} className="h-10 px-4 rounded-[8px] bg-white border border-[#E5E7EB] text-[13px] font-semibold text-[#111827]">Cancel</button>
                </div>
              </div>
            )}
        </>
      )}
      <ActionRow icon={<Trash2 size={17} />} label="Delete conversation" danger disabled={busy} onClick={() => void del()} />
    </Sheet>
  );
}

/* ─── Quick replies (per-user templates) ────────────────────────────────────── */
function useQuickReplies(role: string | null) {
  const { user } = useAuth();
  const [custom, setCustom] = useState<string[] | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    apiClient(user.id).get<{ quick_replies?: string[] | null }>('/users/me')
      .then((me) => setCustom(Array.isArray(me.quick_replies) && me.quick_replies.length ? me.quick_replies : null))
      .catch(() => {});
  }, [user?.id]);
  const list = custom ?? DEFAULT_QUICK_REPLIES[role ?? 'worker'] ?? DEFAULT_QUICK_REPLIES.worker;
  const save = useCallback(async (next: string[]) => {
    if (!user?.id) return;
    setCustom(next.length ? next : null);
    try { await apiClient(user.id).patch('/users/me', { quick_replies: next }); } catch { /* ignore */ }
  }, [user?.id]);
  return { list, save, isCustom: custom !== null };
}

function QuickRepliesEditor({ list, onSave, onClose }: { list: string[]; onSave: (l: string[]) => void; onClose: () => void }) {
  const [items, setItems] = useState(list);
  const [draft, setDraft] = useState('');
  return (
    <Sheet onClose={onClose} label="Quick replies">
      <p className="text-[#111827] font-bold text-[16px] mb-1">Quick replies</p>
      <p className="text-[#6B7280] text-[12px] mb-3">One-tap messages you send often.</p>
      {items.map((t, i) => (
        <div key={i} className="flex items-center gap-2 py-1.5 border-b border-[#F3F4F6]">
          <p className="flex-1 text-[#111827] text-[13px]">{t}</p>
          <button type="button" aria-label="Remove" onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-[#9CA3AF]"><X size={15} /></button>
        </div>
      ))}
      <div className="flex gap-2 mt-3">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a quick reply…" aria-label="New quick reply"
          className="flex-1 h-[42px] bg-[#FAFAFA] border border-[#E5E7EB] rounded-[10px] px-3 text-[14px] outline-none focus:border-[#0A1628]" />
        <button type="button" disabled={!draft.trim() || items.length >= 12} onClick={() => { setItems([...items, draft.trim()]); setDraft(''); }}
          className="h-[42px] px-4 rounded-[10px] bg-[#0A1628] text-white text-[13px] font-bold disabled:opacity-50">Add</button>
      </div>
      <button type="button" onClick={() => { onSave(items); onClose(); }}
        className="w-full h-[46px] mt-4 rounded-[10px] bg-[#0A1628] text-white font-bold text-[15px]">Save</button>
    </Sheet>
  );
}

/* ─── Chat screen ───────────────────────────────────────────────────────────── */
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
  const profile = useProfile();
  const {
    messages, isLoading, hasMore, readers, loadOlder, markRead, sendMessage, retryMessage, discardFailed,
    deleteMessage, editMessage, react, search,
  } = useMessages(conversationId ?? null);
  const { typingUsers, notifyTyping, stopTyping } = useTyping(conversationId, profile.username);
  const quick = useQuickReplies(profile.role);

  const [conv, setConv] = useState<ConversationWithOther | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [text, setText] = useState('');
  const [isSending, setSending] = useState(false);
  const [isRecording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const cropSrcRef = useRef<string | null>(null);
  useEffect(() => { cropSrcRef.current = cropSrc; }, [cropSrc]);
  useEffect(() => () => { if (cropSrcRef.current) URL.revokeObjectURL(cropSrcRef.current); }, []);

  // Composer modes
  const [replyTo, setReplyTo] = useState<MessageRow | null>(null);
  const [editing, setEditing] = useState<MessageRow | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [showQuick, setShowQuick] = useState(false);

  // Sheets
  const [actionMsg, setActionMsg] = useState<MessageRow | null>(null);
  const [forwardMsg, setForwardMsg] = useState<MessageRow | null>(null);
  const [shareShift, setShareShift] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [gallery, setGallery] = useState(false);
  const [info, setInfo] = useState(false);
  const [editQuick, setEditQuick] = useState(false);
  const [busy, setBusy] = useState(false);

  // Search mode
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MessageRow[] | null>(null);

  // Scrolling
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const prevLenRef = useRef(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadConversation = useCallback(async () => {
    if (!conversationId || !user?.id) return;
    const raw = await apiClient(user.id).get<Parameters<typeof shapeConversation>[0]>(`/conversations/${conversationId}`).catch(() => null);
    if (raw) setConv(shapeConversation(raw, user.id));
  }, [conversationId, user?.id]);
  useEffect(() => { void loadConversation(); }, [loadConversation]);

  useEffect(() => {
    if (!user?.id || !conv || conv.isGroup || !conv.other) return;
    apiClient(user.id).get<string[]>('/users/blocks').then((ids) => setBlocked(ids.includes(conv.other!.id))).catch(() => {});
  }, [user?.id, conv]);

  // Auto-scroll on new messages when at the bottom; otherwise count them for the pill.
  useEffect(() => {
    const grew = messages.length > prevLenRef.current;
    const last = messages[messages.length - 1];
    prevLenRef.current = messages.length;
    if (!grew) return;
    if (atBottom || last?.sender_id === user?.id) {
      bottomRef.current?.scrollIntoView({ block: 'end' });
      setNewCount(0);
    } else {
      setNewCount((n) => n + 1);
    }
  }, [messages, atBottom, user?.id]);
  useEffect(() => { if (!isLoading) setTimeout(() => bottomRef.current?.scrollIntoView({ block: 'end' }), 50); }, [isLoading]);

  // Mark unread messages from others as read whenever they appear.
  useEffect(() => {
    if (isLoading || !user?.id) return;
    const ids = messages.filter((m) => m.sender_id !== user.id && !m.read_at && !m.deleted_at && m.kind !== 'system' && !m._status).map((m) => m.id);
    if (ids.length) void markRead(ids);
  }, [isLoading, messages, user?.id, markRead]);

  function handleScroll() {
    const el = scrollRef.current; if (!el) return;
    if (el.scrollTop < 40 && hasMore) void loadOlder();
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setAtBottom(nearBottom);
    if (nearBottom) setNewCount(0);
  }
  function scrollToBottom() { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); setNewCount(0); }
  function scrollToMessage(id: string) {
    const el = document.getElementById(`msg-${id}`);
    if (!el) { showToast('That message is further up — scroll to load it.'); return; }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('bg-[#FFF7CC]'); setTimeout(() => el.classList.remove('bg-[#FFF7CC]'), 1200);
  }

  // ── Sending ────────────────────────────────────────────────────────────────
  async function handleSendText() {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    stopTyping();
    if (editing) {
      setSending(true);
      const err = await editMessage(editing.id, trimmed);
      setSending(false);
      if (err) { showToast(err, 'error'); return; }
      setEditing(null); setText('');
      return;
    }
    setSending(true);
    setText('');
    const reply = replyTo; setReplyTo(null);
    const { error } = await sendMessage({ text: trimmed, reply_to_id: reply?.id });
    if (error && error !== 'offline') showToast(error, 'error');
    if (error === 'offline') showToast("You're offline — it will send when you're back online.");
    setSending(false);
    textRef.current?.focus();
  }

  async function handleFileChange(kind: 'image' | 'video' | 'file', e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user?.id || !conversationId || isSending) return;
    if (kind === 'image') { if (cropSrc) URL.revokeObjectURL(cropSrc); setCropSrc(URL.createObjectURL(file)); return; }
    setSending(true);
    if (kind === 'video') {
      const url = await uploadChatVideo(conversationId, file);
      if (url) await sendMessage({ videoUrl: url, reply_to_id: replyTo?.id }); else showToast('Video upload failed.', 'error');
    } else {
      if (file.size > 25 * 1024 * 1024) { showToast('Files must be under 25 MB.', 'error'); setSending(false); return; }
      const url = await uploadChatFile(conversationId, file);
      if (url) await sendMessage({ file_url: url, file_name: file.name, file_size: file.size, reply_to_id: replyTo?.id }); else showToast('File upload failed.', 'error');
    }
    setReplyTo(null);
    setSending(false);
  }

  async function handleCropDone(blob: Blob, previewUrl: string) {
    URL.revokeObjectURL(previewUrl);
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    if (!user?.id || !conversationId) return;
    setSending(true);
    const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
    const url = await uploadChatImage(conversationId, file);
    if (url) await sendMessage({ imageUrl: url, reply_to_id: replyTo?.id }); else showToast('Photo upload failed.', 'error');
    setReplyTo(null);
    setSending(false);
  }
  function cancelCrop() { if (cropSrc) URL.revokeObjectURL(cropSrc); setCropSrc(null); }

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
        setRecording(false); setRecordSeconds(0);
        if (blob.size > 0 && user?.id && conversationId) {
          setSending(true);
          const url = await uploadChatVoice(conversationId, blob);
          if (url) await sendMessage({ voiceUrl: url, reply_to_id: replyTo?.id });
          setReplyTo(null);
          setSending(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start(); setRecording(true); setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch { showToast('Microphone access is needed for voice messages.', 'error'); }
  }
  function stopRecording() { mediaRecorderRef.current?.stop(); }

  async function handleShareShift(shiftId: string) {
    setShareShift(false); setShowAttach(false);
    setSending(true);
    const { error } = await sendMessage({ shift_card_id: shiftId });
    if (error) showToast(error, 'error');
    setSending(false);
  }

  // ── Message actions ────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!actionMsg || busy) return;
    setBusy(true);
    const err = await deleteMessage(actionMsg.id);
    setBusy(false);
    if (err) { showToast(err, 'error'); return; }
    setActionMsg(null);
  }
  async function handleCopy(m: MessageRow) {
    try { await navigator.clipboard.writeText(m.text ?? ''); showToast('Copied.'); } catch { showToast('Could not copy.', 'error'); }
    setActionMsg(null);
  }
  async function handleForward(toConversationId: string) {
    if (!forwardMsg || !user?.id) return;
    const m = forwardMsg; setForwardMsg(null);
    try {
      await apiClient(user.id).post('/messages', {
        conversation_id: toConversationId,
        text: m.text ?? undefined, image_url: m.image_url ?? undefined, video_url: m.video_url ?? undefined,
        voice_url: m.voice_url ?? undefined, file_url: m.file_url ?? undefined, file_name: m.file_name ?? undefined,
        file_size: m.file_size ?? undefined, shift_card_id: m.shift_card_id ?? undefined,
      });
      showToast('Forwarded.');
    } catch (e) { showToast(e instanceof Error ? e.message : 'Could not forward.', 'error'); }
  }
  async function handleBlockToggle(next: boolean) {
    if (!user?.id || !conv?.other) return;
    try {
      if (next) await apiClient(user.id).post(`/users/${conv.other.id}/block`, {});
      else await apiClient(user.id).delete(`/users/${conv.other.id}/block`);
      setBlocked(next);
      showToast(next ? `Blocked @${conv.other.username ?? 'user'}.` : `Unblocked @${conv.other.username ?? 'user'}.`);
      if (next) setInfo(false);
    } catch (e) { showToast(e instanceof Error ? e.message : 'Could not update.', 'error'); }
  }

  // ── Search ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!searching) { setResults(null); return; }
    const q = query.trim();
    if (!q) { setResults(null); return; }
    const t = setTimeout(() => { void search(q).then(setResults); }, 300);
    return () => clearTimeout(t);
  }, [query, searching, search]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const memberMap = useMemo(() => new Map<string, ConversationMember>((conv?.members ?? []).map((m) => [m.id, m])), [conv]);
  const isGroup = !!conv?.isGroup;
  const otherName = conv?.other?.username ? `@${conv.other.username}` : 'They';
  const lastMine = [...messages].reverse().find((m) => m.sender_id === user?.id && !m.deleted_at && !m._status && m.kind !== 'system');
  const canShareShift = profile.role === 'client' || profile.role === 'staffer';
  const otherMembers = (conv?.members ?? []).filter((m) => m.id !== user?.id);

  function receiptFor(m: MessageRow): Receipt {
    if (!lastMine || m.id !== lastMine.id) return null;
    if (!isGroup) return m.read_at ? { kind: 'read', at: m.read_at } : { kind: 'delivered' };
    const readBy = otherMembers.filter((mem) => { const at = readers[mem.id]; return at && at >= m.created_at; }).map((mem) => (mem.username ? `@${mem.username}` : 'Member'));
    return { kind: 'group', readBy, total: otherMembers.length };
  }

  function senderOf(m: MessageRow): { name: string; photo: string | null | undefined } {
    const mem = memberMap.get(m.sender_id);
    const name = m.sender_username ?? mem?.username ?? (m.sender_id === conv?.other?.id ? conv?.other?.username : null);
    return { name: name ? `@${name}` : 'Member', photo: m.sender_photo ?? mem?.photo_url ?? (m.sender_id === conv?.other?.id ? conv?.other?.photo_url : null) };
  }

  function autoGrow() {
    const el = textRef.current; if (!el) return;
    el.style.height = 'auto'; el.style.height = `${Math.min(120, el.scrollHeight)}px`;
  }

  const composerDisabled = isSending || blocked;
  const typingLabel = typingUsers.length === 0 ? null
    : typingUsers.length === 1 ? `${typingUsers[0] ? `@${typingUsers[0]}` : 'Someone'} is typing…`
    : `${typingUsers.length} people are typing…`;

  return (
    <div className="h-[100dvh] bg-white flex flex-col overflow-hidden">
      {cropSrc && <ImageCropper imageSrc={cropSrc} defaultAspect={1} onDone={(blob, previewUrl) => void handleCropDone(blob, previewUrl)} onCancel={cancelCrop} />}

      {/* Header */}
      <div className="flex items-center gap-2 px-2 pt-[calc(env(safe-area-inset-top)+12px)] pb-2.5 border-b border-[#DBDBDB] bg-white flex-shrink-0">
        <button type="button" aria-label="Back to messages" onClick={() => navigate('/messages')}
          className="w-9 h-9 flex items-center justify-center active:opacity-60 transition-opacity flex-shrink-0">
          <ChevronLeft size={22} className="text-black" />
        </button>
        {searching ? (
          <div className="flex-1 flex items-center gap-2 bg-[#F3F4F6] border border-[#DBDBDB] rounded-[10px] px-3 h-[38px]">
            <Search size={14} className="text-[#737373] flex-shrink-0" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search this conversation" aria-label="Search messages"
              className="flex-1 bg-transparent text-black text-[14px] outline-none" />
            <button type="button" onClick={() => { setSearching(false); setQuery(''); }} className="text-[#0A1628] text-[13px] font-bold">Done</button>
          </div>
        ) : (
          <>
            <button type="button" onClick={() => conv && setInfo(true)} className="flex items-center gap-2.5 min-w-0 flex-1 text-left" aria-label="Conversation info">
              {isGroup
                ? <div className="w-9 h-9 rounded-full bg-[#0A1628] flex items-center justify-center flex-shrink-0"><Users size={16} className="text-white" /></div>
                : <Avatar url={conv?.other?.photo_url} name={conv?.other?.username} size={36} />}
              <div className="min-w-0">
                <p className="text-black font-bold text-[15px] truncate flex items-center gap-1.5">
                  {conv?.displayName ?? 'Conversation'}
                  {conv?.is_muted && <BellOff size={12} className="text-[#9CA3AF]" aria-label="Muted" />}
                  {conv?.is_pinned && <Pin size={12} className="text-[#9CA3AF]" aria-label="Pinned" />}
                </p>
                <p className="text-[#737373] text-[11px] font-medium truncate">
                  {typingLabel ?? (isGroup ? `${conv?.members.length ?? 0} members · Shift chat` : conv?.shiftTitle ? `📌 ${conv.shiftTitle}` : blocked ? 'Blocked' : 'Tap for info')}
                </p>
              </div>
            </button>
            <button type="button" aria-label="Search in conversation" onClick={() => setSearching(true)}
              className="w-9 h-9 flex items-center justify-center text-[#0A1628]"><Search size={19} /></button>
            <button type="button" aria-label="Conversation info" onClick={() => conv && setInfo(true)}
              className="w-9 h-9 flex items-center justify-center text-[#0A1628]"><Info size={19} /></button>
          </>
        )}
      </div>

      {/* Search results */}
      {searching && (
        <div className="flex-1 overflow-y-auto">
          {!query.trim() && <p className="text-center text-[#9CA3AF] text-[13px] py-10">Type to search messages in this thread.</p>}
          {query.trim() && results === null && <p className="text-center text-[#9CA3AF] text-[13px] py-10">Searching…</p>}
          {results && results.length === 0 && <p className="text-center text-[#9CA3AF] text-[13px] py-10">No matches.</p>}
          {results?.map((m) => (
            <button key={m.id} type="button" onClick={() => { setSearching(false); setQuery(''); setTimeout(() => scrollToMessage(m.id), 150); }}
              className="w-full text-left px-4 py-3 border-b border-[#F3F4F6]">
              <p className="text-[#6B7280] text-[11px] font-semibold">{m.sender_id === user?.id ? 'You' : senderOf(m).name} · {receiptTime(m.created_at)}</p>
              <p className="text-[#111827] text-[14px] line-clamp-2">{m.text}</p>
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      {!searching && (
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto py-3 relative">
          {isLoading ? <ChatSkeleton /> : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 px-8 text-center">
              <p className="text-black font-semibold text-[15px]">{isGroup ? 'Welcome to the shift chat 👋' : 'Say hello 👋'}</p>
              <p className="text-[#737373] text-[13px]">
                {isGroup ? 'Everyone confirmed for this shift is here. Share call times, parking and updates in one place.'
                  : `Your messages are private between you and ${otherName}.`}
              </p>
            </div>
          ) : (
            <>
              {hasMore && <p className="text-center text-[#AAAAAA] text-[11px] py-2">Scroll up for earlier messages</p>}
              {messages.map((m, i) => {
                const isMine = m.sender_id === user?.id;
                const prev = messages[i - 1];
                const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
                const s = senderOf(m);
                return (
                  <div key={m.id} className="transition-colors duration-500">
                    {newDay && <p className="text-center text-[#9CA3AF] text-[11px] font-semibold py-2 select-none">{dayLabel(m.created_at)}</p>}
                    <Bubble msg={m} isMine={isMine} isGroup={isGroup} senderName={isMine ? 'You' : s.name} senderPhoto={s.photo}
                      receipt={receiptFor(m)} myId={user?.id}
                      onLongPress={!m.deleted_at && m.kind !== 'system' && !m._status ? () => setActionMsg(m) : undefined}
                      onReact={(e) => void react(m.id, e).then((err) => err && showToast(err, 'error'))}
                      onRetry={() => void retryMessage(m.id).then((err) => err && showToast(err, 'error'))}
                      onDiscard={() => discardFailed(m.id)}
                      onOpenShift={(id) => navigate(`/shift/${id}`)}
                      onScrollToReply={scrollToMessage} />
                  </div>
                );
              })}
              {typingLabel && (
                <div className="flex items-end gap-2 px-4 mb-1.5">
                  <div className="bg-[#F3F4F6] rounded-[16px] rounded-bl-[4px] px-3.5 py-3 flex items-center gap-1" aria-label={typingLabel}>
                    {[0, 1, 2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF] animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />)}
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Scroll-to-bottom / new messages pill */}
      {!searching && !atBottom && messages.length > 0 && (
        <div className="relative">
          <button type="button" onClick={scrollToBottom} aria-label="Scroll to latest"
            className="absolute -top-12 left-1/2 -translate-x-1/2 h-9 px-3.5 rounded-full bg-[#0A1628] text-white text-[12px] font-bold shadow-lg flex items-center gap-1.5">
            <ArrowDown size={14} /> {newCount > 0 ? `${newCount} new message${newCount === 1 ? '' : 's'}` : 'Latest'}
          </button>
        </div>
      )}

      {/* Composer */}
      {!searching && (
        <div className="flex-shrink-0 border-t border-[#DBDBDB] bg-white pb-[env(safe-area-inset-bottom)]">
          {blocked && conv?.other && (
            <div className="px-4 py-3 text-center">
              <p className="text-[#6B7280] text-[13px]">You blocked {otherName}. They can't message you.</p>
              <button type="button" onClick={() => void handleBlockToggle(false)} className="text-[#0A1628] text-[13px] font-bold mt-1">Unblock</button>
            </div>
          )}

          {!blocked && (replyTo || editing) && (
            <div className="flex items-center gap-2 px-4 pt-2">
              <div className={`flex-1 min-w-0 pl-2.5 py-1.5 border-l-2 ${editing ? 'border-amber-400' : 'border-[#0A1628]'}`}>
                <p className="text-[11px] font-bold text-[#0A1628] flex items-center gap-1">
                  {editing ? <><Pencil size={11} /> Editing</> : <><Reply size={11} /> Replying to {replyTo!.sender_id === user?.id ? 'yourself' : senderOf(replyTo!).name}</>}
                </p>
                <p className="text-[12px] text-[#6B7280] truncate">
                  {(editing ?? replyTo)!.text ?? ((editing ?? replyTo)!.image_url ? '📷 Photo' : (editing ?? replyTo)!.video_url ? '🎥 Video' : (editing ?? replyTo)!.voice_url ? '🎤 Voice message' : (editing ?? replyTo)!.file_name ?? 'Message')}
                </p>
              </div>
              <button type="button" aria-label="Cancel" onClick={() => { setReplyTo(null); setEditing(null); if (editing) setText(''); }} className="w-8 h-8 flex items-center justify-center text-[#6B7280]"><X size={16} /></button>
            </div>
          )}

          {!blocked && showQuick && (
            <div className="flex gap-2 px-3 pt-2 overflow-x-auto scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
              {quick.list.map((q) => (
                <button key={q} type="button" onClick={() => { setText(q); setShowQuick(false); setTimeout(() => textRef.current?.focus(), 0); }}
                  className="flex-shrink-0 h-8 px-3 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] text-[12px] font-semibold text-[#111827] whitespace-nowrap">{q}</button>
              ))}
              <button type="button" onClick={() => setEditQuick(true)} aria-label="Edit quick replies"
                className="flex-shrink-0 h-8 px-3 rounded-full border border-dashed border-[#D1D5DB] text-[12px] font-semibold text-[#6B7280] whitespace-nowrap">Edit</button>
            </div>
          )}

          {!blocked && showEmoji && (
            <div className="grid grid-cols-10 gap-1 px-3 pt-2 max-h-[120px] overflow-y-auto">
              {EMOJI_GRID.map((e) => (
                <button key={e} type="button" onClick={() => { setText((t) => `${t}${e}`); textRef.current?.focus(); }}
                  className="h-8 text-[20px] flex items-center justify-center rounded-[6px] active:bg-[#F3F4F6]" aria-label={`Insert ${e}`}>{e}</button>
              ))}
            </div>
          )}

          {!blocked && showAttach && (
            <div className="flex gap-2 px-3 pt-2 overflow-x-auto scrollbar-none">
              {[
                { icon: <ImageIcon size={16} />, label: 'Photo', onClick: () => fileInputRef.current?.click() },
                { icon: <Video size={16} />, label: 'Video', onClick: () => videoInputRef.current?.click() },
                { icon: <Paperclip size={16} />, label: 'File', onClick: () => docInputRef.current?.click() },
                ...(canShareShift ? [{ icon: <Briefcase size={16} />, label: 'Share a shift', onClick: () => setShareShift(true) }] : []),
                { icon: <Clock size={16} />, label: 'Schedule', onClick: () => setScheduling(true) },
                { icon: <Zap size={16} />, label: 'Quick replies', onClick: () => { setShowQuick((v) => !v); setShowAttach(false); } },
              ].map((a) => (
                <button key={a.label} type="button" onClick={() => { a.onClick(); if (a.label !== 'Quick replies') setShowAttach(false); }}
                  className="flex-shrink-0 h-9 px-3 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] text-[12px] font-semibold text-[#111827] flex items-center gap-1.5 whitespace-nowrap">
                  {a.icon}{a.label}
                </button>
              ))}
            </div>
          )}

          {!blocked && (
            <div className="px-3 py-2.5">
              {isRecording ? (
                <div className="flex items-center gap-3 px-1">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" aria-hidden />
                  <span className="text-black text-[13px] font-medium tabular-nums w-10">{fmtDuration(recordSeconds)}</span>
                  <p className="flex-1 text-[#6B7280] text-[12px]">Recording… release to send</p>
                  <button type="button" aria-label="Stop recording" onClick={stopRecording}
                    className="w-10 h-10 rounded-full bg-[#0A1628] flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform">
                    <Square size={15} className="text-white fill-white" />
                  </button>
                </div>
              ) : (
                <div className="flex items-end gap-1.5">
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handleFileChange('image', e)} />
                  <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => void handleFileChange('video', e)} />
                  <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,application/pdf" className="hidden" onChange={(e) => void handleFileChange('file', e)} />
                  <button type="button" aria-label="Attach" aria-expanded={showAttach} disabled={composerDisabled}
                    onClick={() => { setShowAttach((v) => !v); setShowEmoji(false); }}
                    className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-transform disabled:opacity-40 ${showAttach ? 'rotate-45 bg-[#F3F4F6]' : ''}`}>
                    <Plus size={20} className="text-[#0A1628]" />
                  </button>
                  <div className="flex-1 flex items-end bg-[#F3F4F6] border border-[#DBDBDB] rounded-[20px] px-3 min-h-[38px]">
                    <textarea ref={textRef} value={text} rows={1}
                      onChange={(e) => { setText(e.target.value); autoGrow(); if (e.target.value.trim()) notifyTyping(); else stopTyping(); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSendText(); } }}
                      onBlur={stopTyping}
                      placeholder={editing ? 'Edit message…' : isGroup ? 'Message the shift chat…' : 'Message…'} aria-label="Message text" disabled={composerDisabled}
                      className="flex-1 bg-transparent text-black text-[14px] placeholder:text-[#AAAAAA] focus:outline-none py-2 resize-none max-h-[120px] leading-[1.4]" />
                    <button type="button" aria-label="Emoji" onClick={() => { setShowEmoji((v) => !v); setShowAttach(false); }}
                      className="w-8 h-9 flex items-center justify-center text-[#6B7280] flex-shrink-0"><Smile size={18} /></button>
                  </div>
                  {text.trim() ? (
                    <button type="button" aria-label={editing ? 'Save edit' : 'Send message'} disabled={composerDisabled} onClick={() => void handleSendText()}
                      className="w-9 h-9 rounded-full bg-[#0A1628] flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform disabled:opacity-50">
                      {editing ? <Check size={16} className="text-white" /> : <Send size={15} className="text-white" />}
                    </button>
                  ) : (
                    <button type="button" aria-label="Hold to record voice message" disabled={composerDisabled}
                      onPointerDown={() => void startRecording()} onPointerUp={stopRecording} onPointerLeave={() => { if (isRecording) stopRecording(); }}
                      className="w-9 h-9 rounded-full bg-[#0A1628] flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform disabled:opacity-40">
                      <Mic size={15} className="text-white" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sheets */}
      {actionMsg && (
        <MessageActionSheet msg={actionMsg} isMine={actionMsg.sender_id === user?.id} myId={user?.id} busy={busy}
          onClose={() => setActionMsg(null)}
          onReact={(e) => { void react(actionMsg.id, e); setActionMsg(null); }}
          onReply={() => { setReplyTo(actionMsg); setEditing(null); setActionMsg(null); setTimeout(() => textRef.current?.focus(), 0); }}
          onCopy={() => void handleCopy(actionMsg)}
          onForward={() => { setForwardMsg(actionMsg); setActionMsg(null); }}
          onEdit={() => { setEditing(actionMsg); setReplyTo(null); setText(actionMsg.text ?? ''); setActionMsg(null); setTimeout(() => { textRef.current?.focus(); autoGrow(); }, 0); }}
          onDelete={() => void handleDelete()} />
      )}
      {forwardMsg && conversationId && <ForwardSheet excludeId={conversationId} onPick={(id) => void handleForward(id)} onClose={() => setForwardMsg(null)} />}
      {shareShift && <ShareShiftSheet onPick={(id) => void handleShareShift(id)} onClose={() => setShareShift(false)} />}
      {scheduling && conversationId && <ScheduleSheet conversationId={conversationId} draft={text} onClose={() => setScheduling(false)} onScheduled={() => setText('')} />}
      {gallery && conversationId && <GallerySheet conversationId={conversationId} onClose={() => setGallery(false)} />}
      {editQuick && <QuickRepliesEditor list={quick.list} onSave={(l) => void quick.save(l)} onClose={() => setEditQuick(false)} />}
      {info && conv && user?.id && (
        <InfoSheet conv={conv} myId={user.id} blocked={blocked} onClose={() => setInfo(false)}
          onChanged={() => void loadConversation()}
          onOpenGallery={() => { setInfo(false); setGallery(true); }}
          onOpenSearch={() => { setInfo(false); setSearching(true); }}
          onBlockToggle={handleBlockToggle} />
      )}
    </div>
  );
}
