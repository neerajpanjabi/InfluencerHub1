import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContentPage } from '@/components/marketplace/content-page';

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('pages.about.title') };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const t = await getTranslations();
  return <ContentPage title={t('pages.about.title')} intro={t('pages.about.body')} cta={{ href: '/creators', label: t('nav.browse') }} />;
}
