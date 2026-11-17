import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { serverApi } from '@/lib/server-api';
import { Browse } from '@/components/marketplace/browse';

export async function generateMetadata() {
  const t = await getTranslations('search');
  return { title: t('title') };
}

export default async function CreatorsPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const cats = (await serverApi<any[]>('/categories')) ?? [];
  return (
    <Suspense>
      <Browse categories={cats} />
    </Suspense>
  );
}
