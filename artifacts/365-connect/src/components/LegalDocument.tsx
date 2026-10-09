/**
 * Renders a legal document (Terms, Privacy, Refunds, Cookies) from its
 * structured data, a full-height bottom sheet that shows one inside the app
 * (sign-up, the acceptance gate) without leaving the current screen, and the
 * shared "About & Contact" + credits footer block for the public pages.
 */
import { useId } from 'react';
import { Link } from 'wouter';
import { X, Mail, MapPin, Building2 } from 'lucide-react';
import { TERMS } from '@/legal/terms';
import { PRIVACY } from '@/legal/privacy';
import { REFUNDS } from '@/legal/refunds';
import { COOKIES } from '@/legal/cookies';
import {
  LEGAL, formatLegalDate, isLegalPlaceholder,
  type LegalDocument as LegalDoc, type LegalPageId,
} from '@/legal/config';
import { useDialog } from '@/hooks/useDialog';

export const LEGAL_DOCS: Record<LegalPageId, LegalDoc> = { terms: TERMS, privacy: PRIVACY, refunds: REFUNDS, cookies: COOKIES };

/** Absolute in-app path for a document, honouring the Vite base path (for new-tab links). */
export function legalHref(doc: LegalPageId): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${doc}`;
}

export function LegalDocumentBody({ doc, headingLevel = 2, onNavigate }: {
  doc: LegalDoc;
  headingLevel?: 2 | 3;
  /** Called when a cross-reference link is followed (a sheet closes itself). */
  onNavigate?: () => void;
}) {
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
          {s.after?.map((p, i) => (
            <p key={`after-${i}`} className="mb-3 text-[#374151]">{p}</p>
          ))}
          {s.links && s.links.length > 0 && (
            <p className="mb-3 text-[14px] text-[#6B7280]">
              See also:{' '}
              {s.links.map((l, i) => (
                <span key={l.page}>
                  {i > 0 && ', '}
                  <Link href={`/${l.page}`} onClick={onNavigate}
                    className="text-[#0A1628] font-semibold underline underline-offset-2"
                    data-testid={`legal-see-also-${l.page}`}>
                    {l.label}
                  </Link>
                </span>
              ))}
              .
            </p>
          )}
        </section>
      ))}
    </div>
  );
}

/**
 * "About & Contact" for the legal pages: the entity, mailing address and
 * mailbox from config. Placeholders (TODO values) render as "to be
 * announced" so the block lights up on its own once the owner fills them in.
 */
export function LegalContactBlock() {
  const entity = isLegalPlaceholder(LEGAL.entityName) ? null : LEGAL.entityName;
  const address = isLegalPlaceholder(LEGAL.mailingAddress) ? null : LEGAL.mailingAddress;
  return (
    <section aria-labelledby="legal-about-heading" className="mt-6 rounded-[12px] border border-[#E5E7EB] bg-[#FAFAFA] px-4 py-4" data-testid="legal-about">
      <h2 id="legal-about-heading" className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#6B7280] mb-3">About &amp; Contact</h2>
      <dl className="flex flex-col gap-2.5 text-[14px]">
        <div className="flex items-start gap-2.5">
          <Building2 size={16} aria-hidden className="text-[#6B7280] flex-shrink-0 mt-[2px]" />
          <div><dt className="sr-only">Operated by</dt>
            <dd className="text-[#111827]">{entity ?? <span className="text-[#6B7280]">Legal entity to be announced</span>}
              {entity && isLegalPlaceholder(LEGAL.entityNote) && <span className="text-[#6B7280]"> (registration details to follow)</span>}
            </dd></div>
        </div>
        <div className="flex items-start gap-2.5">
          <MapPin size={16} aria-hidden className="text-[#6B7280] flex-shrink-0 mt-[2px]" />
          <div><dt className="sr-only">Mailing address for legal notices</dt>
            <dd className="text-[#111827]">{address ?? <span className="text-[#6B7280]">Mailing address for legal notices to be announced</span>}</dd></div>
        </div>
        <div className="flex items-start gap-2.5">
          <Mail size={16} aria-hidden className="text-[#6B7280] flex-shrink-0 mt-[2px]" />
          <div><dt className="sr-only">Email</dt>
            <dd>
              <a href={`mailto:${LEGAL.contactEmail}`} className="inline-flex items-center min-h-[44px] -my-3 text-[#0A1628] font-semibold">{LEGAL.contactEmail}</a>
              <span className="block text-[#6B7280] text-[13px]">Legal notices, privacy requests, refunds and support.</span>
            </dd></div>
        </div>
      </dl>
    </section>
  );
}

/** One-line credits for fonts, icons and stock photos (full list in docs/licenses.md). */
export function LegalCreditsLine({ className = '' }: { className?: string }) {
  return (
    <p className={`text-[#6B7280] text-[12px] leading-relaxed ${className}`} data-testid="legal-credits">
      Credits: Space Grotesk typeface by Florian Karsten (SIL Open Font License, via Google Fonts); icons by Lucide (ISC License);
      default shift photos from Unsplash (Unsplash License); map data © OpenStreetMap contributors (ODbL), tiles by CARTO.
    </p>
  );
}

/**
 * Full-height sheet with one document, scrollable, closed with the X, the
 * backdrop or Escape. Focus is trapped inside and returned to the opener.
 * Used where the user must stay on the current screen.
 */
export function LegalSheet({ doc, onClose }: { doc: LegalPageId | null; onClose: () => void }) {
  const ref = useDialog<HTMLDivElement>(!!doc, onClose);
  const titleId = useId();
  if (!doc) return null;
  const d = LEGAL_DOCS[doc];
  return (
    <div data-no-pull className="fixed inset-0 z-[220] flex items-end justify-center bg-black/40" onClick={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="w-full max-w-app h-[92dvh] bg-white rounded-t-[20px] flex flex-col overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()} data-testid={`legal-sheet-${doc}`}>
        <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-[#E5E7EB]">
          <div className="flex-1 min-w-0">
            <p id={titleId} className="text-[#111827] font-bold text-[17px] truncate">{d.title}</p>
            <p className="text-[#6B7280] text-[12px]">Effective {formatLegalDate(d.effectiveDate)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="w-11 h-11 -mr-2 rounded-full flex items-center justify-center text-[#0A1628]">
            <X size={20} aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+24px)]">
          <LegalDocumentBody doc={d} headingLevel={3} onNavigate={onClose} />
          <p className="mt-8 text-[#6B7280] text-[13px]">
            Questions? <a href={`mailto:${LEGAL.contactEmail}`} className="text-[#0A1628] font-semibold">{LEGAL.contactEmail}</a>
          </p>
        </div>
      </div>
    </div>
  );
}
