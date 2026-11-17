'use client';
import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { SlidersHorizontal, X } from 'lucide-react';
import { EMIRATES, LANGUAGES, SERVICE_CATALOG_SEEDS, SORT_OPTIONS } from '@influencehub/shared';
import { usePathname, useRouter } from '@/i18n/routing';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select } from '@/components/ui/input';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { CreatorCard, type CreatorCardData } from './creator-card';

interface Cat { slug: string; nameEn: string; nameAr: string; children: Array<{ slug: string; nameEn: string; nameAr: string }> }

export function Browse({ categories }: { categories: Cat[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const qs = sp.toString();
  const [showFilters, setShowFilters] = useState(false);
  const [draftQ, setDraftQ] = useState(sp.get('q') ?? '');
  useEffect(() => setDraftQ(sp.get('q') ?? ''), [sp]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['influencers', qs],
    queryFn: () => api<{ items: CreatorCardData[]; total: number; page: number; pages: number }>(`/influencers?${qs}`),
    placeholderData: (prev) => prev,
  });

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (value == null || value === '') next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.delete('page');
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  const val = (k: string) => sp.get(k) ?? '';
  const flag = (k: string) => sp.get(k) === 'true';
  const activeCount = useMemo(() => Array.from(sp.keys()).filter((k) => !['page', 'sort', 'q'].includes(k)).length, [sp]);
  const name = (c: { nameEn: string; nameAr: string }) => (locale === 'ar' ? c.nameAr : c.nameEn);

  const filters = (
    <div className="space-y-4">
      <Field label={t('search.category')}>
        <Select value={val('category')} onChange={(e) => set('category', e.target.value)}>
          <option value="">{t('common.all')}</option>
          {categories.map((c) => (
            <optgroup key={c.slug} label={name(c)}>
              <option value={c.slug}>{name(c)}</option>
              {c.children.map((ch) => (
                <option key={ch.slug} value={ch.slug}>
                  — {name(ch)}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </Field>
      <Field label={t('search.platform')}>
        <Select value={val('platform')} onChange={(e) => set('platform', e.target.value)}>
          <option value="">{t('common.all')}</option>
          <option value="INSTAGRAM">{t('enums.platform.INSTAGRAM')}</option>
          <option value="TIKTOK">{t('enums.platform.TIKTOK')}</option>
        </Select>
      </Field>
      <Field label={t('search.emirate')}>
        <Select value={val('emirate')} onChange={(e) => set('emirate', e.target.value)}>
          <option value="">{t('home.anyLocation')}</option>
          {EMIRATES.map((e) => (
            <option key={e} value={e}>
              {t(`enums.emirate.${e}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('search.serviceType')}>
        <Select value={val('serviceType')} onChange={(e) => set('serviceType', e.target.value)}>
          <option value="">{t('home.anyService')}</option>
          {SERVICE_CATALOG_SEEDS.map((s) => (
            <option key={s.key} value={s.key}>
              {locale === 'ar' ? s.ar : s.en}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('search.grade')}>
        <Select value={val('grade')} onChange={(e) => set('grade', e.target.value)}>
          <option value="">{t('common.all')}</option>
          <option value="S">S</option>
          <option value="S,A">A+</option>
          <option value="S,A,B">B+</option>
          <option value="S,A,B,C">C+</option>
        </Select>
      </Field>
      <Field label={t('search.language')}>
        <Select value={val('language')} onChange={(e) => set('language', e.target.value)}>
          <option value="">{t('common.all')}</option>
          {Object.keys(LANGUAGES).map((code) => (
            <option key={code} value={code}>
              {t(`enums.language.${code}` as any)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('search.gender')}>
        <Select value={val('gender')} onChange={(e) => set('gender', e.target.value)}>
          <option value="">{t('common.all')}</option>
          <option value="FEMALE">{t('enums.gender.FEMALE')}</option>
          <option value="MALE">{t('enums.gender.MALE')}</option>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        {(['minFollowers', 'maxFollowers', 'minReelViews', 'minStoryViews', 'minVideoViews', 'minEngagement', 'minPrice', 'maxPrice'] as const).map((k) => (
          <Field key={k} label={<span className="text-xs">{t(`search.${k}`)}</span>}>
            <Input type="number" min={0} defaultValue={val(k)} key={`${k}-${val(k)}`} onBlur={(e) => e.target.value !== val(k) && set(k, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && set(k, (e.target as HTMLInputElement).value)} />
          </Field>
        ))}
      </div>
      <Checkbox label={t('search.verifiedOnly')} checked={flag('verifiedOnly')} onChange={(e) => set('verifiedOnly', e.target.checked ? 'true' : null)} />
      <Checkbox label={t('search.medicalVerifiedOnly')} checked={flag('medicalVerifiedOnly')} onChange={(e) => set('medicalVerifiedOnly', e.target.checked ? 'true' : null)} />
      <Checkbox label={t('search.availableOnly')} checked={flag('availableOnly')} onChange={(e) => set('availableOnly', e.target.checked ? 'true' : null)} />
      {activeCount > 0 && (
        <Button variant="link" onClick={() => router.replace(pathname)}>
          {t('common.clear')}
        </Button>
      )}
    </div>
  );

  return (
    <div className="container py-10">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl text-navy-900">{t('search.title')}</h1>
          <p className="mt-1 text-sm text-stone-500">{t('search.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              set('q', draftQ);
            }}
            role="search"
          >
            <Input value={draftQ} onChange={(e) => setDraftQ(e.target.value)} placeholder={t('home.searchPlaceholder')} className="w-64" aria-label={t('search.keyword')} />
          </form>
          <Select value={val('sort') || 'relevance'} onChange={(e) => set('sort', e.target.value)} className="w-48" aria-label={t('search.sort')}>
            {SORT_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {t(`search.sorts.${s}`)}
              </option>
            ))}
          </Select>
          <Button variant="outline" className="lg:hidden" onClick={() => setShowFilters(true)}>
            <SlidersHorizontal className="h-4 w-4" /> {t('common.filters')} {activeCount ? `(${activeCount})` : ''}
          </Button>
        </div>
      </div>
      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block" aria-label={t('common.filters')}>
          {filters}
        </aside>
        {showFilters && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-ivory p-5 lg:hidden">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-display text-xl">{t('common.filters')}</p>
              <Button variant="ghost" size="icon" onClick={() => setShowFilters(false)} aria-label={t('common.close')}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            {filters}
            <Button className="mt-6 w-full" onClick={() => setShowFilters(false)}>
              {t('common.apply')}
            </Button>
          </div>
        )}
        <div>
          <p className="mb-4 text-sm text-stone-500" aria-live="polite">
            {data ? t('common.results', { count: data.total }) : ' '}
          </p>
          {isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-64" />
              ))}
            </div>
          ) : isError ? (
            <EmptyState title={t('common.error')} />
          ) : !data?.items.length ? (
            <EmptyState title={t('search.noResults')} body={t('search.noResultsHint')} />
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {data.items.map((c) => (
                  <CreatorCard key={c.id} c={c} />
                ))}
              </div>
              {data.pages > 1 && (
                <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Pagination">
                  <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => set('page', String(data.page - 1))}>
                    {t('common.previous')}
                  </Button>
                  <span className="text-sm text-stone-500">{t('common.page', { page: data.page, pages: data.pages })}</span>
                  <Button variant="outline" size="sm" disabled={data.page >= data.pages} onClick={() => set('page', String(data.page + 1))}>
                    {t('common.next')}
                  </Button>
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
