/**
 * "Swap shift" sheet for a booked worker offering their spot to another
 * worker: find them by name, add an optional note, send. Nothing changes on
 * the roster until the other worker accepts and the poster approves.
 */
import { useEffect, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Search, Star, Check, Info, X } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export type SwapCandidate = {
  id: string;
  username: string | null;
  photo_url: string | null;
  rating: number | string | null;
  primary_job_type: string | null;
  is_followed?: boolean;
};

function Avatar({ url, name, size = 36 }: { url: string | null; name: string | null; size?: number }) {
  const initials = (name ?? 'W').replace('@', '').slice(0, 2).toUpperCase();
  return (
    <div style={{ width: size, height: size }}
      className="rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center overflow-hidden flex-shrink-0">
      {url ? <img src={url} alt="" className="w-full h-full object-cover" />
           : <span className="text-black font-bold text-[12px]">{initials}</span>}
    </div>
  );
}

export function SwapSheet({ open, shiftLabel, busy, onSend, onCancel }: {
  open: boolean;
  /** e.g. "Sat, Oct 4 · 5:00 PM" — shown in the intro copy. */
  shiftLabel?: string | null;
  busy: boolean;
  onSend: (worker: SwapCandidate, note: string) => void;
  onCancel: () => void;
}) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [selected, setSelected] = useState<SwapCandidate | null>(null);
  const [note, setNote] = useState('');

  // Debounce typing so the directory is not hit on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setTerm(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const search = useQuery<SwapCandidate[], Error>({
    queryKey: ['workers', 'search', term, user?.id],
    enabled: open && !!user?.id && term.length > 0,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    queryFn: () => apiClient(user!.id).get<SwapCandidate[]>(
      `/workers?role=worker&q=${encodeURIComponent(term)}&limit=8&exclude_self=1`,
    ),
  });
  const results = term.length > 0 ? (search.data ?? []) : [];

  function close() {
    if (busy) return;
    setQuery(''); setTerm(''); setSelected(null); setNote('');
    onCancel();
  }

  if (!open) return null;

  return (
    <div data-no-pull className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40"
      role="dialog" aria-modal="true" aria-label="Swap shift"
      onClick={close}>
      <div className="w-full max-w-app max-h-[88dvh] overflow-y-auto bg-white rounded-t-[20px] px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
        onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-[#E5E7EB] mx-auto mb-4" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[#111827] font-bold text-[17px]">Swap shift</p>
            <p className="text-[#6B7280] text-[13px] mt-1 leading-relaxed">
              Offer your spot{shiftLabel ? ` on ${shiftLabel}` : ''} to another worker. They accept, then the poster approves.
            </p>
          </div>
          <button type="button" onClick={close} aria-label="Close" disabled={busy}
            className="w-8 h-8 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center flex-shrink-0">
            <X size={15} aria-hidden className="text-[#737373]" />
          </button>
        </div>

        {/* Who */}
        {selected ? (
          <div className="mt-4 flex items-center gap-3 rounded-[12px] border border-[#0A1628] bg-[#0A1628]/5 px-3.5 py-3">
            <Avatar url={selected.photo_url} name={selected.username} />
            <div className="flex-1 min-w-0">
              <p className="text-[#111827] font-semibold text-[14px] truncate">{selected.username ? `@${selected.username}` : 'Worker'}</p>
              <p className="text-[#6B7280] text-[12px] truncate">
                {[selected.primary_job_type, Number(selected.rating) > 0 ? `${Number(selected.rating).toFixed(1)} rating` : null].filter(Boolean).join(' · ') || 'Worker'}
              </p>
            </div>
            <button type="button" onClick={() => setSelected(null)} disabled={busy}
              className="text-[#0A1628] text-[12px] font-bold">Change</button>
          </div>
        ) : (
          <>
            <label className="mt-4 flex items-center gap-2 h-[44px] rounded-[12px] border border-[#E5E7EB] px-3 focus-within:border-[#0A1628]">
              <Search size={15} aria-hidden className="text-[#9CA3AF] flex-shrink-0" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} disabled={busy}
                placeholder="Search a worker by name" aria-label="Search a worker by name" autoFocus
                className="flex-1 min-w-0 bg-transparent text-[14px] text-[#111827] outline-none placeholder:text-[#9CA3AF]" />
            </label>
            <div className="mt-2 flex flex-col gap-1.5 min-h-[56px]" role="listbox" aria-label="Matching workers">
              {term.length === 0 && (
                <p className="text-[#9CA3AF] text-[12px] px-1 py-2">Type a name or @username to find a worker.</p>
              )}
              {term.length > 0 && search.isLoading && (
                <p className="text-[#9CA3AF] text-[12px] px-1 py-2">Searching…</p>
              )}
              {term.length > 0 && !search.isLoading && results.length === 0 && (
                <p className="text-[#9CA3AF] text-[12px] px-1 py-2">No workers match “{term}”.</p>
              )}
              {results.map((w) => (
                <button key={w.id} type="button" role="option" aria-selected={false} disabled={busy}
                  onClick={() => setSelected(w)}
                  className="flex items-center gap-3 rounded-[12px] border border-[#E5E7EB] px-3.5 py-2.5 text-left active:bg-[#FAFAFA]">
                  <Avatar url={w.photo_url} name={w.username} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[#111827] font-semibold text-[14px] truncate">{w.username ? `@${w.username}` : 'Worker'}</p>
                    <p className="text-[#6B7280] text-[12px] truncate">{w.primary_job_type ?? 'Worker'}{w.is_followed ? ' · On a roster with you' : ''}</p>
                  </div>
                  {Number(w.rating) > 0 && (
                    <span className="flex items-center gap-0.5 text-[12px] font-semibold text-[#111827] flex-shrink-0">
                      <Star size={11} aria-hidden className="text-[#FFD700] fill-[#FFD700]" />
                      {Number(w.rating).toFixed(1)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} rows={2} disabled={busy}
          placeholder="Add a note for them (optional)" aria-label="Optional note"
          className="mt-3 w-full border border-[#E5E7EB] rounded-[12px] px-3 py-2.5 text-[14px] text-[#111827] resize-none outline-none focus:border-[#0A1628] placeholder:text-[#9CA3AF]" />

        <div className="mt-3 flex items-start gap-2 rounded-[12px] bg-[#F0F7FF] border border-[#DBDBDB] px-3 py-2.5">
          <Info size={15} aria-hidden className="text-[#0095F6] flex-shrink-0 mt-0.5" />
          <p className="text-[#374151] text-[12px] leading-relaxed">
            You keep your spot until the poster approves the swap. You can cancel the offer any time before then.
          </p>
        </div>

        <div className="flex flex-col gap-2 mt-4">
          <button type="button" disabled={busy || !selected} onClick={() => selected && onSend(selected, note)}
            className="w-full h-[50px] rounded-[10px] bg-[#0A1628] text-white font-bold text-[15px] flex items-center justify-center gap-2 disabled:opacity-60">
            {busy ? 'Sending…' : selected ? <><Check size={16} aria-hidden /> Send swap offer</> : 'Pick a worker to continue'}
          </button>
          <button type="button" onClick={close} disabled={busy}
            className="w-full h-[46px] rounded-[10px] border border-[#E5E7EB] text-[#111827] font-semibold text-[14px] disabled:opacity-60">
            Keep my spot
          </button>
        </div>
      </div>
    </div>
  );
}
