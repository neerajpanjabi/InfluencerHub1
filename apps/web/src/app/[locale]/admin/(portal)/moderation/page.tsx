'use client';
import { useLocale, useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { PageHeader, Table, Td } from '@/components/ui/misc';
import { useAdmin, useAdminAction } from '@/components/portal/admin-kit';

export default function Moderation() {
  const t = useTranslations();
  const locale = useLocale();
  const reports = useAdmin<any[]>('/moderation/reports');
  const flagged = useAdmin<any[]>('/moderation/flagged-messages');
  const act = useAdminAction();
  return (
    <div className="space-y-8">
      <PageHeader title={t('admin.nav.moderation')} />
      <Table head={[t('common.date'), 'Target', t('admin.reason'), 'Reporter', t('common.actions')]}>
        {reports.data?.map((r) => (
          <tr key={r.id}>
            <Td className="text-xs">{fmtDate(r.createdAt, locale, true)}</Td>
            <Td className="text-xs">{r.targetType} {r.targetId.slice(0, 8)}</Td>
            <Td>{r.reason}{r.details && <p className="text-xs text-stone-500">{r.details}</p>}</Td>
            <Td className="text-xs">{r.reporter.email}</Td>
            <Td className="space-x-1 whitespace-nowrap">
              {(['DISMISS', 'REMOVE_CONTENT', 'SUSPEND_USER'] as const).map((a) => <Button key={a} size="sm" variant={a === 'DISMISS' ? 'ghost' : 'outline'} onClick={() => act(() => api(`/admin/moderation/reports/${r.id}`, { body: { action: a } }))}>{a.replace('_', ' ').toLowerCase()}</Button>)}
            </Td>
          </tr>
        ))}
      </Table>
      <div>
        <h2 className="mb-3 font-display text-xl">{t('admin.flagged')}</h2>
        <Table head={[t('common.date'), 'Sender', 'Message', t('admin.reason')]}>
          {flagged.data?.map((m) => <tr key={m.id}><Td className="text-xs">{fmtDate(m.createdAt, locale, true)}</Td><Td className="text-xs">{m.sender.email}</Td><Td>{m.body}</Td><Td className="text-xs">{m.flaggedReason}</Td></tr>)}
        </Table>
      </div>
    </div>
  );
}
