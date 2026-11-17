'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@/i18n/routing';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/misc';
import { CategoryIcon } from '@/components/marketplace/category-icon';

export default function BizCategories() {
  const t = useTranslations();
  const locale = useLocale();
  const { data } = useQuery({ queryKey: ['categories'], queryFn: () => api<any[]>('/categories') });
  const n = (c: any) => (locale === 'ar' ? c.nameAr : c.nameEn);
  return (
    <div>
      <PageHeader title={t('business.nav.categories')} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.map((c) => (
          <div key={c.slug} className="rounded-lg border border-stone-200 bg-white p-5">
            <Link href={`/business/discover?category=${c.slug}`} className="flex items-center gap-3 font-medium">
              <CategoryIcon name={c.icon} className="h-5 w-5 text-gold-600" /> {n(c)} <span className="text-xs text-stone-400">({c.influencerCount})</span>
            </Link>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {c.children.map((ch: any) => (
                <Link key={ch.slug} href={`/business/discover?category=${ch.slug}`} className="rounded bg-ivory-100 px-2 py-0.5 text-xs hover:bg-gold-100">
                  {n(ch)}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
