import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContentPage } from '@/components/marketplace/content-page';

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('pages.how.title') };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const t = await getTranslations();
  return <ContentPage title={t('pages.how.title')} intro={t('pages.how.intro')} sections={[1, 2, 3, 4].map((n) => ({ h: `0${n} · ${t(`home.how${n}Title` as any)}`, p: t(`home.how${n}Body` as any) }))} cta={{ href: '/creators', label: t('nav.browse') }} />;
}
