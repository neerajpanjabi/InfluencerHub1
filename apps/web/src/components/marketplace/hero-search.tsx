'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { EMIRATES, SERVICE_CATALOG_SEEDS, toSearchQuery } from '@influencehub/shared';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';

export function HeroSearch({ categories }: { categories: Array<{ slug: string; nameEn: string; nameAr: string }> }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [f, setF] = useState({ q: '', category: '', serviceType: '', platform: '', emirate: '', maxPrice: '' });
  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const qs = toSearchQuery({
      q: f.q || undefined,
      category: f.category ? [f.category] : undefined,
      serviceType: f.serviceType ? [f.serviceType] : undefined,
      platform: f.platform ? [f.platform as any] : undefined,
      emirate: f.emirate ? [f.emirate as any] : undefined,
      maxPrice: f.maxPrice ? Number(f.maxPrice) : undefined,
    });
    router.push(`/creators${qs ? `?${qs}` : ''}`);
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form onSubmit={go} className="rounded-xl bg-white p-3 shadow-lift ring-1 ring-black/5" role="search">
      <div className="flex items-center gap-2 border-b border-stone-100 px-2 pb-3">
        <Search className="h-5 w-5 text-stone-400" />
        <input value={f.q} onChange={set('q')} placeholder={t('home.searchPlaceholder')} className="h-10 w-full bg-transparent text-base text-navy-900 placeholder:text-stone-400 focus:outline-none" aria-label={t('common.search')} />
      </div>
      <div className="grid grid-cols-2 gap-2 pt-3 md:grid-cols-6">
        <Select value={f.category} onChange={set('category')} aria-label={t('home.industry')}>
          <option value="">{t('home.anyIndustry')}</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {locale === 'ar' ? c.nameAr : c.nameEn}
            </option>
          ))}
        </Select>
        <Select value={f.serviceType} onChange={set('serviceType')} aria-label={t('home.service')}>
          <option value="">{t('home.anyService')}</option>
          {SERVICE_CATALOG_SEEDS.map((s) => (
            <option key={s.key} value={s.key}>
              {locale === 'ar' ? s.ar : s.en}
            </option>
          ))}
        </Select>
        <Select value={f.platform} onChange={set('platform')} aria-label={t('home.platform')}>
          <option value="">{t('home.anyPlatform')}</option>
          <option value="INSTAGRAM">{t('enums.platform.INSTAGRAM')}</option>
          <option value="TIKTOK">{t('enums.platform.TIKTOK')}</option>
        </Select>
        <Select value={f.emirate} onChange={set('emirate')} aria-label={t('home.location')}>
          <option value="">{t('home.anyLocation')}</option>
          {EMIRATES.map((e) => (
            <option key={e} value={e}>
              {t(`enums.emirate.${e}`)}
            </option>
          ))}
        </Select>
        <Input type="number" min={0} inputMode="numeric" value={f.maxPrice} onChange={set('maxPrice')} placeholder={t('home.budget')} aria-label={t('home.budget')} />
        <Button type="submit" variant="gold" className="col-span-2 md:col-span-1">
          {t('home.searchButton')}
        </Button>
      </div>
    </form>
  );
}
