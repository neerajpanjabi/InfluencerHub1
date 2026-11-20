'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/hooks/use-error';
import { fmtMoney } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Dialog, EmptyState, PageHeader } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';

export default function Packages() {
  const t = useTranslations();
  const locale = useLocale();
  const qc = useQueryClient();
  const toast = useToast();
  const err = useErrorMessage();
  const { data } = useQuery({ queryKey: ['packages'], queryFn: () => api<any[]>('/services/packages') });
  const services = useQuery({ queryKey: ['my-services'], queryFn: () => api<any[]>('/services/mine') });
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: '', description: '', price: '', deliveryDays: 7, qty: {} as Record<string, number> });
  const sum = (services.data ?? []).reduce((a, s) => a + (f.qty[s.id] ?? 0) * Number(s.price), 0);
  return (
    <div className="max-w-4xl">
      <PageHeader title={t('influencer.packages.title')} actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />{t('influencer.packages.add')}</Button>} />
      {!data?.length ? <EmptyState icon={<Package className="h-8 w-8" />} title={t('influencer.packages.empty')} /> : (
        <div className="space-y-3">
          {data.map((p) => (
            <Card key={p.id}>
              <CardBody className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="font-medium">{p.title}</p>
                  <p className="text-xs text-stone-500">{p.items.map((i: any) => `${i.quantity}× ${i.service.title}`).join(' · ')}</p>
                </div>
                <p className="font-semibold">{fmtMoney(p.price, locale)}</p>
                <Button size="sm" variant="ghost" onClick={async () => { await api(`/services/packages/${p.id}`, { method: 'DELETE' }); qc.invalidateQueries({ queryKey: ['packages'] }); }}>{t('influencer.services.archive')}</Button>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={t('influencer.packages.add')} wide>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api('/services/packages', { body: { title: f.title, description: f.description || undefined, price: Number(f.price), deliveryDays: Number(f.deliveryDays), items: Object.entries(f.qty).filter(([, q]) => q > 0).map(([serviceId, quantity]) => ({ serviceId, quantity })) } });
              qc.invalidateQueries({ queryKey: ['packages'] });
              setOpen(false);
            } catch (e2) {
              toast(err(e2), 'error');
            }
          }}
        >
          <Field label={t('influencer.services.title_')}><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label={t('influencer.services.description')}><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <p className="text-sm font-medium">{t('influencer.packages.items')}</p>
          {services.data?.map((s) => (
            <div key={s.id} className="flex items-center gap-3 text-sm">
              <Input type="number" min={0} max={20} className="w-20" value={f.qty[s.id] ?? 0} onChange={(e) => setF({ ...f, qty: { ...f.qty, [s.id]: Number(e.target.value) } })} />
              <span className="flex-1">{s.title}</span>
              <span className="text-stone-500">{fmtMoney(s.price, locale)}</span>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('influencer.services.price')} hint={`Σ ${fmtMoney(sum, locale)}`}><Input type="number" min={1} required value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
            <Field label={t('influencer.services.deliveryDays')}><Input type="number" min={1} value={f.deliveryDays} onChange={(e) => setF({ ...f, deliveryDays: Number(e.target.value) })} /></Field>
          </div>
          <Button type="submit" className="w-full">{t('common.create')}</Button>
        </form>
      </Dialog>
    </div>
  );
}
