'use client';
import { useLocale, useTranslations } from 'next-intl';
import { fmtDate, fmtMoney } from '@/lib/format';
import { StatusBadge } from '@/components/ui/badge';
import { Alert, PageHeader, Table, Td } from '@/components/ui/misc';
import { useAdmin } from '@/components/portal/admin-kit';

export default function Refunds() {
  const t = useTranslations();
  const locale = useLocale();
  const { data } = useAdmin<any[]>('/refunds');
  return (
    <div>
      <PageHeader title={t('admin.nav.refunds')} />
      <Alert className="mb-4">Issue refunds for order lines from Bookings. Refund reversals are posted to the immutable ledger automatically.</Alert>
      <Table head={[t('common.date'), 'Order', t('common.amount'), t('admin.reason'), t('common.status'), 'Provider ref']}>
        {data?.map((r) => (
          <tr key={r.id}>
            <Td className="text-xs">{fmtDate(r.createdAt, locale, true)}</Td>
            <Td className="text-xs">{r.order?.number ?? r.payment.purpose}</Td>
            <Td>{fmtMoney(r.amount, locale, { decimals: true })}</Td>
            <Td className="text-sm">{r.reason}</Td>
            <Td><StatusBadge status={r.status} label={r.status} /></Td>
            <Td className="text-xs">{r.providerRefundId ?? '—'}</Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
