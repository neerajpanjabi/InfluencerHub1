'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, ShoppingBag, Trash2 } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { api, newIdempotencyKey } from '@/lib/api';
import { useErrorMessage } from '@/hooks/use-error';
import { fmtMoney } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { Alert, EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';

export default function Cart() {
  const t = useTranslations();
  const locale = useLocale();
  const qc = useQueryClient();
  const toast = useToast();
  const err = useErrorMessage();
  const [code, setCode] = useState('');
  const [applied, setApplied] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [key] = useState(newIdempotencyKey);
  const { data, isLoading } = useQuery({ queryKey: ['cart', applied], queryFn: () => api<any>(`/cart${applied ? `?discountCode=${encodeURIComponent(applied)}` : ''}`) });
  const m = (v: string) => fmtMoney(v, locale, { decimals: true });
  if (isLoading || !data) return <Skeleton className="h-64" />;
  const s = data.summary;
  return (
    <div>
      <PageHeader title={t('business.cart.title')} />
      {data.items.length === 0 ? (
        <EmptyState icon={<ShoppingBag className="h-8 w-8" />} title={t('business.cart.empty')} action={<Link href="/business/discover" className="underline">{t('nav.browse')}</Link>} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader title={t('business.orders.items')} description={t('business.cart.perLine')} />
            <div className="divide-y divide-stone-100">
              {data.problems.length > 0 && <Alert tone="danger" className="m-4">{t('business.cart.unavailable')}</Alert>}
              {data.items.map((it: any) => {
                const line = s.lines.find((l: any) => l.key === it.id);
                const problem = data.problems.find((p: any) => p.itemId === it.id);
                return (
                  <div key={it.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
                    <div className="flex-1">
                      <p className="font-medium">{line?.description ?? '—'}</p>
                      <p className="text-sm text-stone-500">
                        {line?.influencerName}
                        {line && ` · ${t('common.days', { count: line.deliveryDays })}`}
                      </p>
                      {problem && <p className="text-xs text-danger">{problem.code}</p>}
                    </div>
                    {it.type !== 'QUOTATION' && (
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        defaultValue={it.quantity}
                        className="w-20"
                        aria-label="Quantity"
                        onBlur={async (e) => {
                          if (Number(e.target.value) !== it.quantity) {
                            await api(`/cart/items/${it.id}`, { method: 'PATCH', body: { quantity: Number(e.target.value) } });
                            qc.invalidateQueries({ queryKey: ['cart'] });
                          }
                        }}
                      />
                    )}
                    <p className="w-28 text-end font-semibold">{line ? m(line.gross) : '—'}</p>
                    <Button variant="ghost" size="icon" aria-label={t('common.remove')} onClick={async () => { await api(`/cart/items/${it.id}`, { method: 'DELETE' }); qc.invalidateQueries({ queryKey: ['cart'] }); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card className="h-fit lg:sticky lg:top-24">
            <CardBody className="space-y-4">
              <div className="flex gap-2">
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('business.cart.discountCode')} />
                <Button variant="outline" onClick={() => setApplied(code.trim())}>
                  {t('common.apply')}
                </Button>
              </div>
              {applied && !data.discountApplied && <p className="text-xs text-danger">{t('errors.DISCOUNT_INVALID')}</p>}
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt>{t('business.cart.subtotal')}</dt><dd>{m(s.subtotal)}</dd></div>
                {Number(s.discount) > 0 && <div className="flex justify-between text-success"><dt>{t('business.cart.discount')}</dt><dd>−{m(s.discount)}</dd></div>}
                {Number(s.serviceFee) > 0 && <div className="flex justify-between"><dt>{t('business.cart.serviceFee')}</dt><dd>{m(s.serviceFee)}</dd></div>}
                <div className="flex justify-between"><dt>{t('business.cart.vat', { rate: s.vatRate })}</dt><dd>{m(s.vat)}</dd></div>
                <div className="flex justify-between border-t border-stone-200 pt-2 text-base font-semibold"><dt>{t('business.cart.total')}</dt><dd>{m(s.total)}</dd></div>
              </dl>
              <Field label={t('business.cart.campaignTitle')}>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
              </Field>
              <Button
                className="w-full"
                size="lg"
                loading={busy}
                disabled={data.problems.length > 0}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await api('/checkout', { body: { idempotencyKey: key, discountCode: data.discountApplied ? applied : undefined, campaignTitle: title || undefined } });
                    if (r.checkoutUrl) window.location.href = r.checkoutUrl;
                  } catch (e) {
                    toast(err(e), 'error');
                    setBusy(false);
                  }
                }}
              >
                <ShieldCheck className="h-4 w-4" /> {t('business.cart.checkout')}
              </Button>
              <p className="text-center text-xs text-stone-500">{t('pages.pricing.vat')}</p>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
