'use client';
import { Suspense, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCcw, Unlink } from 'lucide-react';
import { Instagram, Music2 } from '@/components/ui/platform-icons';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/hooks/use-error';
import { fmtDate, fmtNumber, fmtPercent } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Field, Input, Select } from '@/components/ui/input';
import { Alert, PageHeader, Skeleton } from '@/components/ui/misc';
import { VerificationPill } from '@/components/marketplace/badges';
import { useToast } from '@/components/ui/toast';

function Accounts() {
  const t = useTranslations();
  const locale = useLocale();
  const qc = useQueryClient();
  const toast = useToast();
  const err = useErrorMessage();
  const sp = useSearchParams();
  const { data, isLoading } = useQuery({ queryKey: ['social-accounts'], queryFn: () => api<any>('/social/accounts') });
  const [manual, setManual] = useState({ socialAccountId: '', metricType: 'AVG_STORY_VIEWS', value: '', sampleSize: '' });
  useEffect(() => {
    const e = sp.get('error');
    if (sp.get('connected')) toast(t('influencer.accounts.connected'));
    if (e) toast(t.has(`influencer.accounts.errors.${e}`) ? t(`influencer.accounts.errors.${e}` as any) : t('influencer.accounts.errors.oauth_failed'), 'error');
  }, [sp, t, toast]);
  const connect = async (platform: 'instagram' | 'tiktok', mode?: 'sandbox') => {
    try {
      const r = await api(`/social/${platform}/connect`, { body: mode ? { mode } : {} });
      window.location.href = r.url;
    } catch (e) {
      toast(err(e), 'error');
    }
  };
  if (isLoading || !data) return <Skeleton className="h-64" />;
  const prov = Object.fromEntries(data.providers.map((p: any) => [p.platform, p]));
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title={t('influencer.accounts.title')} description={t('influencer.accounts.subtitle')} />
      <Alert>{t('influencer.accounts.eligibility')}</Alert>
      <div className="grid gap-3 sm:grid-cols-2">
        {(['INSTAGRAM', 'TIKTOK'] as const).map((p) => {
          const Icon = p === 'INSTAGRAM' ? Instagram : Music2;
          const slug = p.toLowerCase() as 'instagram' | 'tiktok';
          return (
            <Card key={p}>
              <CardBody className="flex flex-col gap-3">
                <p className="flex items-center gap-2 font-medium"><Icon className="h-5 w-5" /> {t(`enums.platform.${p}`)}</p>
                {prov[p]?.live ? (
                  <Button onClick={() => connect(slug)}>{p === 'INSTAGRAM' ? t('influencer.accounts.connectInstagram') : t('influencer.accounts.connectTiktok')}</Button>
                ) : (
                  <p className="text-xs text-stone-500">{t('influencer.accounts.notConfigured', { platform: t(`enums.platform.${p}`) })}</p>
                )}
                {prov[p]?.sandbox && (
                  <Button variant="outline" onClick={() => connect(slug, 'sandbox')}>
                    {t('influencer.accounts.sandbox')} <Badge tone="warning">{t('common.sandboxData')}</Badge>
                  </Button>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>
      {data.accounts.map((a: any) => (
        <Card key={a.id}>
          <CardHeader
            title={<span className="flex items-center gap-2" dir="ltr">{a.platform === 'INSTAGRAM' ? <Instagram className="h-5 w-5" /> : <Music2 className="h-5 w-5" />} @{a.username}</span>}
            description={`${t('influencer.accounts.lastSynced')}: ${a.lastSyncedAt ? fmtDate(a.lastSyncedAt, locale, true) : t('influencer.accounts.neverSynced')}${a.accountType ? ` · ${a.accountType}` : ''}`}
            action={
              <div className="flex items-center gap-2">
                {a.isSandbox && <Badge tone="warning">{t('common.sandboxData')}</Badge>}
                <StatusBadge status={a.status} label={t(`enums.accountStatus.${a.status}` as any)} />
              </div>
            }
          />
          <CardBody className="space-y-4">
            {a.lastError && <Alert tone="warning">{a.lastError}</Alert>}
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {a.metrics.map((m: any) => (
                <div key={m.metricType} className="rounded border border-stone-100 bg-stone-50 p-3">
                  <p className="text-xs text-stone-500">{t(`enums.metric.${m.metricType}` as any)}</p>
                  <p className="font-display text-lg">{m.metricType === 'ENGAGEMENT_RATE' ? fmtPercent(m.value, locale) : fmtNumber(m.value, locale)}</p>
                  <VerificationPill status={m.verificationStatus} source={m.source} />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-stone-500">{t('influencer.accounts.permissions')}:</span>
              {a.permissions.map((p: any) => <Badge key={p.scope} tone={p.granted ? 'success' : 'danger'}>{p.scope}</Badge>)}
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer text-stone-600">{t('influencer.accounts.syncHistory')}</summary>
              <ul className="mt-2 space-y-1 text-xs">
                {a.syncLogs.map((l: any, i: number) => (
                  <li key={i}>
                    {fmtDate(l.startedAt, locale, true)} · {l.trigger} · <StatusBadge status={l.status} label={l.status} /> {l.metricsWritten ? `· ${l.metricsWritten} metrics` : ''} {l.errorMessage && <span className="text-stone-500">— {l.errorMessage}</span>}
                  </li>
                ))}
              </ul>
            </details>
            <div className="flex gap-2">
              {a.status === 'CONNECTED' && (
                <Button size="sm" variant="outline" onClick={async () => { try { await api(`/social/accounts/${a.id}/sync`, { method: 'POST' }); toast(t('influencer.accounts.syncQueued')); setTimeout(() => qc.invalidateQueries({ queryKey: ['social-accounts'] }), 1500); } catch (e) { toast(err(e), 'error'); } }}>
                  <RefreshCcw className="h-4 w-4" /> {t('influencer.accounts.syncNow')}
                </Button>
              )}
              {a.status === 'TOKEN_EXPIRED' && <Button size="sm" onClick={() => connect(a.platform.toLowerCase(), a.isSandbox ? 'sandbox' : undefined)}>{t('notifications.SOCIAL_TOKEN_EXPIRED.title', { platform: a.platform })}</Button>}
              {a.status !== 'DISCONNECTED' && (
                <Button size="sm" variant="ghost" onClick={async () => { if (confirm(t('influencer.accounts.disconnectConfirm'))) { await api(`/social/accounts/${a.id}`, { method: 'DELETE' }); qc.invalidateQueries({ queryKey: ['social-accounts'] }); } }}>
                  <Unlink className="h-4 w-4" /> {t('influencer.accounts.disconnect')}
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
      ))}
      {data.accounts.length > 0 && (
        <Card>
          <CardHeader title={t('influencer.accounts.manualTitle')} description={t('influencer.accounts.manualBody')} />
          <CardBody>
            <form
              className="grid gap-3 sm:grid-cols-5 sm:items-end"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api('/social/metrics/manual', { body: { socialAccountId: manual.socialAccountId || data.accounts[0].id, metricType: manual.metricType, value: Number(manual.value), sampleSize: manual.sampleSize ? Number(manual.sampleSize) : undefined } });
                  toast(t('influencer.verification.submitted'));
                  qc.invalidateQueries({ queryKey: ['social-accounts'] });
                } catch (e2) {
                  toast(err(e2), 'error');
                }
              }}
            >
              <Field label={t('influencer.nav.accounts')}><Select value={manual.socialAccountId} onChange={(e) => setManual({ ...manual, socialAccountId: e.target.value })}>{data.accounts.map((a: any) => <option key={a.id} value={a.id}>@{a.username}</option>)}</Select></Field>
              <Field label={t('influencer.accounts.metric')}><Select value={manual.metricType} onChange={(e) => setManual({ ...manual, metricType: e.target.value })}>{['FOLLOWERS', 'AVG_REEL_VIEWS', 'AVG_STORY_VIEWS', 'AVG_VIDEO_VIEWS', 'ENGAGEMENT_RATE'].map((m) => <option key={m} value={m}>{t(`enums.metric.${m}` as any)}</option>)}</Select></Field>
              <Field label={t('influencer.accounts.value')}><Input type="number" min={0} step="any" required value={manual.value} onChange={(e) => setManual({ ...manual, value: e.target.value })} /></Field>
              <Field label={t('influencer.accounts.sampleSize')}><Input type="number" min={0} value={manual.sampleSize} onChange={(e) => setManual({ ...manual, sampleSize: e.target.value })} /></Field>
              <Button type="submit" variant="outline">{t('influencer.accounts.submit')}</Button>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
export default function Page() {
  return (
    <Suspense>
      <Accounts />
    </Suspense>
  );
}
