'use client';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input, Textarea } from '@/components/ui/input';
import { PageHeader, Skeleton } from '@/components/ui/misc';
import { GradeBadge } from '@/components/marketplace/badges';
import { useAdmin, useAdminAction } from '@/components/portal/admin-kit';

export default function Grading() {
  const t = useTranslations();
  const locale = useLocale();
  const { data } = useAdmin<any>('/grading');
  const act = useAdminAction();
  const [cfg, setCfg] = useState<any>(null);
  const [advanced, setAdvanced] = useState('');
  const [notes, setNotes] = useState('');
  useEffect(() => {
    if (data) {
      setCfg({ weights: { ...data.active.config.weights }, thresholds: { ...data.active.config.thresholds }, minCoverage: data.active.config.minCoverage });
      setAdvanced(JSON.stringify({ normalization: data.active.config.normalization, verificationWeights: data.active.config.verificationWeights, freshness: data.active.config.freshness, outliers: data.active.config.outliers, categoryScale: data.active.config.categoryScale, minSamplePosts: data.active.config.minSamplePosts }, null, 2));
    }
  }, [data]);
  if (!data || !cfg) return <Skeleton className="h-64" />;
  const total = Object.values(cfg.weights).reduce((a: number, b: any) => a + Number(b), 0);
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title={t('admin.nav.grading')} description={`v${data.active.version}`} />
      <Card>
        <CardHeader title={t('admin.distribution')} />
        <CardBody className="flex flex-wrap gap-4">{data.distribution.map((d: any) => <div key={d.currentGrade} className="text-center"><GradeBadge grade={d.currentGrade} size="sm" /><p className="text-sm">{d._count}</p></div>)}</CardBody>
      </Card>
      <Card>
        <CardHeader title={t('admin.weights')} description={`Σ = ${total}`} />
        <CardBody className="grid gap-3 sm:grid-cols-3">
          {Object.keys(cfg.weights).map((k) => <Field key={k} label={t(`profile.components.${k}` as any)}><Input type="number" min={0} value={cfg.weights[k]} onChange={(e) => setCfg({ ...cfg, weights: { ...cfg.weights, [k]: Number(e.target.value) } })} /></Field>)}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t('admin.thresholds')} />
        <CardBody className="grid gap-3 sm:grid-cols-5">
          {['S', 'A', 'B', 'C'].map((k) => <Field key={k} label={`${k} ≥`}><Input type="number" min={1} max={100} value={cfg.thresholds[k]} onChange={(e) => setCfg({ ...cfg, thresholds: { ...cfg.thresholds, [k]: Number(e.target.value) } })} /></Field>)}
          <Field label="Min coverage"><Input type="number" step="0.05" min={0} max={1} value={cfg.minCoverage} onChange={(e) => setCfg({ ...cfg, minCoverage: Number(e.target.value) })} /></Field>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Advanced (JSON)" />
        <CardBody><Textarea dir="ltr" rows={14} className="font-mono text-xs" value={advanced} onChange={(e) => setAdvanced(e.target.value)} /></CardBody>
      </Card>
      <Card>
        <CardBody className="space-y-3">
          <Field label={t('admin.versionNotes')}><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <Button disabled={notes.length < 3} onClick={() => { let adv = {}; try { adv = JSON.parse(advanced); } catch { return; } void act(() => api('/admin/grading', { body: { config: { ...adv, ...cfg }, notes } })); }}>{t('admin.publishVersion')}</Button>
          <ul className="text-xs text-stone-500">{data.versions.map((v: any) => <li key={v.id}>v{v.version} · {fmtDate(v.createdAt, locale)} · {v.notes}</li>)}</ul>
        </CardBody>
      </Card>
    </div>
  );
}
