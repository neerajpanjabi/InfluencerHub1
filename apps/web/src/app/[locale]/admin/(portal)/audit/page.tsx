'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { fmtDate } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { PageHeader, Table, Td } from '@/components/ui/misc';
import { useAdmin } from '@/components/portal/admin-kit';

export default function Audit() {
  const t = useTranslations();
  const locale = useLocale();
  const [action, setAction] = useState('');
  const { data } = useAdmin<any[]>(`/audit-logs${action ? `?action=${encodeURIComponent(action)}` : ''}`, ['admin', 'audit', action]);
  return (
    <div>
      <PageHeader title={t('admin.nav.audit')} actions={<Input placeholder="action prefix e.g. admin." className="w-64" onKeyDown={(e) => e.key === 'Enter' && setAction((e.target as HTMLInputElement).value)} />} />
      <Table head={[t('common.date'), 'Actor', 'Action', 'Entity', 'Change', 'IP']}>
        {data?.map((l) => (
          <tr key={l.id}>
            <Td className="whitespace-nowrap text-xs">{fmtDate(l.createdAt, locale, true)}</Td>
            <Td className="text-xs">{l.actor?.email ?? 'system'}</Td>
            <Td className="text-xs font-medium">{l.action}</Td>
            <Td className="text-xs">{l.entityType} {l.entityId?.slice(0, 8)}</Td>
            <Td><pre className="max-w-md whitespace-pre-wrap text-[11px] text-stone-500">{l.before ? `− ${JSON.stringify(l.before)}\n` : ''}{l.after ? `+ ${JSON.stringify(l.after)}` : ''}</pre></Td>
            <Td className="text-xs">{l.ipAddress}</Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
