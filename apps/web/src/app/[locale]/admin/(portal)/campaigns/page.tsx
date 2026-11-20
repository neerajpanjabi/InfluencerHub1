'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { Select } from '@/components/ui/input';
import { PageHeader, Table, Td } from '@/components/ui/misc';
import { useAdmin, useAdminAction } from '@/components/portal/admin-kit';

export default function Campaigns() {
  const t = useTranslations();
  const locale = useLocale();
  const [compliance, setCompliance] = useState('');
  const { data } = useAdmin<any[]>(`/campaigns${compliance ? `?compliance=${compliance}` : ''}`, ['admin', 'campaigns', compliance]);
  const act = useAdminAction();
  return (
    <div>
      <PageHeader title={t('admin.nav.campaigns')} actions={<Select className="w-60" value={compliance} onChange={(e) => setCompliance(e.target.value)}><option value="">{t('common.all')}</option><option value="PENDING_REVIEW">{t('enums.complianceStatus.PENDING_REVIEW')}</option></Select>} />
      <Table head={['#', t('campaign.title'), t('enums.userType.BUSINESS'), t('enums.userType.INFLUENCER'), t('common.status'), t('campaign.compliance'), t('common.date')]}>
        {data?.map((c) => (
          <tr key={c.id}>
            <Td className="text-xs">{c.number}</Td>
            <Td>{c.title}</Td>
            <Td>{c.business.businessName}</Td>
            <Td>{c.influencer.displayName}</Td>
            <Td><StatusBadge status={c.status} label={t(`enums.campaignStatus.${c.status}` as any)} /></Td>
            <Td className="whitespace-nowrap">
              <StatusBadge status={c.complianceStatus} label={t(`enums.complianceStatus.${c.complianceStatus}` as any)} />
              {c.complianceStatus === 'PENDING_REVIEW' && (
                <span className="ms-2 inline-flex gap-1">
                  <Button size="sm" onClick={() => act(() => api(`/admin/campaigns/${c.id}/compliance`, { body: { status: 'APPROVED', notes: prompt(t('admin.notes')) ?? undefined } }))}>{t('admin.approve')}</Button>
                  <Button size="sm" variant="outline" onClick={() => act(() => api(`/admin/campaigns/${c.id}/compliance`, { body: { status: 'REJECTED', notes: prompt(t('admin.notes')) ?? undefined } }))}>{t('admin.reject')}</Button>
                </span>
              )}
            </Td>
            <Td className="text-xs">{fmtDate(c.updatedAt, locale)}</Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
