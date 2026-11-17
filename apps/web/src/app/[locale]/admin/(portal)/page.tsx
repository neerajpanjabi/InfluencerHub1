'use client';
import { useLocale, useTranslations } from 'next-intl';
import { fmtMoney, fmtNumber } from '@/lib/format';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { PageHeader, Skeleton, StatCard } from '@/components/ui/misc';
import { useAdmin } from '@/components/portal/admin-kit';

export default function AdminDashboard() {
  const t = useTranslations('admin.dashboard');
  const locale = useLocale();
  const { data: d } = useAdmin('/dashboard');
  if (!d) return <Skeleton className="h-64" />;
  const m = (v: string) => fmtMoney(v, locale);
  return (
    <div className="space-y-6">
      <PageHeader title={useTranslations('admin')('title')} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('users')} value={fmtNumber(d.users, locale, false)} />
        <StatCard label={t('influencers')} value={d.influencers} hint={`${t('verified')}: ${d.verifiedInfluencers}`} />
        <StatCard label={t('businesses')} value={d.businesses} />
        <StatCard label={t('activeCampaigns')} value={d.activeCampaigns} hint={`${t('completedOrders')}: ${d.completedOrders}`} />
        <StatCard label={t('gbv')} value={m(d.grossBookingValue)} />
        <StatCard label={t('commission')} value={m(d.commissionRevenue)} />
        <StatCard label={t('contactFees')} value={m(d.contactFeeRevenue)} />
        <StatCard label={t('refunds')} value={m(d.refundsTotal)} hint={`${d.pendingRefunds} pending`} />
        <StatCard label={t('pendingVerifications')} value={d.pendingVerifications} />
        <StatCard label={t('disputes')} value={d.openDisputes} />
        <StatCard label={t('failedSyncs')} value={d.failedSyncs24h} />
      </div>
      <Card>
        <CardHeader title={t('integrationHealth')} />
        <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {d.integrations.map((i: any) => (
            <div key={i.provider} className="rounded border border-stone-100 p-3 text-sm">
              <p className="font-medium">{i.provider}</p>
              <StatusBadge status={i.status === 'HEALTHY' ? 'ACTIVE' : i.status === 'AWAITING_APPROVAL' ? 'PENDING' : i.status} label={i.status} />
              <p className="mt-1 text-xs text-stone-500">{i.mode}{i.isEnabled ? ' · enabled' : ''}</p>
            </div>
          ))}
          {d.socialProviders.map((p: any) => (
            <div key={p.platform} className="rounded border border-stone-100 p-3 text-sm">
              <p className="font-medium">{p.platform} runtime</p>
              <p className="text-xs">live: {String(p.live)} · sandbox: {String(p.sandbox)}</p>
            </div>
          ))}
          {d.paymentProviders.map((p: any) => (
            <div key={p.name} className="rounded border border-stone-100 p-3 text-sm">
              <p className="font-medium">payments: {p.name}</p>
              <p className="text-xs">configured: {String(p.configured)} · active: {String(p.active)}{p.sandbox ? ' · SANDBOX' : ''}</p>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
