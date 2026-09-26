/**
 * Bottom sheet that asks for a template name and saves the given payload as
 * a shift template. Used from the post-shift success screen and the owner's
 * shift detail page.
 */
import { useEffect, useState } from 'react';
import { BookmarkPlus } from 'lucide-react';
import { useTemplates } from '@/hooks/useTemplates';
import { useToast } from '@/contexts/ToastContext';
import type { TemplatePayload } from '@/store/postShiftStore';

export function TemplateNameSheet({
  open, payload, defaultName, onClose, onSaved,
}: {
  open: boolean;
  payload: TemplatePayload | null;
  defaultName: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { save, saving, canSaveMore } = useTemplates(open);
  const { showToast } = useToast();
  const [name, setName] = useState(defaultName);
  const [err, setErr] = useState('');

  useEffect(() => { if (open) { setName(defaultName); setErr(''); } }, [open, defaultName]);

  if (!open) return null;

  async function handleSave() {
    const n = name.trim();
    if (!n) { setErr('Give the template a name.'); return; }
    if (!payload) { setErr('Nothing to save yet.'); return; }
    if (!canSaveMore) { setErr('You can keep up to 20 templates. Delete one first.'); return; }
    try {
      await save({ name: n, payload });
      showToast('Template saved.');
      onSaved?.();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save the template.');
    }
  }

  return (
    <div data-no-pull className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40"
      role="dialog" aria-modal="true" aria-label="Save as template"
      onClick={() => { if (!saving) onClose(); }}>
      <div className="w-full max-w-app bg-white rounded-t-[20px] px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
        onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-[#E5E7EB] mx-auto mb-4" />
        <div className="flex items-center gap-2 mb-1">
          <BookmarkPlus size={18} aria-hidden className="text-[#0A1628]" />
          <p className="text-[#111827] font-bold text-[17px]">Save as template</p>
        </div>
        <p className="text-[#6B7280] text-[13px] leading-relaxed mb-4">
          Keeps the job types, location, pay, headcount and details — not the dates — so the next post takes a minute.
        </p>
        <p className="text-[#6B7280] text-[11px] font-semibold uppercase tracking-wider mb-1.5">Template name</p>
        <input
          type="text" value={name} autoFocus maxLength={60}
          onChange={(e) => { setName(e.target.value); setErr(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleSave(); }}
          aria-label="Template name" aria-invalid={!!err}
          className={`w-full bg-white border rounded-[10px] px-3 h-[46px] text-[#111827] text-[14px] font-semibold focus:outline-none focus:border-[#0A1628] ${
            err ? 'border-[#EF4444]' : 'border-[#E5E7EB]'}`}
        />
        {err && <p className="text-[#EF4444] text-[11px] mt-1.5">{err}</p>}
        <div className="flex flex-col gap-2 mt-5">
          <button type="button" onClick={() => void handleSave()} disabled={saving}
            className="w-full h-[50px] rounded-[10px] bg-[#0A1628] text-white font-bold text-[15px] disabled:opacity-60">
            {saving ? 'Saving…' : 'Save template'}
          </button>
          <button type="button" onClick={onClose} disabled={saving}
            className="w-full h-[46px] rounded-[10px] border border-[#E5E7EB] text-[#111827] font-semibold text-[14px] disabled:opacity-60">
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
