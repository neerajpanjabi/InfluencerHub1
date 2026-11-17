'use client';
import { useTranslations } from 'next-intl';
import { Award, BarChart3, Bell, CalendarDays, FileText, LayoutDashboard, Link2, Megaphone, MessageSquare, Package, Settings, ShieldCheck, Star, Tag, User, Wallet } from 'lucide-react';
import { PortalShell, NavItem } from '@/components/portal/shell';

export default function InfluencerLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('influencer.nav');
  const nav: NavItem[] = [
    { href: '/influencer', label: t('overview'), icon: LayoutDashboard },
    { href: '/influencer/profile', label: t('profile'), icon: User, group: 'Profile' },
    { href: '/influencer/accounts', label: t('accounts'), icon: Link2, group: 'Profile' },
    { href: '/influencer/analytics', label: t('analytics'), icon: BarChart3, group: 'Profile' },
    { href: '/influencer/grade', label: t('grade'), icon: Award, group: 'Profile' },
    { href: '/influencer/verification', label: t('verification'), icon: ShieldCheck, group: 'Profile' },
    { href: '/influencer/rate-cards', label: t('rateCards'), icon: Tag, group: 'Services' },
    { href: '/influencer/packages', label: t('packages'), icon: Package, group: 'Services' },
    { href: '/influencer/availability', label: t('availability'), icon: CalendarDays, group: 'Services' },
    { href: '/influencer/requests', label: t('requests'), icon: FileText, group: 'Work' },
    { href: '/influencer/campaigns', label: t('campaigns'), icon: Megaphone, group: 'Work' },
    { href: '/influencer/messages', label: t('messages'), icon: MessageSquare, group: 'Work' },
    { href: '/influencer/reviews', label: t('reviews'), icon: Star, group: 'Work' },
    { href: '/influencer/earnings', label: t('earnings'), icon: Wallet, group: 'Money' },
    { href: '/influencer/notifications', label: useTranslations('nav')('notifications'), icon: Bell, group: 'Account' },
    { href: '/influencer/settings', label: t('settings'), icon: Settings, group: 'Account' },
  ];
  return (
    <PortalShell type="INFLUENCER" nav={nav}>
      {children}
    </PortalShell>
  );
}
