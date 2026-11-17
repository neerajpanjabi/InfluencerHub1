'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Alert, PageHeader, Skeleton, Table, Td } from '@/components/ui/misc';
import { GradeBadge } from '@/components/marketplace/badges';

export default function Grade() {
  const t = useTranslations();
  const locale = useLocale();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['my-grade'], queryFn: () => api<any>('/influencers/me/grade') });
  if (!data) return <Skeleton className="h-64" />;
  const cur = data.current;
  const b = cur?.breakdown ?? {};
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title={t('influencer.grade.title')} actions={<Button variant="outline" onClick={async () => { await api('/influencers/me/grade/recompute', { method: 'POST' }); qc.invalidateQueries({ queryKey: ['my-grade'] }); }}>{t('influencer.grade.recompute')}</Button>} />
      <Alert>{t('profile.gradeDisclaimer')}</Alert>
      <Card>
        <CardHeader title={t('influencer.grade.breakdown')} description={t('influencer.grade.explain')} action={<GradeBadge grade={cur?.grade ?? 'NOT_RATED'} score={cur?.score} size="lg" />} />
        <CardBody>
          {b.reason && <Alert tone="warning" className="mb-4">{t('profile.notRatedReason')} ({b.reason})</Alert>}
          <Table head={[t('profile.performance'), t('influencer.grade.score'), t('influencer.grade.weight'), t('influencer.grade.confidence'), t('profile.source')]}>
            {(b.components ?? []).map((c: any) => (
              <tr key={c.key}>
                <Td>{t(`profile.components.${c.key}` as any)}</Td>
                <Td>{c.normalized != null ? Math.round(c.normalized) : '—'}</Td>
                <Td>{c.weight}%</Td>
                <Td>{Math.round(c.confidence * 100)}%</Td>
                <Td className="text-xs text-stone-500">{c.source ?? '—'}</Td>
              </tr>
            ))}
          </Table>
          <p className="mt-3 text-xs text-stone-500">{t('profile.coverage', { value: Math.round(Number(cur?.dataCoverage ?? 0) * 100) })}</p>
          {b.flags?.length > 0 && <Alert tone="warning" className="mt-3">{t('influencer.grade.flags')}: {b.flags.join(', ')}</Alert>}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t('influencer.grade.history')} />
        <CardBody className="flex flex-wrap gap-3">
          {data.history.map((h: any) => (
            <div key={h.id} className="text-center">
              <GradeBadge grade={h.grade} size="sm" />
              <p className="mt-1 text-[11px] text-stone-500">{fmtDate(h.recordedAt, locale)}</p>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
