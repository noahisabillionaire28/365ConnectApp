/**
 * LegalScreen — /terms, /privacy, /refunds, /cookies
 *
 * Public, readable without signing in. One component renders any legal page
 * from its structured data: a sticky collapsible "On this page" list, the
 * effective date, the prose, and a footer with the other documents, the
 * About & Contact block and credits. Print-friendly (chrome is hidden under
 * @media print).
 */
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ChevronLeft, ChevronDown, Printer } from 'lucide-react';
import { LegalDocumentBody, LegalContactBlock, LegalCreditsLine, LEGAL_DOCS } from '@/components/LegalDocument';
import { LEGAL, LEGAL_PAGE_IDS, formatLegalDate, type LegalPageId } from '@/legal/config';
import { useLegalVersions } from '@/hooks/useLegal';

export function LegalScreen({ doc }: { doc: LegalPageId }) {
  const [, navigate] = useLocation();
  const d = LEGAL_DOCS[doc];
  const others = LEGAL_PAGE_IDS.filter((id) => id !== doc);
  const [tocOpen, setTocOpen] = useState(false);
  const versions = useLegalVersions();
  // The server is the source of truth for the effective date of the two
  // accepted documents; the bundled constant is the fallback (and the only
  // source for the informational policies).
  const effective = (doc === 'terms' || doc === 'privacy' ? versions.data?.[doc]?.effectiveDate : undefined) ?? d.effectiveDate;

  useEffect(() => { document.title = `${d.title} · 365 Connect`; return () => { document.title = '365 Connect'; }; }, [d.title]);
  // Switching between documents via the footer must start at the top.
  useEffect(() => { window.scrollTo(0, 0); setTocOpen(false); }, [doc]);

  function goBack() {
    if (window.history.length > 1) window.history.back();
    else navigate('/');
  }

  function jump(id: string) {
    setTocOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col" data-testid={`legal-page-${doc}`}>
      {/* Header */}
      <header className="print-hidden px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 flex items-center gap-2">
        <button type="button" onClick={goBack} aria-label="Back"
          className="w-11 h-11 -ml-2 rounded-full flex items-center justify-center text-[#0A1628]">
          <ChevronLeft size={22} aria-hidden />
        </button>
        <span className="font-extrabold text-[16px] tracking-[-0.5px] text-[#0A1628] flex-1">365 CONNECT</span>
        <button type="button" onClick={() => window.print()} aria-label="Print"
          className="w-11 h-11 -mr-2 rounded-full flex items-center justify-center text-[#6B7280]">
          <Printer size={18} aria-hidden />
        </button>
      </header>

      {/* Title */}
      <div className="px-5 pt-2 pb-4">
        <h1 className="text-[28px] font-bold text-[#0A1628] leading-tight tracking-tight">{d.title}</h1>
        <p className="text-[#6B7280] text-[14px] mt-2" data-testid="legal-effective">
          Effective date: <span className="text-[#111827] font-semibold">{formatLegalDate(effective)}</span>
        </p>
      </div>

      {/* Sticky, collapsible table of contents */}
      <nav aria-label="On this page" className="print-hidden sticky top-0 z-10 bg-white/95 backdrop-blur border-y border-[#E5E7EB]">
        <button type="button" onClick={() => setTocOpen((v) => !v)} aria-expanded={tocOpen} aria-controls="legal-toc"
          className="w-full min-h-[48px] px-5 flex items-center justify-between text-left" data-testid="legal-toc-toggle">
          <span className="text-[14px] font-semibold text-[#111827]">On this page</span>
          <ChevronDown size={18} aria-hidden className={`text-[#6B7280] transition-transform ${tocOpen ? 'rotate-180' : ''}`} />
        </button>
        {tocOpen && (
          <ol id="legal-toc" className="px-5 pb-3 max-h-[50dvh] overflow-y-auto">
            {d.sections.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => jump(s.id)}
                  className="w-full min-h-[44px] py-2 text-left text-[14px] text-[#374151] border-b border-[#F3F4F6] last:border-none">
                  {s.heading}
                </button>
              </li>
            ))}
          </ol>
        )}
      </nav>

      {/* Document */}
      <main className="px-5 pt-4 pb-8 flex-1">
        <LegalDocumentBody doc={d} />
      </main>

      {/* Footer */}
      <footer className="print-hidden px-5 pb-[calc(env(safe-area-inset-bottom)+32px)] pt-6 border-t border-[#E5E7EB]">
        <p className="text-[#6B7280] text-[13px] font-semibold uppercase tracking-[0.12em] mb-2">Also read</p>
        <ul className="flex flex-col" data-testid="legal-footer-links">
          {others.map((id) => (
            <li key={id}>
              <Link href={`/${id}`} className="inline-flex items-center min-h-[44px] text-[#0A1628] text-[15px] font-semibold underline underline-offset-2"
                data-testid={`legal-link-${id}`}>
                {LEGAL_DOCS[id].title}
              </Link>
            </li>
          ))}
        </ul>

        <LegalContactBlock />

        <LegalCreditsLine className="mt-5" />
        <p className="text-[#6B7280] text-[12px] mt-3">
          © {new Date().getFullYear()} {LEGAL.entityName}. {LEGAL.governingLaw}, United States.
        </p>
      </footer>
    </div>
  );
}
