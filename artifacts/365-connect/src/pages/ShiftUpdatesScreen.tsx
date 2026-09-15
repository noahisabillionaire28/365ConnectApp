import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { ChevronLeft, Megaphone, MessageSquareText, Send } from 'lucide-react';
import { useShiftUpdates, usePostShiftUpdate, type ShiftUpdate } from '@/hooks/useShiftUpdates';
import { useShiftById } from '@/hooks/useShifts';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function UpdateCard({ u }: { u: ShiftUpdate }) {
  const isAnn = u.kind === 'announcement';
  return (
    <div className={`rounded-[14px] border px-4 py-3.5 ${isAnn ? 'bg-amber-50 border-amber-200' : 'bg-white border-[#E5E7EB]'}`}>
      <div className="flex items-center gap-2 mb-1.5">
        {isAnn
          ? <Megaphone size={14} aria-hidden className="text-amber-600" />
          : <MessageSquareText size={14} aria-hidden className="text-[#6B7280]" />}
        <span className={`text-[11px] font-bold uppercase tracking-wide ${isAnn ? 'text-amber-600' : 'text-[#6B7280]'}`}>
          {isAnn ? 'Announcement' : 'Update'}
        </span>
        <span className="text-[#9CA3AF] text-[11px] ml-auto">{timeAgo(u.created_at)}</span>
      </div>
      <p className="text-[#111827] text-[14px] leading-snug whitespace-pre-wrap">{u.body}</p>
      {u.author_username && (
        <p className="text-[#9CA3AF] text-[11px] mt-2">— @{u.author_username}</p>
      )}
    </div>
  );
}

export function ShiftUpdatesScreen() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data: shift } = useShiftById(id);
  const { updates, isLoading } = useShiftUpdates(id);
  const post = usePostShiftUpdate(id);

  const isOwner = !!user?.id && !!shift && user.id === shift.clientId;
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<'update' | 'announcement'>('update');

  async function submit() {
    const text = body.trim();
    if (!text || post.isPending) return;
    try {
      await post.mutateAsync({ body: text, kind });
      setBody('');
      showToast('Posted — booked workers were notified.');
    } catch {
      showToast('Could not post.', 'error');
    }
  }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <div className="px-4 pt-[52px] pb-4 border-b border-[#DBDBDB] flex items-center gap-3 flex-shrink-0">
        <button type="button" aria-label="Go back"
          onClick={() => { if (window.history.length > 1) window.history.back(); else navigate(`/shift/${id ?? ''}`); }}
          className="w-9 h-9 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center flex-shrink-0">
          <ChevronLeft size={18} aria-hidden className="text-black" />
        </button>
        <div className="min-w-0">
          <h1 className="text-black font-bold text-[18px] leading-tight truncate">Updates</h1>
          <p className="text-[#737373] text-[12px] truncate">{shift?.companyName ?? 'Shift'}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-4 flex flex-col gap-3">
        {isLoading ? (
          [1, 2].map((n) => <div key={n} className="h-[80px] rounded-[14px] bg-[#FAFAFA] border border-[#E5E7EB] animate-pulse" />)
        ) : updates.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#111827] font-semibold text-[15px]">No updates yet</p>
            <p className="text-[#6B7280] text-[13px] mt-1">
              {isOwner ? 'Post an update or announcement for your booked workers.' : 'The organizer hasn’t posted anything yet.'}
            </p>
          </div>
        ) : (
          updates.map((u) => <UpdateCard key={u.id} u={u} />)
        )}
      </div>

      {isOwner && (
        <div className="border-t border-[#E5E7EB] px-4 py-3 flex-shrink-0 bg-white">
          <div className="flex gap-2 mb-2">
            {(['update', 'announcement'] as const).map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)}
                className={`h-8 px-3 rounded-full text-[12px] font-bold border ${
                  kind === k ? 'bg-[#0A1628] text-white border-[#0A1628]' : 'bg-white text-[#6B7280] border-[#E5E7EB]'
                }`}>
                {k === 'update' ? 'Update' : 'Announcement'}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={1}
              placeholder={kind === 'announcement' ? 'Announce something to the team…' : 'Post an update…'}
              className="flex-1 rounded-[12px] border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2.5 text-[14px] text-[#111827] outline-none focus:border-[#0A1628] resize-none" />
            <button type="button" onClick={() => void submit()} disabled={!body.trim() || post.isPending}
              className="w-11 h-11 rounded-full bg-[#0A1628] text-white flex items-center justify-center flex-shrink-0 disabled:opacity-50">
              <Send size={17} aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
