'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/input';
import { PageHeader, Skeleton } from '@/components/ui/misc';
import { useAdmin, useAdminAction } from '@/components/portal/admin-kit';

export default function PlatformSettings() {
  const t = useTranslations('admin');
  const platform = useAdmin<any>('/settings/platform');
  const messaging = useAdmin<any>('/settings/messaging');
  const act = useAdminAction();
  const [p, setP] = useState<any>(null);
  const [m, setM] = useState<any>(null);
  useEffect(() => { if (platform.data) setP(platform.data); }, [platform.data]);
  useEffect(() => { if (messaging.data) setM({ ...messaging.data, bannedTerms: messaging.data.bannedTerms.join('\n') }); }, [messaging.data]);
  if (!p || !m) return <Skeleton className="h-64" />;
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={t('nav.settings')} />
      <Card>
        <CardHeader title="Platform" />
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <Field label="Legal name"><Input value={p.legalName} onChange={(e) => setP({ ...p, legalName: e.target.value })} /></Field>
          <Field label="TRN"><Input value={p.trn ?? ''} onChange={(e) => setP({ ...p, trn: e.target.value || null })} /></Field>
          <Field label="Address"><Input value={p.address} onChange={(e) => setP({ ...p, address: e.target.value })} /></Field>
          <Field label="Support email"><Input type="email" value={p.supportEmail} onChange={(e) => setP({ ...p, supportEmail: e.target.value })} /></Field>
          <Field label="Auto-complete after publish (days)"><Input type="number" value={p.autoCompleteDaysAfterPublish} onChange={(e) => setP({ ...p, autoCompleteDaysAfterPublish: Number(e.target.value) })} /></Field>
          <Field label="Payout hold (days)"><Input type="number" value={p.payoutHoldDays} onChange={(e) => setP({ ...p, payoutHoldDays: Number(e.target.value) })} /></Field>
          <Checkbox label="Maintenance mode" checked={p.maintenanceMode} onChange={(e) => setP({ ...p, maintenanceMode: e.target.checked })} />
          <Checkbox label="Require business approval" checked={p.requireBusinessApproval} onChange={(e) => setP({ ...p, requireBusinessApproval: e.target.checked })} />
          <div className="sm:col-span-2"><Button onClick={() => act(() => api('/admin/settings/platform', { method: 'PATCH', body: { legalName: p.legalName, trn: p.trn, address: p.address, supportEmail: p.supportEmail, autoCompleteDaysAfterPublish: p.autoCompleteDaysAfterPublish, payoutHoldDays: p.payoutHoldDays, maintenanceMode: p.maintenanceMode, requireBusinessApproval: p.requireBusinessApproval } }))}>{t('saveSettings')}</Button></div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Messaging & spam prevention" />
        <CardBody className="grid gap-3">
          <Field label="Max messages per minute"><Input type="number" value={m.maxMessagesPerMinute} onChange={(e) => setM({ ...m, maxMessagesPerMinute: Number(e.target.value) })} /></Field>
          <Checkbox label="Block contact details before booking" checked={m.blockContactDetailsBeforeBooking} onChange={(e) => setM({ ...m, blockContactDetailsBeforeBooking: e.target.checked })} />
          <Field label="Banned terms (one per line)"><Textarea rows={5} value={m.bannedTerms} onChange={(e) => setM({ ...m, bannedTerms: e.target.value })} /></Field>
          <div><Button onClick={() => act(() => api('/admin/settings/messaging', { method: 'PATCH', body: { maxMessagesPerMinute: m.maxMessagesPerMinute, blockContactDetailsBeforeBooking: m.blockContactDetailsBeforeBooking, bannedTerms: m.bannedTerms.split('\n').map((x: string) => x.trim()).filter(Boolean) } }))}>{t('saveSettings')}</Button></div>
        </CardBody>
      </Card>
    </div>
  );
}
