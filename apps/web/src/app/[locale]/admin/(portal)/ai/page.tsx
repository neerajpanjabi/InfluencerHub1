'use client';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { PageHeader, StatCard, Table, Td } from '@/components/ui/misc';
import { useAdmin, useAdminAction } from '@/components/portal/admin-kit';

export default function AiAdmin() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const q = useAdmin<any>('/ai/quality');
  const logs = useAdmin<any[]>('/ai/logs');
  const settings = useAdmin<any>('/settings/ai');
  const act = useAdminAction();
  const [max, setMax] = useState(20);
  useEffect(() => { if (settings.data) setMax(settings.data.maxResults); }, [settings.data]);
  return (
    <div className="space-y-6">
      <PageHeader title={t('nav.ai')} description="Provider: LLM_PROVIDER env (rules-based parser fallback). Results always come from database records." />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t('searches')} value={q.data?.searches ?? '—'} />
        <StatCard label={t('zeroRate')} value={q.data ? `${Math.round(q.data.zeroResultRate * 100)}%` : '—'} />
        <StatCard label={t('helpfulRate')} value={q.data?.helpfulRate != null ? `${Math.round(q.data.helpfulRate * 100)}% (${q.data.feedbackCount})` : '—'} />
      </div>
      <Card><CardHeader title={t('saveSettings')} /><CardBody className="flex items-end gap-3"><Field label="Max results"><Input type="number" min={1} max={50} value={max} onChange={(e) => setMax(Number(e.target.value))} /></Field><Button onClick={() => act(() => api('/admin/settings/ai', { method: 'PATCH', body: { maxResults: max } }))}>{t('saveSettings')}</Button></CardBody></Card>
      <Table head={['Date', 'Query', 'Parser', 'Results', 'Latency', 'Top matches']}>
        {logs.data?.map((l) => (
          <tr key={l.id}>
            <Td className="text-xs">{fmtDate(l.createdAt, locale, true)}</Td>
            <Td className="max-w-xs text-sm">{l.query}</Td>
            <Td className="text-xs">{l.parser}</Td>
            <Td>{l.resultCount}</Td>
            <Td className="text-xs">{l.latencyMs} ms</Td>
            <Td className="text-xs">{l.recommendations.map((r: any) => `${r.rank}. ${r.influencer.displayName}${r.feedback.length ? (r.feedback[0].helpful ? ' 👍' : ' 👎') : ''}`).join(' · ')}</Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
