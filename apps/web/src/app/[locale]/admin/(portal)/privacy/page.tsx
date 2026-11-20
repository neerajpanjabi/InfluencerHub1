'use client';
import { useLocale, useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { PageHeader, Table, Td } from '@/components/ui/misc';
import { useAdmin, useAdminAction } from '@/components/portal/admin-kit';

export default function Privacy() {
  const t = useTranslations();
  const locale = useLocale();
  const { data } = useAdmin<any[]>('/privacy/deletions');
  const act = useAdminAction();
  return (
    <div>
      <PageHeader title={t('admin.nav.privacy')} description={t('settings.deleteHint')} />
      <Table head={[t('common.date'), 'User', t('common.status'), t('admin.notes'), '']}>
        {data?.map((r) => (
          <tr key={r.id}>
            <Td className="text-xs">{fmtDate(r.createdAt, locale)}</Td>
            <Td className="text-xs">{r.user.email} ({r.user.type})</Td>
            <Td><StatusBadge status={r.status} label={r.status} /></Td>
            <Td className="text-xs">{r.reason} {r.notes}</Td>
            <Td>{r.status === 'REQUESTED' && <Button size="sm" variant="danger" onClick={() => confirm('Anonymise this user?') && act(() => api(`/admin/privacy/deletions/${r.id}/process`, { method: 'POST' }))}>{t('admin.process')}</Button>}</Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
