'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Bookmark, CheckCircle2, Clock, FileText, Megaphone, Wallet } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { api } from '@/lib/api';
import { fmtDate, fmtMoney } from '@/lib/format';
import { Alert, PageHeader, Skeleton, StatCard } from '@/components/ui/misc';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { useMe } from '@/hooks/use-me';

export default function BusinessOverview() {
  const t = useTranslations();
  const locale = useLocale();
  const { data: me } = useMe();
  const { data: d, isLoading } = useQuery({ queryKey: ['biz-dashboard'], queryFn: () => api<any>('/businesses/me/dashboard') });
  return (
    <div>
      <PageHeader title={`${t('business.overview.title')}, ${me?.businessProfile?.businessName ?? ''}`} actions={<Link href="/business/ai" className={buttonVariants({ variant: 'gold' })}>{t('home.aiCtaButton')}</Link>} />
      {d && !d.onboardingCompleted && (
        <Alert tone="info" className="mb-6">
          <Link href="/business/onboarding" className="underline">
            {t('business.overview.completeOnboarding')}
          </Link>
        </Alert>
      )}
      {isLoading || !d ? (
        <Skeleton className="h-32" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard label={t('business.overview.active')} value={d.activeCampaigns} icon={<Megaphone className="h-4 w-4" />} />
          <StatCard label={t('business.overview.pending')} value={d.pendingBookings} icon={<Clock className="h-4 w-4" />} />
          <StatCard label={t('business.overview.completed')} value={d.completedCampaigns} icon={<CheckCircle2 className="h-4 w-4" />} />
          <StatCard label={t('business.overview.spending')} value={fmtMoney(d.totalSpending, locale)} icon={<Wallet className="h-4 w-4" />} />
          <StatCard label={t('business.overview.saved')} value={d.savedInfluencers} icon={<Bookmark className="h-4 w-4" />} />
          <StatCard label={t('business.overview.quotes')} value={d.pendingQuotations} icon={<FileText className="h-4 w-4" />} />
        </div>
      )}
      <Card className="mt-6">
        <CardHeader title={t('business.overview.recent')} />
        <CardBody>
          {!d?.recentActivity?.length ? (
            <p className="text-sm text-stone-500">{t('business.overview.noActivity')}</p>
          ) : (
            <ul className="space-y-3">
              {d.recentActivity.map((e: any) => (
                <li key={e.id} className="flex items-center justify-between gap-4 text-sm">
                  <Link href={`/business/campaigns/${e.campaignId}`} className="hover:underline">
                    <span className="text-stone-500">{e.campaign.number}</span> · {e.campaign.title} → <strong>{t(`enums.campaignStatus.${e.toStatus}` as any)}</strong>
                  </Link>
                  <span className="shrink-0 text-xs text-stone-400">{fmtDate(e.createdAt, locale, true)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
