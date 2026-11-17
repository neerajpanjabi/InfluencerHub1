'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/misc';

export default function Availability() {
  const t = useTranslations();
  const locale = useLocale();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['inf-profile'], queryFn: () => api<any>('/influencers/me/profile') });
  const [f, setF] = useState({ startsOn: '', endsOn: '', note: '' });
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={t('influencer.availability.title')} description={t('influencer.availability.subtitle')} />
      <Card>
        <CardBody>
          <form className="grid gap-3 sm:grid-cols-4 sm:items-end" onSubmit={async (e) => { e.preventDefault(); await api('/influencers/me/availability', { body: { ...f, isAvailable: false, note: f.note || undefined } }); qc.invalidateQueries({ queryKey: ['inf-profile'] }); setF({ startsOn: '', endsOn: '', note: '' }); }}>
            <Field label={t('influencer.availability.from')}><Input type="date" required value={f.startsOn} onChange={(e) => setF({ ...f, startsOn: e.target.value })} /></Field>
            <Field label={t('influencer.availability.to')}><Input type="date" required value={f.endsOn} onChange={(e) => setF({ ...f, endsOn: e.target.value })} /></Field>
            <Field label={t('influencer.availability.note')}><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
            <Button type="submit">{t('influencer.availability.block')}</Button>
          </form>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t('influencer.availability.title')} />
        <CardBody>
          {!data?.availability?.length ? <p className="text-sm text-stone-500">{t('influencer.availability.empty')}</p> : (
            <ul className="divide-y divide-stone-100">
              {data.availability.map((a: any) => (
                <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{fmtDate(a.startsOn, locale)} → {fmtDate(a.endsOn, locale)} {a.note && <span className="text-stone-500">· {a.note}</span>}</span>
                  <Button size="sm" variant="ghost" onClick={async () => { await api(`/influencers/me/availability/${a.id}`, { method: 'DELETE' }); qc.invalidateQueries({ queryKey: ['inf-profile'] }); }}>{t('common.remove')}</Button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
