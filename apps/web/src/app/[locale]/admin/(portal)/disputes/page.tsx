'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Dialog, EmptyState, PageHeader, Table, Td } from '@/components/ui/misc';
import { useAdmin, useAdminAction } from '@/components/portal/admin-kit';

export default function Disputes() {
  const t = useTranslations();
  const locale = useLocale();
  const { data } = useAdmin<any[]>('/disputes');
  const act = useAdminAction();
  const [d, setD] = useState<any>(null);
  return (
    <div>
      <PageHeader title={t('admin.nav.disputes')} />
      {!data?.length ? <EmptyState title={t('common.empty')} /> : (
        <Table head={[t('common.date'), t('campaign.title'), t('admin.reason'), t('common.status'), '']}>
          {data.map((x) => (
            <tr key={x.id}>
              <Td className="text-xs">{fmtDate(x.createdAt, locale)}</Td>
              <Td>{x.campaign.number} · {x.campaign.title}<p className="text-xs text-stone-500">{x.campaign.business.businessName} ↔ {x.campaign.influencer.displayName}</p></Td>
              <Td>{x.reason}<p className="text-xs text-stone-500">{x.details}</p></Td>
              <Td><StatusBadge status={x.status} label={x.status} /></Td>
              <Td><Button size="sm" onClick={() => setD({ id: x.id, status: 'RESOLVED_BUSINESS', resolution: '', refundAmount: '', campaignOutcome: 'CANCELLED' })}>{t('admin.resolve')}</Button></Td>
            </tr>
          ))}
        </Table>
      )}
      <Dialog open={!!d} onClose={() => setD(null)} title={t('admin.resolve')}>
        {d && (
          <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); const r = await act(() => api(`/admin/disputes/${d.id}/resolve`, { body: { status: d.status, resolution: d.resolution, refundAmount: d.refundAmount ? Number(d.refundAmount) : undefined, campaignOutcome: d.campaignOutcome || undefined } })); if (r) setD(null); }}>
            <Field label={t('common.status')}><Select value={d.status} onChange={(e) => setD({ ...d, status: e.target.value })}>{['UNDER_REVIEW', 'RESOLVED_BUSINESS', 'RESOLVED_INFLUENCER', 'RESOLVED_SPLIT', 'CLOSED'].map((s) => <option key={s}>{s}</option>)}</Select></Field>
            <Field label={t('admin.outcome')}><Select value={d.campaignOutcome} onChange={(e) => setD({ ...d, campaignOutcome: e.target.value })}><option value="">—</option>{['COMPLETED', 'CANCELLED', 'IN_PROGRESS'].map((s) => <option key={s}>{s}</option>)}</Select></Field>
            <Field label={t('admin.refundAmount')}><Input type="number" step="0.01" min={0} value={d.refundAmount} onChange={(e) => setD({ ...d, refundAmount: e.target.value })} /></Field>
            <Field label={t('admin.resolution')}><Textarea value={d.resolution} onChange={(e) => setD({ ...d, resolution: e.target.value })} /></Field>
            <Button type="submit" className="w-full">{t('admin.resolve')}</Button>
          </form>
        )}
      </Dialog>
    </div>
  );
}
