'use client';
import { useTranslations } from 'next-intl';
import { Award, BarChart3, Bell, CalendarDays, FileText, LayoutDashboard, Link2, Megaphone, MessageSquare, Package, Settings, ShieldCheck, Star, Tag, User, Wallet } from 'lucide-react';
import { PortalShell, NavItem } from '@/components/portal/shell';

export default function InfluencerLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('influencer.nav');
  const tg = useTranslations('portal.groups');
  const nav: NavItem[] = [
    { href: '/influencer', label: t('overview'), icon: LayoutDashboard },
    { href: '/influencer/profile', label: t('profile'), icon: User, group: tg('profile') },
    { href: '/influencer/accounts', label: t('accounts'), icon: Link2, group: tg('profile') },
    { href: '/influencer/analytics', label: t('analytics'), icon: BarChart3, group: tg('profile') },
    { href: '/influencer/grade', label: t('grade'), icon: Award, group: tg('profile') },
    { href: '/influencer/verification', label: t('verification'), icon: ShieldCheck, group: tg('profile') },
    { href: '/influencer/rate-cards', label: t('rateCards'), icon: Tag, group: tg('services') },
    { href: '/influencer/packages', label: t('packages'), icon: Package, group: tg('services') },
    { href: '/influencer/availability', label: t('availability'), icon: CalendarDays, group: tg('services') },
    { href: '/influencer/requests', label: t('requests'), icon: FileText, group: tg('work') },
    { href: '/influencer/campaigns', label: t('campaigns'), icon: Megaphone, group: tg('work') },
    { href: '/influencer/messages', label: t('messages'), icon: MessageSquare, group: tg('work') },
    { href: '/influencer/reviews', label: t('reviews'), icon: Star, group: tg('work') },
    { href: '/influencer/earnings', label: t('earnings'), icon: Wallet, group: tg('money') },
    { href: '/influencer/notifications', label: useTranslations('nav')('notifications'), icon: Bell, group: tg('account') },
    { href: '/influencer/settings', label: t('settings'), icon: Settings, group: tg('account') },
  ];
  return (
    <PortalShell type="INFLUENCER" nav={nav}>
      {children}
    </PortalShell>
  );
}
