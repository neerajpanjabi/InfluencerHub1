'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fmtDate, fmtMoney } from '@/lib/format';
import { StatusBadge } from '@/components/ui/badge';
import { Alert, PageHeader, Skeleton, StatCard, Table, Td } from '@/components/ui/misc';

export default function Earnings() {
  const t = useTranslations();
  const locale = useLocale();
  const { data } = useQuery({ queryKey: ['earnings'], queryFn: () => api<any>('/finance/earnings') });
  if (!data) return <Skeleton className="h-64" />;
  const m = (v: any) => fmtMoney(v, locale, { decimals: true });
  return (
    <div className="space-y-6">
      <PageHeader title={t('influencer.earnings.title')} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t('influencer.earnings.pending')} value={m(data.pending)} />
        <StatCard label={t('influencer.earnings.available')} value={m(data.available)} />
        <StatCard label={t('influencer.earnings.paid')} value={m(data.paidOut)} />
      </div>
      <Alert>{t('influencer.earnings.hold', { days: data.holdDays })}</Alert>
      <h2 className="font-display text-xl">{t('influencer.earnings.commissions')}</h2>
      <Table head={[t('business.orders.order'), t('campaign.title'), t('influencer.earnings.gross'), t('influencer.earnings.commission'), t('influencer.earnings.net'), t('common.status')]}>
        {data.commissions.map((c: any) => (
          <tr key={c.id}>
            <Td>{c.orderItem.order.number}</Td>
            <Td>{c.orderItem.description} {c.orderItem.campaign && <span className="text-xs text-stone-500">({c.orderItem.campaign.number})</span>}</Td>
            <Td>{m(c.grossAmount)}</Td>
            <Td>{m(c.influencerPortion)} <span className="text-xs text-stone-500">({Number(c.rate)}%)</span></Td>
            <Td className="font-medium">{m(Number(c.influencerNet) - Number(c.reversedAmount))}</Td>
            <Td>{c.payoutId ? <StatusBadge status="PAID" label={t('enums.payoutStatus.PAID')} /> : c.releasedAt ? <StatusBadge status="SCHEDULED" label={t('influencer.earnings.available')} /> : <StatusBadge status="PENDING" label={t('enums.payoutStatus.PENDING')} />}</Td>
          </tr>
        ))}
      </Table>
      <h2 className="font-display text-xl">{t('influencer.earnings.payouts')}</h2>
      <Table head={[t('common.date'), t('common.amount'), t('common.status'), t('admin.reference')]}>
        {data.payouts.map((p: any) => (
          <tr key={p.id}>
            <Td>{fmtDate(p.createdAt, locale)}</Td>
            <Td>{m(p.amount)}</Td>
            <Td><StatusBadge status={p.status} label={t(`enums.payoutStatus.${p.status}` as any)} /></Td>
            <Td>{p.reference ?? '—'}</Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
