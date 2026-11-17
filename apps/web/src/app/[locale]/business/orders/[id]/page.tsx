'use client';
import { use, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@/i18n/routing';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/hooks/use-error';
import { fmtDate, fmtMoney } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { Alert, Dialog, PageHeader, Skeleton, Table, Td } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { InvoiceView } from '@/components/portal/invoice-view';

export default function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations();
  const locale = useLocale();
  const toast = useToast();
  const err = useErrorMessage();
  const sp = useSearchParams();
  const [inv, setInv] = useState<any>(null);
  const { data: o, isLoading } = useQuery({ queryKey: ['order', id], queryFn: () => api<any>(`/orders/${id}`) });
  useEffect(() => {
    if (sp.get('payment') === 'succeeded') toast(t('business.orders.paymentSuccess'));
    if (sp.get('payment') === 'failed') toast(t('business.orders.paymentFailed'), 'error');
  }, [sp, t, toast]);
  if (isLoading || !o) return <Skeleton className="h-64" />;
  const m = (v: string) => fmtMoney(v, locale, { decimals: true });
  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t('business.orders.order')} ${o.number}`}
        description={fmtDate(o.createdAt, locale, true)}
        actions={
          <>
            <StatusBadge status={o.status} label={t(`enums.orderStatus.${o.status}` as any)} />
            {o.status === 'PENDING_PAYMENT' && (
              <Button
                onClick={async () => {
                  try {
                    const r = await api(`/orders/${id}/pay`, { method: 'POST' });
                    window.location.href = r.checkoutUrl;
                  } catch (e) {
                    toast(err(e), 'error');
                  }
                }}
              >
                {t('business.orders.pay')}
              </Button>
            )}
          </>
        }
      />
      {sp.get('payment') === 'succeeded' && o.status === 'PAID' && <Alert tone="success">{t('business.orders.paymentSuccess')}</Alert>}
      <Table head={[t('business.orders.items'), t('enums.userType.INFLUENCER'), t('campaign.title'), t('common.amount'), 'VAT']}>
        {o.items.map((i: any) => (
          <tr key={i.id}>
            <Td>{i.description} × {i.quantity}</Td>
            <Td>{i.influencer.displayName}</Td>
            <Td>{i.campaign ? <Link className="underline" href={`/business/campaigns/${i.campaign.id}`}>{i.campaign.number}</Link> : '—'} {i.campaign && <StatusBadge status={i.campaign.status} label={t(`enums.campaignStatus.${i.campaign.status}` as any)} />}</Td>
            <Td>{m(i.grossAmount)}</Td>
            <Td>{m(i.vatAmount)}</Td>
          </tr>
        ))}
      </Table>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader title={t('common.total')} />
          <CardBody>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between"><dt>{t('business.cart.subtotal')}</dt><dd>{m(o.subtotal)}</dd></div>
              {Number(o.discountTotal) > 0 && <div className="flex justify-between"><dt>{t('business.cart.discount')}</dt><dd>−{m(o.discountTotal)}</dd></div>}
              {Number(o.businessCommissionTotal) > 0 && <div className="flex justify-between"><dt>{t('business.cart.serviceFee')}</dt><dd>{m(o.businessCommissionTotal)}</dd></div>}
              <div className="flex justify-between"><dt>VAT ({o.vatRate}%)</dt><dd>{m(o.vatTotal)}</dd></div>
              <div className="flex justify-between font-semibold"><dt>{t('common.total')}</dt><dd>{m(o.grandTotal)}</dd></div>
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t('business.payments.title')} />
          <CardBody className="space-y-2 text-sm">
            {o.payments.map((p: any) => (
              <div key={p.id} className="flex justify-between">
                <span>{fmtDate(p.createdAt, locale, true)} · {p.provider}</span>
                <StatusBadge status={p.status} label={t(`enums.paymentStatus.${p.status}` as any)} />
              </div>
            ))}
            {o.invoices.map((i: any) => (
              <Button key={i.id} variant="link" onClick={() => setInv(i)}>
                {t('business.orders.invoice')} {i.number}
              </Button>
            ))}
            {o.refunds.length > 0 && (
              <div className="border-t border-stone-100 pt-2">
                <p className="font-medium">{t('business.orders.refunds')}</p>
                {o.refunds.map((r: any) => (
                  <p key={r.id}>{m(r.amount)} — {r.reason} ({r.status})</p>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
      <Dialog open={!!inv} onClose={() => setInv(null)} title={t('business.orders.invoice')} wide>
        {inv && <InvoiceView inv={inv} locale={locale} />}
      </Dialog>
    </div>
  );
}
