'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { fmtMoney } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { PageHeader, Table, Tabs, Td } from '@/components/ui/misc';
import { useAdmin, useAdminAction } from '@/components/portal/admin-kit';

export default function Reports() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  const [dim, setDim] = useState<'category' | 'influencer' | 'business'>('category');
  const qs = `from=${from}&to=${to}`;
  const rev = useAdmin<any[]>(`/reports/revenue?${qs}&groupBy=${groupBy}`, ['admin', 'rev', qs, groupBy]);
  const br = useAdmin<any[]>(`/reports/breakdown/${dim}?${qs}`, ['admin', 'br', dim, qs]);
  const act = useAdminAction();
  const m = (v: number) => fmtMoney(v, locale, { decimals: true });
  const csv = () => {
    const rows = rev.data ?? [];
    const head = Object.keys(rows[0] ?? {});
    const body = [head.join(','), ...rows.map((r) => head.map((h) => r[h]).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body], { type: 'text/csv' }));
    a.download = `revenue-${from}-${to}.csv`;
    a.click();
  };
  const sum = (k: string) => (rev.data ?? []).reduce((a, r) => a + Number(r[k] ?? 0), 0);
  return (
    <div className="space-y-6">
      <PageHeader title={t('revenueReport')} actions={<><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /><Select value={groupBy} onChange={(e) => setGroupBy(e.target.value as any)} className="w-32"><option value="day">{t('day')}</option><option value="week">{t('week')}</option><option value="month">{t('month')}</option></Select><Button variant="outline" onClick={csv}>CSV</Button><Button variant="outline" onClick={() => act(() => api('/admin/reports/reconcile', { body: { provider: 'sandbox', from: new Date(from).toISOString(), to: new Date(to).toISOString() } }))}>{t('reconcile')}</Button></>} />
      <Table head={['Period', 'GBV', 'Orders', t('dashboard.commission'), t('dashboard.contactFees'), 'VAT', t('dashboard.refunds'), 'Processing fees', 'Payouts', 'Platform net']}>
        {rev.data?.map((r) => (
          <tr key={r.period}>
            <Td className="whitespace-nowrap text-xs">{r.period}</Td>
            <Td>{m(r.grossBookingValue)}</Td>
            <Td>{r.paidOrders}</Td>
            <Td>{m(r.commissionRevenue)}</Td>
            <Td>{m(r.contactFeeRevenue)}</Td>
            <Td>{m(r.vatCollected)}</Td>
            <Td>{m(r.refunds)}</Td>
            <Td>{m(r.processingFees)}</Td>
            <Td>{m(r.payouts)}</Td>
            <Td className="font-medium">{m(r.platformNetRevenue)}</Td>
          </tr>
        ))}
        <tr className="bg-stone-50 font-semibold"><Td>Σ</Td><Td>{m(sum('grossBookingValue'))}</Td><Td>{sum('paidOrders')}</Td><Td>{m(sum('commissionRevenue'))}</Td><Td>{m(sum('contactFeeRevenue'))}</Td><Td>{m(sum('vatCollected'))}</Td><Td>{m(sum('refunds'))}</Td><Td>{m(sum('processingFees'))}</Td><Td>{m(sum('payouts'))}</Td><Td>{m(sum('platformNetRevenue'))}</Td></tr>
      </Table>
      <Tabs value={dim} onChange={setDim} items={[{ value: 'category', label: t('byCategory') }, { value: 'influencer', label: t('byInfluencer') }, { value: 'business', label: t('byBusiness') }]} />
      <Table head={['Name', t('dashboard.commission'), t('dashboard.contactFees'), 'Creator earnings']}>
        {br.data?.map((r) => <tr key={r.id}><Td>{r.name}</Td><Td>{m(r.commission)}</Td><Td>{m(r.contactFees)}</Td><Td>{m(r.creatorEarnings)}</Td></tr>)}
      </Table>
    </div>
  );
}
