'use client';
import { useLocale, useTranslations } from 'next-intl';
import { fmtDate, fmtMoney } from '@/lib/format';
import { StatusBadge } from '@/components/ui/badge';
import { PageHeader, Table, Td } from '@/components/ui/misc';
import { useAdmin } from '@/components/portal/admin-kit';

export default function Payments() {
  const t = useTranslations();
  const locale = useLocale();
  const { data } = useAdmin<any[]>('/payments');
  return (
    <div>
      <PageHeader title={t('admin.nav.payments')} />
      <Table head={[t('common.date'), 'Purpose', 'Ref', 'Provider', t('common.amount'), 'Fee', t('common.status'), 'Webhook events']}>
        {data?.map((p) => (
          <tr key={p.id}>
            <Td className="text-xs">{fmtDate(p.createdAt, locale, true)}</Td>
            <Td className="text-xs">{p.purpose}</Td>
            <Td className="text-xs">{p.order?.number ?? `${p.contactPurchase?.business.businessName} → ${p.contactPurchase?.influencer.displayName}`}</Td>
            <Td className="text-xs">{p.provider}</Td>
            <Td>{fmtMoney(p.amount, locale, { decimals: true })}</Td>
            <Td className="text-xs">{p.processingFee ? fmtMoney(p.processingFee, locale, { decimals: true }) : '—'}</Td>
            <Td><StatusBadge status={p.status} label={t(`enums.paymentStatus.${p.status}` as any)} /></Td>
            <Td className="text-[11px] text-stone-500">{p.events.map((e: any, i: number) => <div key={i}>{e.type}{e.error ? ` ⚠ ${e.error}` : ''}</div>)}</Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
