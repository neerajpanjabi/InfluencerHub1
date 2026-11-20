'use client';
import { useLocale, useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { fmtDate, fmtMoney } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { PageHeader, Table, Td } from '@/components/ui/misc';
import { useAdmin, useAdminAction } from '@/components/portal/admin-kit';

export default function Payouts() {
  const t = useTranslations();
  const locale = useLocale();
  const { data } = useAdmin<any[]>('/payouts');
  const act = useAdminAction();
  return (
    <div>
      <PageHeader title={t('admin.nav.payouts')} actions={<Button onClick={() => act(() => api('/admin/payouts/batch', { method: 'POST' }))}>{t('admin.batchPayouts')}</Button>} />
      <Table head={[t('common.date'), t('enums.userType.INFLUENCER'), t('common.amount'), t('common.status'), t('admin.reference'), t('common.actions')]}>
        {data?.map((p) => (
          <tr key={p.id}>
            <Td className="text-xs">{fmtDate(p.createdAt, locale)}</Td>
            <Td>{p.influencer.displayName}</Td>
            <Td>{fmtMoney(p.amount, locale, { decimals: true })}</Td>
            <Td><StatusBadge status={p.status} label={t(`enums.payoutStatus.${p.status}` as any)} /></Td>
            <Td className="text-xs">{p.reference ?? '—'}</Td>
            <Td className="space-x-1 whitespace-nowrap">
              {p.status !== 'PAID' && (
                <>
                  <Button size="sm" onClick={() => { const ref = prompt(t('admin.reference')); if (ref) void act(() => api(`/admin/payouts/${p.id}/paid`, { body: { reference: ref } })); }}>{t('admin.markPaid')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => act(() => api(`/admin/payouts/${p.id}/status`, { body: { status: 'ON_HOLD' } }))}>{t('enums.payoutStatus.ON_HOLD')}</Button>
                </>
              )}
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
