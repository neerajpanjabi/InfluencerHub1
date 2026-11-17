'use client';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Bookmark } from 'lucide-react';
import { api } from '@/lib/api';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';
import { CreatorCard } from '@/components/marketplace/creator-card';

export default function Saved() {
  const t = useTranslations();
  const { data, isLoading } = useQuery({ queryKey: ['saved'], queryFn: () => api<any[]>('/saved') });
  return (
    <div>
      <PageHeader title={t('business.nav.saved')} />
      {isLoading ? <Skeleton className="h-48" /> : !data?.length ? <EmptyState icon={<Bookmark className="h-8 w-8" />} title={t('common.empty')} /> : <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{data.map((s) => <CreatorCard key={s.influencer.id} c={s.influencer} />)}</div>}
    </div>
  );
}
