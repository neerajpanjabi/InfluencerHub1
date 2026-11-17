'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Select } from '@/components/ui/input';
import { EmptyState, PageHeader, Table, Td } from '@/components/ui/misc';
import { useAdmin, useAdminAction } from '@/components/portal/admin-kit';

export default function Verifications() {
  const t = useTranslations();
  const locale = useLocale();
  const [type, setType] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const { data } = useAdmin<any[]>(`/verifications${type ? `?type=${type}` : ''}`, ['admin', 'verif', type]);
  const act = useAdminAction();
  return (
    <div>
      <PageHeader title={t('admin.nav.verifications')} actions={<Select value={type} onChange={(e) => setType(e.target.value)} className="w-56"><option value="">{t('common.all')}</option>{['IDENTITY', 'MEDICAL_QUALIFICATION', 'BUSINESS_LICENCE', 'ADVERTISER_PERMIT', 'SOCIAL_ACCOUNT'].map((x) => <option key={x}>{x}</option>)}</Select>} />
      {!data?.length ? <EmptyState title={t('common.empty')} /> : (
        <Table head={[t('common.date'), 'Type', t('common.details'), 'Documents', t('admin.notes'), t('admin.decide')]}>
          {data.map((v) => (
            <tr key={v.id}>
              <Td className="whitespace-nowrap text-xs">{fmtDate(v.createdAt, locale, true)}</Td>
              <Td><Badge tone="navy">{v.type}</Badge></Td>
              <Td className="text-xs">{v.user.influencerProfile?.displayName ?? v.user.businessProfile?.businessName} <span className="text-stone-500">({v.user.email})</span>{v.data && <pre className="mt-1 max-w-xs whitespace-pre-wrap text-[11px] text-stone-500">{JSON.stringify(v.data)}</pre>}</Td>
              <Td className="text-xs">{v.documentIds.map((d: string) => <a key={d} href={`/api/v1/uploads/${d}`} target="_blank" rel="noreferrer" className="block underline">{d.slice(0, 8)}</a>)}</Td>
              <Td><Input className="h-8 w-40" value={notes[v.id] ?? ''} onChange={(e) => setNotes({ ...notes, [v.id]: e.target.value })} /></Td>
              <Td className="space-x-1 whitespace-nowrap">
                <Button size="sm" onClick={() => act(() => api(`/admin/verifications/${v.id}/decide`, { body: { decision: 'VERIFIED', notes: notes[v.id] } }))}>{t('admin.approve')}</Button>
                <Button size="sm" variant="outline" onClick={() => act(() => api(`/admin/verifications/${v.id}/decide`, { body: { decision: 'REJECTED', notes: notes[v.id] } }))}>{t('admin.reject')}</Button>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
