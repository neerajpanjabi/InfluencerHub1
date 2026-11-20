import { getTranslations } from 'next-intl/server';
import { FileText } from 'lucide-react';
import { LEGAL_DOCUMENTS, type LegalDocumentKey } from '@influencehub/shared';
import { Link } from '@/i18n/routing';
import { PrintButton } from './print-button';

const DOCS: Array<{ key: LegalDocumentKey; labelKey: string }> = [
  { key: 'platform-terms', labelKey: 'nav.terms' },
  { key: 'business-terms', labelKey: 'nav.businessTerms' },
  { key: 'creator-terms', labelKey: 'nav.creatorTerms' },
  { key: 'privacy', labelKey: 'nav.privacy' },
];

/** Long-form legal document: numbered sections, contents sidebar, version, related documents. */
export async function LegalPage({ doc, titleKey, introKey, sectionsKey, appliesKey }: { doc: LegalDocumentKey; titleKey: string; introKey?: string; sectionsKey: string; appliesKey: string }) {
  const t = await getTranslations();
  const sections = (t.raw(sectionsKey) as Array<{ h: string; p: string | string[] }>).map((s) => ({ ...s, p: Array.isArray(s.p) ? s.p : [s.p] }));
  const anchor = (i: number) => `section-${i + 1}`;
  return (
    <div className="container py-12">
      <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
        <aside className="order-2 lg:order-1 lg:sticky lg:top-24 lg:self-start print:hidden">
          <p className="eyebrow mb-3">{t('pages.legal.contents')}</p>
          <ol className="space-y-1.5 text-sm">
            {sections.map((s, i) => (
              <li key={i}>
                <a href={`#${anchor(i)}`} className="flex gap-2 text-stone-600 hover:text-navy-900">
                  <span className="w-5 shrink-0 text-gold-600">{i + 1}.</span>
                  {s.h}
                </a>
              </li>
            ))}
          </ol>
          <p className="eyebrow mb-3 mt-8">{t('pages.legal.related')}</p>
          <ul className="space-y-1.5 text-sm">
            {DOCS.filter((d) => d.key !== doc).map((d) => (
              <li key={d.key}>
                <Link href={LEGAL_DOCUMENTS[d.key].path} className="flex items-center gap-2 text-navy-700 hover:underline">
                  <FileText className="h-3.5 w-3.5" />
                  {t(d.labelKey as any)}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
        <article className="order-1 max-w-3xl lg:order-2">
          <div className="gold-rule mb-6" />
          <h1 className="font-display text-4xl text-navy-900 md:text-5xl">{t(titleKey as any)}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-stone-500">
            <span>{t('pages.legal.version', { version: `\u2066${LEGAL_DOCUMENTS[doc].version}\u2069` })}</span>
            <span>
              {t('pages.legal.appliesTo')}: {t(appliesKey as any)}
            </span>
            <PrintButton label={t('pages.legal.print')} />
          </div>
          <p className="mt-5 rounded border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">{t('pages.legal.draftNotice')}</p>
          {introKey && <p className="mt-6 text-lg leading-relaxed text-stone-700">{t(introKey as any)}</p>}
          <div className="mt-10 space-y-9">
            {sections.map((s, i) => (
              <section key={i} id={anchor(i)} className="scroll-mt-24">
                <h2 className="font-display text-xl text-navy-900">
                  <span className="me-2 text-gold-600">{i + 1}.</span>
                  {s.h}
                </h2>
                {s.p.map((para, j) => (
                  <p key={j} className="mt-2 leading-relaxed text-stone-700">
                    {para}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}
