'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fmtDate, fmtMoney } from '@/lib/format';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, PageHeader, Skeleton, Table, Td } from '@/components/ui/misc';
import { InvoiceView } from '@/components/portal/invoice-view';

export default function Payments() {
  const t = useTranslations();
  const locale = useLocale();
  const [inv, setInv] = useState<any>(null);
  const { data, isLoading } = useQuery({ queryKey: ['billing'], queryFn: () => api<any>('/billing') });
  if (isLoading || !data) return <Skeleton className="h-48" />;
  return (
    <div className="space-y-8">
      <PageHeader title={t('business.payments.title')} />
      <Table head={[t('common.date'), t('common.details'), t('common.amount'), t('common.status')]}>
        {data.payments.map((p: any) => (
          <tr key={p.id}>
            <Td className="whitespace-nowrap">{fmtDate(p.createdAt, locale, true)}</Td>
            <Td>
              {t(`business.payments.purpose.${p.purpose}` as any)} — {p.order?.number ?? p.contactPurchase?.influencer.displayName}
            </Td>
            <Td>{fmtMoney(p.amount, locale, { decimals: true })}</Td>
            <Td>
              <StatusBadge status={p.status} label={t(`enums.paymentStatus.${p.status}` as any)} />
            </Td>
          </tr>
        ))}
      </Table>
      <div>
        <h2 className="mb-3 font-display text-xl">{t('business.payments.invoices')}</h2>
        <Table head={[t('business.orders.invoice'), t('common.date'), t('common.total'), '']}>
          {data.invoices.map((i: any) => (
            <tr key={i.id}>
              <Td>{i.number}</Td>
              <Td>{fmtDate(i.issuedAt, locale)}</Td>
              <Td>{fmtMoney(i.total, locale, { decimals: true })}</Td>
              <Td>
                <Button variant="link" size="sm" onClick={() => setInv(i)}>
                  {t('common.details')}
                </Button>
              </Td>
            </tr>
          ))}
        </Table>
      </div>
      <Dialog open={!!inv} onClose={() => setInv(null)} title={t('business.orders.invoice')} wide>
        {inv && <InvoiceView inv={inv} locale={locale} />}
      </Dialog>
    </div>
  );
}
