/**
 * Shift templates — the poster's saved shift set-ups. Rename or delete from a
 * ⋯ menu; "Use" starts a new post from the template at the date step.
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, LayoutTemplate, MoreHorizontal, Pencil, Trash2, Play } from 'lucide-react';
import { useTemplates, templateSummary, templateUsage, MAX_TEMPLATES, type ShiftTemplate } from '@/hooks/useTemplates';
import { loadDraftFromTemplate } from '@/store/postShiftStore';
import { useToast } from '@/contexts/ToastContext';
import { useRole } from '@/contexts/RoleContext';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { BottomTabNav } from '@/components/BottomTabNav';

export function TemplatesScreen() {
  const [, navigate] = useLocation();
  const { role, roleLoading } = useRole();
  const isPoster = role === 'client' || role === 'staffer';
  const { templates, isLoading, update, updating, remove, use, using } = useTemplates(isPoster);
  const { showToast } = useToast();
  const [menuFor, setMenuFor] = useState<ShiftTemplate | null>(null);
  const [renaming, setRenaming] = useState<ShiftTemplate | null>(null);
  const [newName, setNewName] = useState('');
  const [deleting, setDeleting] = useState<ShiftTemplate | null>(null);

  // Only posters keep templates.
  useEffect(() => {
    if (!roleLoading && !isPoster) navigate('/home');
  }, [roleLoading, isPoster, navigate]);

  async function handleUse(t: ShiftTemplate) {
    try {
      const fresh = await use(t.id);
      loadDraftFromTemplate(fresh.payload);
      navigate('/post-shift/step3');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not load that template.', 'error');
    }
  }

  async function handleRename() {
    if (!renaming) return;
    const n = newName.trim();
    if (!n) return;
    try {
      await update({ id: renaming.id, name: n });
      showToast('Template renamed.');
      setRenaming(null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not rename the template.', 'error');
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    const t = deleting;
    setDeleting(null);
    try {
      await remove(t.id);
      showToast('Template deleted.');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not delete the template.', 'error');
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[#F7F8FA] flex flex-col pb-[72px]">
      <div className="bg-white px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-4 border-b border-[#E5E7EB] sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Back"
            onClick={() => { if (window.history.length > 1) window.history.back(); else navigate('/profile'); }}
            className="w-9 h-9 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center flex-shrink-0">
            <ChevronLeft size={18} aria-hidden className="text-[#111827]" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-[#111827] font-bold text-[22px] tracking-tight">Shift templates</h1>
            <p className="text-[#6B7280] text-[13px]">{templates.length} of {MAX_TEMPLATES} · saved shift set-ups, minus the dates</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-10">
        {isLoading && (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => <div key={i} className="h-[74px] rounded-[12px] bg-white border border-[#E5E7EB] animate-pulse" />)}
          </div>
        )}
        {!isLoading && templates.length === 0 && (
          <div className="bg-white border border-[#E5E7EB] rounded-[12px] px-6 py-10 text-center">
            <div className="w-12 h-12 rounded-full bg-[#F3F4F6] flex items-center justify-center mx-auto mb-3">
              <LayoutTemplate size={20} aria-hidden className="text-[#6B7280]" />
            </div>
            <p className="text-[#111827] font-bold text-[15px]">No templates yet</p>
            <p className="text-[#6B7280] text-[13px] mt-1 leading-relaxed">
              After you post a shift, tap “Save as template” to keep its details for next time.
            </p>
          </div>
        )}
        {!isLoading && templates.length > 0 && (
          <div className="bg-white border border-[#E5E7EB] rounded-[12px] overflow-hidden">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center gap-2 px-4 py-3 border-b border-[#F3F4F6] last:border-0">
                <button type="button" onClick={() => void handleUse(t)} disabled={using}
                  aria-label={`Use template ${t.name}`}
                  className="flex-1 min-w-0 text-left disabled:opacity-60">
                  <p className="text-[#111827] text-[14px] font-semibold truncate">{t.name}</p>
                  <p className="text-[#6B7280] text-[12px] truncate">{templateSummary(t.payload)}</p>
                  <p className="text-[#9CA3AF] text-[11px]">{templateUsage(t)}</p>
                </button>
                <button type="button" aria-label={`More options for ${t.name}`} onClick={() => setMenuFor(t)}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[#6B7280] active:bg-[#F3F4F6]">
                  <MoreHorizontal size={18} aria-hidden />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ⋯ menu */}
      <AnimatePresence>
        {menuFor && (
          <div data-no-pull className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40"
            role="dialog" aria-modal="true" aria-label={`Options for ${menuFor.name}`}
            onClick={() => setMenuFor(null)}>
            <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-app bg-white rounded-t-[20px] px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
              onClick={(e) => e.stopPropagation()}>
              <div className="w-10 h-1 rounded-full bg-[#E5E7EB] mx-auto mb-4" />
              <p className="text-[#111827] font-bold text-[17px] truncate">{menuFor.name}</p>
              <p className="text-[#6B7280] text-[13px] mb-4 truncate">{templateSummary(menuFor.payload)}</p>
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => { const t = menuFor; setMenuFor(null); void handleUse(t); }}
                  className="w-full h-[48px] rounded-[10px] bg-[#0A1628] text-white font-bold text-[14px] flex items-center justify-center gap-2">
                  <Play size={15} aria-hidden /> Post a shift from this
                </button>
                <button type="button" onClick={() => { setRenaming(menuFor); setNewName(menuFor.name); setMenuFor(null); }}
                  className="w-full h-[46px] rounded-[10px] border border-[#E5E7EB] text-[#111827] font-semibold text-[14px] flex items-center justify-center gap-2">
                  <Pencil size={15} aria-hidden /> Rename
                </button>
                <button type="button" onClick={() => { setDeleting(menuFor); setMenuFor(null); }}
                  className="w-full h-[46px] rounded-[10px] border border-[#FECACA] text-[#EF4444] font-semibold text-[14px] flex items-center justify-center gap-2">
                  <Trash2 size={15} aria-hidden /> Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rename */}
      <ConfirmSheet
        open={!!renaming}
        title="Rename template"
        confirmLabel="Save name"
        busy={updating}
        confirmDisabled={!newName.trim()}
        onConfirm={() => void handleRename()}
        onCancel={() => { if (!updating) setRenaming(null); }}
        body={
          <input type="text" value={newName} autoFocus maxLength={60}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleRename(); }}
            aria-label="Template name"
            className="mt-2 w-full bg-white border border-[#E5E7EB] rounded-[10px] px-3 h-[46px] text-[#111827] text-[14px] font-semibold focus:outline-none focus:border-[#0A1628]" />
        }
      />

      {/* Delete */}
      <ConfirmSheet
        open={!!deleting}
        title={`Delete “${deleting?.name ?? ''}”?`}
        body="Shifts already posted from it are not affected."
        confirmLabel="Delete template"
        tone="danger"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleting(null)}
      />

      <BottomTabNav />
    </div>
  );
}
