import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContentPage } from '@/components/marketplace/content-page';

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('home.faqTitle') };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const t = await getTranslations();
  return <ContentPage title={t('home.faqTitle')} sections={(t.raw('faq.items') as Array<{ q: string; a: string }>).map((f) => ({ h: f.q, p: f.a }))} />;
}
