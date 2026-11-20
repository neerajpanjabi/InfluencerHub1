import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LegalPage } from '@/components/marketplace/legal-page';

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('pages.businessTerms.title') };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <LegalPage doc="business-terms" titleKey="pages.businessTerms.title" introKey="pages.businessTerms.intro" sectionsKey="pages.businessTerms.sections" appliesKey="pages.legal.appliesBusiness" />;
}
