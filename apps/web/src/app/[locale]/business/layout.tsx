'use client';
import { useTranslations } from 'next-intl';
import { Bell, Bookmark, Building2, CreditCard, FileText, LayoutDashboard, LayoutGrid, Megaphone, MessageSquare, Package, Search, Settings, ShoppingBag, Sparkles, Star } from 'lucide-react';
import { PortalShell, NavItem } from '@/components/portal/shell';

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('business.nav');
  const tg = useTranslations('portal.groups');
  const nav: NavItem[] = [
    { href: '/business', label: t('overview'), icon: LayoutDashboard },
    { href: '/business/discover', label: t('discover'), icon: Search, group: tg('marketplace') },
    { href: '/business/ai', label: t('ai'), icon: Sparkles, group: tg('marketplace') },
    { href: '/business/categories', label: t('categories'), icon: LayoutGrid, group: tg('marketplace') },
    { href: '/business/saved', label: t('saved'), icon: Bookmark, group: tg('marketplace') },
    { href: '/business/cart', label: t('cart'), icon: ShoppingBag, group: tg('commerce') },
    { href: '/business/orders', label: t('orders'), icon: Package, group: tg('commerce') },
    { href: '/business/quotations', label: t('quotations'), icon: FileText, group: tg('commerce') },
    { href: '/business/payments', label: t('payments'), icon: CreditCard, group: tg('commerce') },
    { href: '/business/campaigns', label: t('campaigns'), icon: Megaphone, group: tg('campaigns') },
    { href: '/business/messages', label: t('messages'), icon: MessageSquare, group: tg('campaigns') },
    { href: '/business/reviews', label: t('reviews'), icon: Star, group: tg('campaigns') },
    { href: '/business/notifications', label: t('notifications'), icon: Bell, group: tg('account') },
    { href: '/business/profile', label: t('profile'), icon: Building2, group: tg('account') },
    { href: '/business/settings', label: t('settings'), icon: Settings, group: tg('account') },
  ];
  return (
    <PortalShell type="BUSINESS" nav={nav}>
      {children}
    </PortalShell>
  );
}
