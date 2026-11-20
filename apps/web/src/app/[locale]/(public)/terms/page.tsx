import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LegalPage } from '@/components/marketplace/legal-page';

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('pages.terms.title') };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <LegalPage doc="platform-terms" titleKey="pages.terms.title"  sectionsKey="pages.terms.sections" appliesKey="pages.legal.appliesAll" />;
}
