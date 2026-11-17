'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { fmtDate, fmtMoney } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { Field, Input } from '@/components/ui/input';
import { Dialog, PageHeader, Table, Td } from '@/components/ui/misc';
import { useAdmin, useAdminAction } from '@/components/portal/admin-kit';

export default function Orders() {
  const t = useTranslations();
  const locale = useLocale();
  const { data } = useAdmin<any[]>('/orders');
  const act = useAdminAction();
  const [refund, setRefund] = useState<any>(null);
  return (
    <div>
      <PageHeader title={t('admin.nav.orders')} />
      <Table head={[t('business.orders.order'), t('enums.userType.BUSINESS'), t('business.orders.items'), t('common.total'), t('common.status'), t('common.date')]}>
        {data?.map((o) => (
          <tr key={o.id}>
            <Td className="text-xs">{o.number}</Td>
            <Td>{o.business.businessName}</Td>
            <Td className="text-xs">
              {o.items.map((i: any) => (
                <div key={i.id} className="flex items-center gap-2 py-0.5">
                  {i.description} — {i.influencer.displayName} {i.campaign && <StatusBadge status={i.campaign.status} label={i.campaign.number} />}
                  {['PAID', 'PARTIALLY_REFUNDED'].includes(o.status) && <Button size="sm" variant="ghost" onClick={() => setRefund({ item: i, amount: '', reason: '' })}>{t('admin.issueRefund')}</Button>}
                </div>
              ))}
            </Td>
            <Td className="whitespace-nowrap">{fmtMoney(o.grandTotal, locale, { decimals: true })}</Td>
            <Td><StatusBadge status={o.status} label={t(`enums.orderStatus.${o.status}` as any)} /></Td>
            <Td className="whitespace-nowrap text-xs">{fmtDate(o.createdAt, locale)}</Td>
          </tr>
        ))}
      </Table>
      <Dialog open={!!refund} onClose={() => setRefund(null)} title={t('admin.issueRefund')}>
        {refund && (
          <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); const r = await act(() => api('/admin/refunds', { body: { orderItemId: refund.item.id, amount: Number(refund.amount), reason: refund.reason } })); if (r) setRefund(null); }}>
            <p className="text-sm">{refund.item.description} · refundable ≤ {fmtMoney(Number(refund.item.grossAmount) + Number(refund.item.businessCommission) + Number(refund.item.vatAmount) - Number(refund.item.refundedAmount), locale, { decimals: true })}</p>
            <Field label={t('admin.refundAmount')}><Input type="number" step="0.01" min={0.01} required value={refund.amount} onChange={(e) => setRefund({ ...refund, amount: e.target.value })} /></Field>
            <Field label={t('admin.reason')}><Input required minLength={3} value={refund.reason} onChange={(e) => setRefund({ ...refund, reason: e.target.value })} /></Field>
            <Button type="submit" variant="danger" className="w-full">{t('admin.issueRefund')}</Button>
          </form>
        )}
      </Dialog>
    </div>
  );
}
