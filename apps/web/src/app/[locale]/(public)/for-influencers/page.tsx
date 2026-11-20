import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContentPage } from '@/components/marketplace/content-page';

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('pages.influencer.title') };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const t = await getTranslations();
  return <ContentPage title={t('pages.influencer.title')} intro={t('pages.influencer.intro')} points={t.raw('pages.influencer.points')} cta={{ href: '/register/influencer', label: t('home.ctaCreator') }} />;
}
