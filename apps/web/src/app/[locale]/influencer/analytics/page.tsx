'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtDate, fmtNumber } from '@/lib/format';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import { EmptyState, PageHeader } from '@/components/ui/misc';

/** Minimal SVG line chart (no chart library) for metric history. */
function LineChart({ points, locale }: { points: Array<{ x: string; y: number }>; locale: string }) {
  if (points.length < 2) return <p className="text-sm text-stone-500">—</p>;
  const W = 640, H = 220, P = 32;
  const ys = points.map((p) => p.y);
  const min = Math.min(...ys), max = Math.max(...ys);
  const sx = (i: number) => P + (i * (W - 2 * P)) / (points.length - 1);
  const sy = (v: number) => H - P - ((v - min) / (max - min || 1)) * (H - 2 * P);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${sx(i)},${sy(p.y)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="history" style={{ direction: 'ltr' }}>
      {[0, 0.5, 1].map((f) => <line key={f} x1={P} x2={W - P} y1={P + f * (H - 2 * P)} y2={P + f * (H - 2 * P)} stroke="#EFEEEA" />)}
      <path d={`${d} L${sx(points.length - 1)},${H - P} L${sx(0)},${H - P} Z`} fill="#C8A96A" opacity={0.12} />
      <path d={d} fill="none" stroke="#0B1B33" strokeWidth={2} />
      {points.map((p, i) => <circle key={i} cx={sx(i)} cy={sy(p.y)} r={3} fill="#C8A96A" />)}
      <text x={P} y={H - 8} fontSize={11} fill="#7C786F">{fmtDate(points[0].x, locale)}</text>
      <text x={W - P} y={H - 8} fontSize={11} fill="#7C786F" textAnchor="end">{fmtDate(points[points.length - 1].x, locale)}</text>
      <text x={P} y={P - 10} fontSize={11} fill="#7C786F">{fmtNumber(max, locale)}</text>
    </svg>
  );
}

export default function Analytics() {
  const t = useTranslations();
  const locale = useLocale();
  const accounts = useQuery({ queryKey: ['social-accounts'], queryFn: () => api<any>('/social/accounts') });
  const [acc, setAcc] = useState('');
  const [metric, setMetric] = useState('FOLLOWERS');
  const id = acc || accounts.data?.accounts[0]?.id;
  const hist = useQuery({ queryKey: ['history', id, metric], queryFn: () => api<any[]>(`/social/accounts/${id}/history?metric=${metric}`), enabled: !!id });
  if (accounts.data && !accounts.data.accounts.length) return <EmptyState icon={<BarChart3 className="h-8 w-8" />} title={t('influencer.analytics.noData')} />;
  return (
    <div className="max-w-4xl">
      <PageHeader title={t('influencer.analytics.title')} />
      <Card>
        <CardHeader
          title={t('influencer.analytics.history')}
          action={
            <div className="flex gap-2">
              <Select value={id ?? ''} onChange={(e) => setAcc(e.target.value)}>{accounts.data?.accounts.map((a: any) => <option key={a.id} value={a.id}>{a.platform} @{a.username}</option>)}</Select>
              <Select value={metric} onChange={(e) => setMetric(e.target.value)}>{['FOLLOWERS', 'AVG_REEL_VIEWS', 'AVG_STORY_VIEWS', 'AVG_VIDEO_VIEWS', 'ENGAGEMENT_RATE'].map((m) => <option key={m} value={m}>{t(`enums.metric.${m}` as any)}</option>)}</Select>
            </div>
          }
        />
        <CardBody>
          <LineChart locale={locale} points={(hist.data ?? []).map((h) => ({ x: h.collectedAt, y: Number(h.value) }))} />
          <p className="mt-2 text-xs text-stone-500">{hist.data?.[0] && `${t('profile.source')}: ${t(`enums.source.${hist.data[hist.data.length - 1].source}` as any)}`}</p>
        </CardBody>
      </Card>
    </div>
  );
}
