import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { serverApi } from '@/lib/server-api';
import { CategoryIcon } from '@/components/marketplace/category-icon';

export async function generateMetadata() {
  return { title: (await getTranslations('nav'))('categories') };
}

export default async function Categories({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const t = await getTranslations();
  const locale = await getLocale();
  const cats = (await serverApi<any[]>('/categories')) ?? [];
  const n = (c: any) => (locale === 'ar' ? c.nameAr : c.nameEn);
  return (
    <div className="container py-12">
      <h1 className="font-display text-4xl text-navy-900">{t('home.categoriesTitle')}</h1>
      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {cats.map((c) => (
          <div key={c.slug} className="rounded-lg border border-stone-200 bg-white p-6 shadow-soft">
            <Link href={`/creators?category=${c.slug}`} className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded bg-navy-900 text-gold-400">
                <CategoryIcon name={c.icon} className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-display text-lg text-navy-900">{n(c)}</span>
                <span className="text-xs text-stone-500">{t('home.statsCreators', { count: c.influencerCount })}</span>
              </span>
            </Link>
            {c.children.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {c.children.map((ch: any) => (
                  <li key={ch.slug}>
                    <Link href={`/creators?category=${ch.slug}`} className="inline-block rounded bg-ivory-100 px-2 py-1 text-xs text-navy-800 hover:bg-gold-100">
                      {n(ch)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
