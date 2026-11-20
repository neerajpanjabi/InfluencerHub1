import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LegalPage } from '@/components/marketplace/legal-page';

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('pages.creatorTerms.title') };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <LegalPage doc="creator-terms" titleKey="pages.creatorTerms.title" introKey="pages.creatorTerms.intro" sectionsKey="pages.creatorTerms.sections" appliesKey="pages.legal.appliesCreator" />;
}
