import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContentPage } from '@/components/marketplace/content-page';

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('pages.contact.title') };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const t = await getTranslations();
  return <ContentPage title={t('pages.contact.title')} intro={t('pages.contact.body')} sections={[{ h: t('pages.contact.email'), p: 'hello@influencehub.example' }, { h: t('nav.contact'), p: t('pages.contact.address') }]} />;
}
