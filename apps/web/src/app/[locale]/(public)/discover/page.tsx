import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AiDiscovery } from '@/components/marketplace/ai-discovery';

export async function generateMetadata() {
  return { title: (await getTranslations('ai'))('title') };
}
export default async function Discover({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <AiDiscovery />;
}
