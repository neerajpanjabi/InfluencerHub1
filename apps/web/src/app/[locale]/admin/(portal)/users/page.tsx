'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Input, Select } from '@/components/ui/input';
import { PageHeader, Table, Td } from '@/components/ui/misc';
import { useAdmin, useAdminAction } from '@/components/portal/admin-kit';

export default function Users() {
  const t = useTranslations();
  const locale = useLocale();
  const [q, setQ] = useState({ type: '', status: '', search: '' });
  const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v)).toString();
  const { data } = useAdmin<any>(`/users?${qs}`, ['admin', 'users', qs]);
  const act = useAdminAction();
  return (
    <div>
      <PageHeader title={t('admin.nav.users')} description={data ? t('common.results', { count: data.total }) : ''} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input placeholder={t('common.search')} className="w-64" onKeyDown={(e) => e.key === 'Enter' && setQ({ ...q, search: (e.target as HTMLInputElement).value })} />
        <Select className="w-40" value={q.type} onChange={(e) => setQ({ ...q, type: e.target.value })}>
          <option value="">{t('common.all')}</option>
          {['BUSINESS', 'INFLUENCER', 'ADMIN'].map((x) => <option key={x} value={x}>{t(`enums.userType.${x}` as any)}</option>)}
        </Select>
        <Select className="w-40" value={q.status} onChange={(e) => setQ({ ...q, status: e.target.value })}>
          <option value="">{t('common.all')}</option>
          {['ACTIVE', 'SUSPENDED', 'DELETED'].map((x) => <option key={x} value={x}>{t(`enums.userStatus.${x}` as any)}</option>)}
        </Select>
      </div>
      <Table head={['Email', t('common.details'), t('common.status'), t('common.date'), t('common.actions')]}>
        {data?.items.map((u: any) => (
          <tr key={u.id}>
            <Td className="text-xs">{u.email}<div className="mt-1 flex gap-1">{u.roles.map((r: any) => <Badge key={r.role.key} tone="outline">{r.role.key}</Badge>)}</div></Td>
            <Td>
              {u.businessProfile && <span>{u.businessProfile.businessName} <StatusBadge status={u.businessProfile.verificationStatus} label={u.businessProfile.verificationStatus} /> · credits {u.businessProfile.freeContactCredits}</span>}
              {u.influencerProfile && <span>{u.influencerProfile.displayName} · {u.influencerProfile.currentGrade} {u.influencerProfile.isFeatured && <Badge tone="gold">featured</Badge>}</span>}
            </Td>
            <Td><StatusBadge status={u.status} label={t(`enums.userStatus.${u.status}` as any)} /></Td>
            <Td className="whitespace-nowrap text-xs">{fmtDate(u.createdAt, locale)}</Td>
            <Td className="space-x-1 whitespace-nowrap">
              {u.status === 'ACTIVE' && u.type !== 'ADMIN' && <Button size="sm" variant="outline" onClick={() => act(() => api(`/admin/users/${u.id}/status`, { body: { status: 'SUSPENDED' } }))}>{t('admin.suspend')}</Button>}
              {u.status === 'SUSPENDED' && <Button size="sm" variant="outline" onClick={() => act(() => api(`/admin/users/${u.id}/status`, { body: { status: 'ACTIVE' } }))}>{t('admin.activate')}</Button>}
              {u.influencerProfile && <Button size="sm" variant="ghost" onClick={() => act(() => api(`/admin/influencers/${u.influencerProfile.id}/flags`, { method: 'PATCH', body: { isFeatured: !u.influencerProfile.isFeatured } }))}>{u.influencerProfile.isFeatured ? t('admin.unfeature') : t('admin.feature')}</Button>}
              {u.businessProfile && <Button size="sm" variant="ghost" onClick={() => act(() => api(`/admin/businesses/${u.businessProfile.id}/contact-credits`, { body: { credits: 1 } }))}>+1 {t('admin.grantCredits')}</Button>}
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
