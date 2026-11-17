import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Logo } from './logo';

export function SiteFooter() {
  const t = useTranslations();
  const cols = [
    { title: t('footer.marketplace'), links: [['/creators', t('nav.browse')], ['/categories', t('nav.categories')], ['/discover', t('nav.aiDiscovery')], ['/pricing', t('nav.pricing')]] },
    { title: t('footer.company'), links: [['/about', t('nav.about')], ['/how-it-works', t('nav.howItWorks')], ['/for-businesses', t('nav.forBusinesses')], ['/for-influencers', t('nav.forInfluencers')], ['/contact', t('nav.contact')], ['/faq', t('nav.faq')]] },
    { title: t('footer.legal'), links: [['/terms', t('nav.terms')], ['/privacy', t('nav.privacy')]] },
  ];
  return (
    <footer className="mt-24 bg-navy-900 text-ivory/80">
      <div className="container grid gap-10 py-14 md:grid-cols-4">
        <div>
          <Logo onDark />
          <p className="mt-4 max-w-xs text-sm leading-relaxed">{t('common.positioning')}</p>
          <p className="mt-4 text-xs text-ivory/50">{t('footer.madeIn')}</p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <p className="eyebrow mb-4 text-gold-400">{c.title}</p>
            <ul className="space-y-2.5 text-sm">
              {c.links.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="hover:text-ivory">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="container py-5 text-xs text-ivory/50">{t('footer.rights', { year: new Date().getFullYear() })}</div>
      </div>
    </footer>
  );
}
