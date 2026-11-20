import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContentPage } from '@/components/marketplace/content-page';

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('pages.privacy.title') };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const t = await getTranslations();
  return <ContentPage title={t('pages.privacy.title')} notice={t('pages.privacy.notice')} sections={t.raw('pages.privacy.sections')} />;
}
