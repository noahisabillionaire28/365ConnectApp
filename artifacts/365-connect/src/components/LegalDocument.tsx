/**
 * Renders a legal document (Terms / Privacy) from its structured data, and a
 * full-height bottom sheet that shows one inside the app (sign-up, the
 * acceptance gate) without leaving the current screen.
 */
import { useEffect } from 'react';
import { X } from 'lucide-react';
import { TERMS } from '@/legal/terms';
import { PRIVACY } from '@/legal/privacy';
import { LEGAL, formatLegalDate, type LegalDocument as LegalDoc, type LegalDocumentId } from '@/legal/config';

export const LEGAL_DOCS: Record<LegalDocumentId, LegalDoc> = { terms: TERMS, privacy: PRIVACY };

/** Absolute in-app path for a document, honouring the Vite base path (for new-tab links). */
export function legalHref(doc: LegalDocumentId): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${doc}`;
}

export function LegalDocumentBody({ doc, headingLevel = 2 }: { doc: LegalDoc; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div className="legal-body text-[16px] leading-[1.65] text-[#111827]">
      {doc.intro.map((p, i) => (
        <p key={i} className="mb-4 text-[#374151]">{p}</p>
      ))}
      {doc.sections.map((s) => (
        <section key={s.id} id={s.id} className="mt-8 scroll-mt-[112px]">
          <H className="text-[18px] font-bold text-[#0A1628] leading-snug mb-3">{s.heading}</H>
          {s.paragraphs.map((p, i) => (
            <p key={i} className="mb-3 text-[#374151]">{p}</p>
          ))}
          {s.bullets && (
            <ul className="list-disc pl-5 mb-3 flex flex-col gap-2 text-[#374151]">
              {s.bullets.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

/**
 * Full-height sheet with one document, scrollable, closed with the X or the
 * backdrop. Used where the user must stay on the current screen.
 */
export function LegalSheet({ doc, onClose }: { doc: LegalDocumentId | null; onClose: () => void }) {
  useEffect(() => {
    if (!doc) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [doc, onClose]);

  if (!doc) return null;
  const d = LEGAL_DOCS[doc];
  return (
    <div data-no-pull className="fixed inset-0 z-[220] flex items-end justify-center bg-black/40"
      role="dialog" aria-modal="true" aria-label={d.title} onClick={onClose}>
      <div className="w-full max-w-app h-[92dvh] bg-white rounded-t-[20px] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()} data-testid={`legal-sheet-${doc}`}>
        <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-[#E5E7EB]">
          <div className="flex-1 min-w-0">
            <p className="text-[#111827] font-bold text-[17px] truncate">{d.title}</p>
            <p className="text-[#6B7280] text-[12px]">Effective {formatLegalDate(d.effectiveDate)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="w-11 h-11 -mr-2 rounded-full flex items-center justify-center text-[#0A1628]">
            <X size={20} aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+24px)]">
          <LegalDocumentBody doc={d} headingLevel={3} />
          <p className="mt-8 text-[#6B7280] text-[13px]">
            Questions? <a href={`mailto:${LEGAL.contactEmail}`} className="text-[#0A1628] font-semibold">{LEGAL.contactEmail}</a>
          </p>
        </div>
      </div>
    </div>
  );
}
