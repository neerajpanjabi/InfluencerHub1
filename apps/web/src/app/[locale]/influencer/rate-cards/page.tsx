'use client';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Tag } from 'lucide-react';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/hooks/use-error';
import { fmtMoney } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Alert, Dialog, EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';

const empty = { catalogKey: 'ig_reel', title: '', titleAr: '', description: '', price: '', promoPrice: '', promoEndsAt: '', minimumPrice: '', deliveryDays: 5, revisions: 1, usageRights: '', usageRightsDays: '', exclusivityDays: '', taxTreatment: 'STANDARD', status: 'ACTIVE' };

export default function RateCards() {
  const t = useTranslations();
  const locale = useLocale();
  const qc = useQueryClient();
  const toast = useToast();
  const err = useErrorMessage();
  const { data, isLoading } = useQuery({ queryKey: ['my-services'], queryFn: () => api<any[]>('/services/mine') });
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: () => api<any[]>('/services/catalog') });
  const [edit, setEdit] = useState<null | { id?: string; f: any }>(null);
  const f = edit?.f;
  const ur = f?.usageRightsDays ? Math.ceil(Number(f.usageRightsDays) / 30) : 0;
  const ex = f?.exclusivityDays ? Math.ceil(Number(f.exclusivityDays) / 30) : 0;
  const suggestion = useQuery({ queryKey: ['suggestion', f?.catalogKey, ur, ex], queryFn: () => api<any>(`/services/suggestion?catalogKey=${f.catalogKey}&usageRightsMonths=${ur}&exclusivityMonths=${ex}`), enabled: !!f?.catalogKey });
  const set = (k: string) => (e: React.ChangeEvent<any>) => setEdit({ ...edit!, f: { ...f, [k]: e.target.value } });
  useEffect(() => {
    if (f && !f.title && catalog.data) {
      const c = catalog.data.find((x) => x.key === f.catalogKey);
      if (c) setEdit({ ...edit!, f: { ...f, title: c.nameEn, titleAr: c.nameAr } });
    }
  }, [f?.catalogKey, catalog.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = (v: string) => (v === '' || v == null ? null : Number(v));
  const save = async () => {
    try {
      const body = { ...f, price: Number(f.price), promoPrice: n(f.promoPrice), promoEndsAt: f.promoEndsAt ? new Date(f.promoEndsAt).toISOString() : null, minimumPrice: n(f.minimumPrice), deliveryDays: Number(f.deliveryDays), revisions: Number(f.revisions), usageRightsDays: n(f.usageRightsDays), exclusivityDays: n(f.exclusivityDays), titleAr: f.titleAr || null, description: f.description || null, usageRights: f.usageRights || null };
      await api(edit!.id ? `/services/mine/${edit!.id}` : '/services/mine', { method: edit!.id ? 'PATCH' : 'POST', body });
      qc.invalidateQueries({ queryKey: ['my-services'] });
      setEdit(null);
      toast(t('common.saved'));
    } catch (e) {
      toast(err(e), 'error');
    }
  };
  const s = suggestion.data;
  return (
    <div className="max-w-4xl">
      <PageHeader title={t('influencer.services.title')} description={t('influencer.services.subtitle')} actions={<Button onClick={() => setEdit({ f: { ...empty } })}><Plus className="h-4 w-4" /> {t('influencer.services.add')}</Button>} />
      {isLoading ? <Skeleton className="h-40" /> : !data?.length ? <EmptyState icon={<Tag className="h-8 w-8" />} title={t('influencer.services.empty')} /> : (
        <div className="space-y-3">
          {data.map((sv) => (
            <Card key={sv.id}>
              <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <p className="font-medium">{sv.title} <Badge tone={sv.status === 'ACTIVE' ? 'success' : 'neutral'}>{sv.status === 'ACTIVE' ? t('influencer.services.active') : t('influencer.services.paused')}</Badge></p>
                  <p className="text-xs text-stone-500">{t(`enums.platform.${sv.platform}` as any)} · {t('common.days', { count: sv.deliveryDays })} · {t('common.revisions', { count: sv.revisions })}{sv.suggestedPrice && ` · ${t('influencer.services.suggested')} ${fmtMoney(sv.suggestedPrice, locale)}`}</p>
                </div>
                <p className="text-lg font-semibold">{sv.promoPrice && <span className="me-2 text-sm text-stone-400 line-through">{fmtMoney(sv.price, locale)}</span>}{fmtMoney(sv.promoPrice ?? sv.price, locale)}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEdit({ id: sv.id, f: { ...empty, ...Object.fromEntries(Object.entries(sv).map(([k, v]) => [k, v ?? ''])), catalogKey: sv.catalog.key, promoEndsAt: sv.promoEndsAt ? sv.promoEndsAt.slice(0, 16) : '' } })}>{t('common.edit')}</Button>
                  <Button size="sm" variant="ghost" onClick={async () => { await api(`/services/mine/${sv.id}`, { method: 'DELETE' }); qc.invalidateQueries({ queryKey: ['my-services'] }); }}>{t('influencer.services.archive')}</Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? t('common.edit') : t('influencer.services.add')} wide>
        {f && (
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <div className="sm:col-span-2">
              <Field label={t('influencer.services.serviceType')}>
                <Select value={f.catalogKey} onChange={(e) => setEdit({ ...edit!, f: { ...f, catalogKey: e.target.value, title: '' } })} disabled={!!edit?.id}>
                  {catalog.data?.map((c) => <option key={c.key} value={c.key}>{locale === 'ar' ? c.nameAr : c.nameEn} — {t(`enums.platform.${c.platform}` as any)}</option>)}
                </Select>
              </Field>
            </div>
            {s && (
              <div className="sm:col-span-2">
                <Alert>
                  <p className="font-medium">{t('influencer.services.suggested')}: {fmtMoney(s.suggested, locale)} · {t('influencer.services.suggestedRange', { low: s.low, high: s.high })}</p>
                  <p className="text-xs">{t(`influencer.services.suggestionBasis.${s.basis}` as any)}{s.isSampleData && ` · ${t('influencer.services.sampleWarning')}`}</p>
                  <p className="text-xs text-stone-500">{s.disclaimer}</p>
                  <Button type="button" size="sm" variant="link" onClick={() => setEdit({ ...edit!, f: { ...f, price: String(s.suggested) } })}>{t('influencer.services.useSuggestion')}</Button>
                </Alert>
              </div>
            )}
            <Field label={t('influencer.services.title_')}><Input required value={f.title} onChange={set('title')} /></Field>
            <Field label={t('influencer.services.titleAr')}><Input dir="rtl" value={f.titleAr} onChange={set('titleAr')} /></Field>
            <div className="sm:col-span-2"><Field label={t('influencer.services.description')}><Textarea rows={3} value={f.description} onChange={set('description')} /></Field></div>
            <Field label={t('influencer.services.price')}><Input type="number" min={1} required value={f.price} onChange={set('price')} /></Field>
            <Field label={t('influencer.services.minimumPrice')}><Input type="number" min={1} value={f.minimumPrice} onChange={set('minimumPrice')} /></Field>
            <Field label={t('influencer.services.promoPrice')}><Input type="number" min={1} value={f.promoPrice} onChange={set('promoPrice')} /></Field>
            <Field label={t('influencer.services.promoEnds')}><Input type="datetime-local" value={f.promoEndsAt} onChange={set('promoEndsAt')} /></Field>
            <Field label={t('influencer.services.deliveryDays')}><Input type="number" min={1} max={180} value={f.deliveryDays} onChange={set('deliveryDays')} /></Field>
            <Field label={t('influencer.services.revisions')}><Input type="number" min={0} max={10} value={f.revisions} onChange={set('revisions')} /></Field>
            <Field label={t('influencer.services.usageRightsDays')}><Input type="number" min={0} value={f.usageRightsDays} onChange={set('usageRightsDays')} /></Field>
            <Field label={t('influencer.services.exclusivityDays')}><Input type="number" min={0} value={f.exclusivityDays} onChange={set('exclusivityDays')} /></Field>
            <div className="sm:col-span-2"><Field label={t('influencer.services.usageRights')}><Input value={f.usageRights} onChange={set('usageRights')} /></Field></div>
            <Field label={t('influencer.services.taxTreatment')}><Select value={f.taxTreatment} onChange={set('taxTreatment')}>{['STANDARD', 'ZERO_RATED', 'EXEMPT', 'OUT_OF_SCOPE'].map((x) => <option key={x} value={x}>{t(`enums.taxTreatment.${x}` as any)}</option>)}</Select></Field>
            <Field label={t('common.status')}><Select value={f.status} onChange={set('status')}><option value="ACTIVE">{t('influencer.services.active')}</option><option value="PAUSED">{t('influencer.services.paused')}</option></Select></Field>
            <div className="sm:col-span-2"><Button type="submit" className="w-full">{t('common.save')}</Button></div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
