import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContentPage } from '@/components/marketplace/content-page';

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('pages.pricing.title') };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const t = await getTranslations();
  return <ContentPage title={t('pages.pricing.title')} intro={t('pages.pricing.intro')} sections={[{ h: `${t('pages.pricing.browse')} — ${t('pages.pricing.browseValue')}`, p: t('search.subtitle') }, { h: `${t('pages.pricing.contact')} — ${t('pages.pricing.contactValue')}`, p: t('pages.pricing.contactNote') }, { h: `${t('pages.pricing.commission')} — ${t('pages.pricing.commissionValue')}`, p: t('pages.pricing.commissionNote') }, { h: t('common.aed'), p: t('pages.pricing.vat') }]} cta={{ href: '/register', label: t('nav.register') }} />;
}
