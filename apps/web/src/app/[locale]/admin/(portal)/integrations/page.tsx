'use client';
import { useLocale, useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Alert, PageHeader, Table, Td } from '@/components/ui/misc';
import { useAdmin, useAdminAction } from '@/components/portal/admin-kit';

export default function Integrations() {
  const t = useTranslations();
  const locale = useLocale();
  const { data } = useAdmin<any>('/integrations');
  const act = useAdminAction();
  return (
    <div className="space-y-6">
      <PageHeader title={t('admin.nav.integrations')} />
      <Alert>Secrets (API keys, app secrets, webhook secrets) are provided via environment / secret manager and never stored in or shown by the admin UI. See INTEGRATION_SETUP.md.</Alert>
      <Table head={['Provider', 'Status', 'Mode', 'Enabled', 'Public config', 'Last check', '']}>
        {data?.configs.map((c: any) => (
          <tr key={c.id}>
            <Td className="font-medium">{c.provider}</Td>
            <Td><Badge tone={c.status === 'HEALTHY' ? 'success' : c.status === 'AWAITING_APPROVAL' ? 'warning' : 'neutral'}>{c.status}</Badge></Td>
            <Td className="text-xs">{c.mode}</Td>
            <Td>{String(c.isEnabled)}</Td>
            <Td><pre className="max-w-xs whitespace-pre-wrap text-[11px] text-stone-500">{JSON.stringify(c.publicConfig)}</pre></Td>
            <Td className="text-xs">{c.lastCheckedAt ? fmtDate(c.lastCheckedAt, locale, true) : '—'}</Td>
            <Td><Button size="sm" variant="ghost" onClick={() => act(() => api(`/admin/integrations/${c.provider}`, { method: 'PATCH', body: { isEnabled: !c.isEnabled } }))}>{c.isEnabled ? 'Disable' : 'Enable'}</Button></Td>
          </tr>
        ))}
      </Table>
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader title="Social runtime" /><CardBody className="text-sm">{data?.social.map((s: any) => <p key={s.platform}>{s.platform}: live={String(s.live)} sandbox={String(s.sandbox)}</p>)}<p className="mt-2 text-xs text-stone-500">Sync (7 days): {data?.syncLast7Days.map((s: any) => `${s.status} ${s._count}`).join(' · ')}</p></CardBody></Card>
        <Card><CardHeader title="Payments runtime" /><CardBody className="text-sm">{data?.payments.map((p: any) => <p key={p.name}>{p.name}: configured={String(p.configured)} active={String(p.active)}</p>)}<p className="mt-2 text-xs text-stone-500">Webhooks (7 days): {data?.webhooksLast7Days.map((w: any) => `${w.provider} ${w._count}`).join(' · ')} · errors: {data?.webhookErrors}</p></CardBody></Card>
      </div>
    </div>
  );
}
