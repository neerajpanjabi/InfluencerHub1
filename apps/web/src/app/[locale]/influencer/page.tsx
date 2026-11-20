'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Eye, FileText, Heart, Megaphone, MessageSquare, Users, Wallet } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { api } from '@/lib/api';
import { fmtMoney, fmtNumber, fmtPercent } from '@/lib/format';
import { Alert, PageHeader, Skeleton, StatCard } from '@/components/ui/misc';
import { buttonVariants } from '@/components/ui/button';
import { GradeBadge } from '@/components/marketplace/badges';
import { useMe } from '@/hooks/use-me';

export default function CreatorOverview() {
  const t = useTranslations();
  const locale = useLocale();
  const { data: me } = useMe();
  const { data: d } = useQuery({ queryKey: ['inf-dashboard'], queryFn: () => api<any>('/influencers/me/dashboard') });
  if (!d) return <Skeleton className="h-64" />;
  return (
    <div>
      <PageHeader
        title={t('influencer.overview.title')}
        description={me?.influencerProfile?.displayName}
        actions={me?.influencerProfile && <Link href={`/creators/${me.influencerProfile.slug}`} className={buttonVariants({ variant: 'outline' })}>{t('influencer.profile.viewPublic')}</Link>}
      />
      {!d.isPublic && <Alert tone="warning" className="mb-4"><Link href="/influencer/profile" className="underline">{t('influencer.overview.publishHint')}</Link></Alert>}
      {d.followers === 0 && <Alert className="mb-4"><Link href="/influencer/accounts" className="underline">{t('influencer.overview.connectHint')}</Link></Alert>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-soft">
          <p className="text-sm text-stone-500">{t('influencer.overview.grade')}</p>
          <div className="mt-2"><GradeBadge grade={d.grade} score={d.score} size="lg" /></div>
        </div>
        <StatCard label={t('influencer.overview.followers')} value={fmtNumber(d.followers, locale)} icon={<Users className="h-4 w-4" />} />
        <StatCard label={t('influencer.overview.reelViews')} value={fmtNumber(d.avgReelViews ?? d.avgVideoViews, locale)} icon={<Eye className="h-4 w-4" />} hint={d.avgStoryViews ? `${t('influencer.overview.storyViews')}: ${fmtNumber(d.avgStoryViews, locale)}` : undefined} />
        <StatCard label={t('influencer.overview.engagement')} value={fmtPercent(d.engagementRate, locale)} icon={<Heart className="h-4 w-4" />} />
        <StatCard label={t('influencer.overview.pendingRequests')} value={d.pendingQuotes} icon={<FileText className="h-4 w-4" />} />
        <StatCard label={t('influencer.overview.activeCampaigns')} value={d.activeCampaigns} icon={<Megaphone className="h-4 w-4" />} />
        <StatCard label={t('influencer.overview.enquiries')} value={d.enquiriesLast30Days} icon={<MessageSquare className="h-4 w-4" />} />
        <StatCard label={t('influencer.overview.earnings')} value={fmtMoney(d.lifetimeEarnings, locale)} icon={<Wallet className="h-4 w-4" />} />
      </div>
    </div>
  );
}
