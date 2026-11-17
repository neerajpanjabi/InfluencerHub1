'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Trash2 } from 'lucide-react';
import { useRouter } from '@/i18n/routing';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/hooks/use-error';
import { fmtDate, fmtMoney } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Dialog, EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';

export function QuotationsView({ role }: { role: 'BUSINESS' | 'INFLUENCER' }) {
  const t = useTranslations();
  const locale = useLocale();
  const qc = useQueryClient();
  const toast = useToast();
  const err = useErrorMessage();
  const router = useRouter();
  const { data, isLoading } = useQuery({ queryKey: ['quotations'], queryFn: () => api<any[]>('/quotations') });
  const [respond, setRespond] = useState<any>(null);
  const [items, setItems] = useState([{ description: '', platform: 'INSTAGRAM', quantity: 1, unitPrice: '', deliveryDays: 7 }]);
  const [validDays, setValidDays] = useState(14);
  const [note, setNote] = useState('');
  const refresh = () => qc.invalidateQueries({ queryKey: ['quotations'] });
  const act = async (fn: () => Promise<unknown>, after?: () => void) => {
    try {
      await fn();
      refresh();
      after?.();
    } catch (e) {
      toast(err(e), 'error');
    }
  };
  return (
    <div className="max-w-4xl">
      <PageHeader title={role === 'BUSINESS' ? t('business.nav.quotations') : t('influencer.requests.title')} />
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : !data?.length ? (
        <EmptyState icon={<FileText className="h-8 w-8" />} title={t('common.empty')} />
      ) : (
        <div className="space-y-4">
          {data.map((q) => (
            <Card key={q.id}>
              <CardBody>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{q.number}</span>
                  <StatusBadge status={q.status} label={t(`enums.quotationStatus.${q.status}` as any)} />
                  <span className="text-sm text-stone-500">{role === 'BUSINESS' ? q.influencer.displayName : q.business.businessName}</span>
                  <span className="ms-auto text-xs text-stone-400">{fmtDate(q.createdAt, locale)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">{q.brief}</p>
                {q.requestedBudget && <p className="mt-1 text-xs text-stone-500">{t('influencer.requests.budget')}: {fmtMoney(q.requestedBudget, locale)}</p>}
                {q.items.length > 0 && (
                  <ul className="mt-3 space-y-1 rounded bg-stone-50 p-3 text-sm">
                    {q.items.map((i: any) => (
                      <li key={i.id} className="flex justify-between">
                        <span>
                          {i.quantity}× {i.description} <span className="text-xs text-stone-500">({t(`enums.platform.${i.platform}` as any)}, {t('common.days', { count: i.deliveryDays })})</span>
                        </span>
                        <span>{fmtMoney(Number(i.unitPrice) * i.quantity, locale)}</span>
                      </li>
                    ))}
                    <li className="flex justify-between border-t border-stone-200 pt-1 font-semibold">
                      <span>{t('common.total')}</span>
                      <span>{fmtMoney(q.subtotal, locale)}</span>
                    </li>
                  </ul>
                )}
                {q.influencerNote && <p className="mt-2 text-sm italic text-stone-600">“{q.influencerNote}”</p>}
                {q.validUntil && <p className="mt-1 text-xs text-stone-500">{t('common.to')} {fmtDate(q.validUntil, locale)}</p>}
                <div className="mt-4 flex gap-2">
                  {role === 'BUSINESS' && q.status === 'SUBMITTED' && (
                    <Button size="sm" onClick={() => act(() => api(`/quotations/${q.id}/accept`, { method: 'POST' }), () => router.push('/business/cart'))}>
                      {t('profile.addToCart')}
                    </Button>
                  )}
                  {role === 'INFLUENCER' && q.status === 'REQUESTED' && (
                    <Button size="sm" onClick={() => setRespond(q)}>
                      {t('influencer.requests.respond')}
                    </Button>
                  )}
                  {((role === 'BUSINESS' && ['REQUESTED', 'SUBMITTED'].includes(q.status)) || (role === 'INFLUENCER' && q.status === 'REQUESTED')) && (
                    <Button size="sm" variant="ghost" onClick={() => act(() => api(`/quotations/${q.id}/reject`, { method: 'POST' }))}>
                      {t('influencer.requests.decline')}
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={!!respond} onClose={() => setRespond(null)} title={t('influencer.requests.respond')} wide>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void act(() => api(`/quotations/${respond.id}/submit`, { body: { items: items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice) })), validDays, note: note || undefined } }), () => setRespond(null));
          }}
        >
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-12 items-end gap-2">
              <div className="col-span-12 sm:col-span-4">
                <Field label={t('profile.services')}>
                  <Input required value={it.description} onChange={(e) => setItems(items.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)))} />
                </Field>
              </div>
              <div className="col-span-4 sm:col-span-2">
                <Field label={t('search.platform')}>
                  <Select value={it.platform} onChange={(e) => setItems(items.map((x, i) => (i === idx ? { ...x, platform: e.target.value } : x)))}>
                    {['INSTAGRAM', 'TIKTOK', 'CROSS_PLATFORM', 'OFFLINE'].map((p) => <option key={p} value={p}>{t(`enums.platform.${p}` as any)}</option>)}
                  </Select>
                </Field>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Field label={t('influencer.packages.quantity')}>
                  <Input type="number" min={1} value={it.quantity} onChange={(e) => setItems(items.map((x, i) => (i === idx ? { ...x, quantity: Number(e.target.value) } : x)))} />
                </Field>
              </div>
              <div className="col-span-3 sm:col-span-2">
                <Field label={t('common.aed')}>
                  <Input type="number" min={1} required value={it.unitPrice} onChange={(e) => setItems(items.map((x, i) => (i === idx ? { ...x, unitPrice: e.target.value } : x)))} />
                </Field>
              </div>
              <div className="col-span-2 sm:col-span-2">
                <Field label={t('profile.delivery')}>
                  <Input type="number" min={1} value={it.deliveryDays} onChange={(e) => setItems(items.map((x, i) => (i === idx ? { ...x, deliveryDays: Number(e.target.value) } : x)))} />
                </Field>
              </div>
              <Button type="button" variant="ghost" size="icon" className="col-span-1" onClick={() => setItems(items.filter((_, i) => i !== idx))} disabled={items.length === 1} aria-label={t('common.remove')}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, { description: '', platform: 'INSTAGRAM', quantity: 1, unitPrice: '', deliveryDays: 7 }])}>
            <Plus className="h-4 w-4" /> {t('influencer.requests.addItem')}
          </Button>
          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            <Field label={t('influencer.requests.validDays')}>
              <Input type="number" min={1} max={60} value={validDays} onChange={(e) => setValidDays(Number(e.target.value))} />
            </Field>
            <Field label={t('influencer.requests.note')}>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
          <Button type="submit" className="w-full">
            {t('common.submit')}
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
