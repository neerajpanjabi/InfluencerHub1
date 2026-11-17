'use client';
import { useLocale, useTranslations, useMessages } from 'next-intl';
import { Card, CardBody } from '@/components/ui/card';
import { PageHeader, StatCard } from '@/components/ui/misc';

const count = (o: any): number => Object.values(o).reduce((a: number, v: any) => a + (v && typeof v === 'object' ? count(v) : 1), 0);

export default function Localization() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const messages = useMessages();
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={t('nav.localization')} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t('keys')} value={count(messages)} hint={locale.toUpperCase()} />
        <StatCard label="Locales" value="EN · AR" hint="LTR · RTL" />
        <StatCard label="Default" value="EN" />
      </div>
      <Card><CardBody className="text-sm leading-relaxed">{t('localizationBody')}<p className="mt-3 text-stone-500">Categories, services and notifications store bilingual content (nameEn/nameAr, titleAr, bilingual email templates). Run <code>pnpm --filter @influencehub/localization test</code> to verify key parity.</p></CardBody></Card>
    </div>
  );
}
