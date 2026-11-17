'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { EMIRATES } from '@influencehub/shared';
import { useRouter } from '@/i18n/routing';
import { api } from '@/lib/api';
import { useInvalidateMe } from '@/hooks/use-me';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Checkbox, Field, Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/misc';

const GOALS = ['awareness', 'launch', 'footfall', 'bookings', 'sales', 'event'] as const;

export default function BusinessOnboarding() {
  const t = useTranslations();
  const router = useRouter();
  const invalidate = useInvalidateMe();
  const [goals, setGoals] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<string[]>(['INSTAGRAM']);
  const [emirates, setEmirates] = useState<string[]>([]);
  const [budget, setBudget] = useState('');
  const [busy, setBusy] = useState(false);
  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <div className="max-w-2xl">
      <PageHeader title={t('business.onboarding.title')} description={t('business.onboarding.subtitle')} />
      <Card>
        <CardBody className="space-y-6">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t('business.onboarding.goals')}</legend>
            <div className="grid grid-cols-2 gap-2">
              {GOALS.map((g) => (
                <Checkbox key={g} label={t(`business.onboarding.goalOptions.${g}`)} checked={goals.includes(g)} onChange={() => toggle(goals, setGoals, g)} />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t('business.onboarding.platforms')}</legend>
            <div className="flex gap-4">
              {['INSTAGRAM', 'TIKTOK'].map((p) => (
                <Checkbox key={p} label={t(`enums.platform.${p}` as any)} checked={platforms.includes(p)} onChange={() => toggle(platforms, setPlatforms, p)} />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t('business.onboarding.targetEmirates')}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {EMIRATES.map((e) => (
                <Checkbox key={e} label={t(`enums.emirate.${e}`)} checked={emirates.includes(e)} onChange={() => toggle(emirates, setEmirates, e)} />
              ))}
            </div>
          </fieldset>
          <Field label={t('business.onboarding.monthlyBudget')}>
            <Input type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} className="max-w-xs" />
          </Field>
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await api('/businesses/me', { method: 'PATCH', body: { completeOnboarding: true, campaignPreferences: { goals, platforms, targetEmirates: emirates, monthlyBudget: budget ? Number(budget) : undefined } } });
              invalidate();
              router.replace('/business');
            }}
          >
            {t('business.onboarding.finish')}
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
