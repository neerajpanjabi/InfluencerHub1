'use client';
import { useTranslations } from 'next-intl';
import { Bell, Bookmark, Building2, CreditCard, FileText, LayoutDashboard, LayoutGrid, Megaphone, MessageSquare, Package, Search, Settings, ShoppingBag, Sparkles, Star } from 'lucide-react';
import { PortalShell, NavItem } from '@/components/portal/shell';

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('business.nav');
  const nav: NavItem[] = [
    { href: '/business', label: t('overview'), icon: LayoutDashboard },
    { href: '/business/discover', label: t('discover'), icon: Search, group: 'Marketplace' },
    { href: '/business/ai', label: t('ai'), icon: Sparkles, group: 'Marketplace' },
    { href: '/business/categories', label: t('categories'), icon: LayoutGrid, group: 'Marketplace' },
    { href: '/business/saved', label: t('saved'), icon: Bookmark, group: 'Marketplace' },
    { href: '/business/cart', label: t('cart'), icon: ShoppingBag, group: 'Commerce' },
    { href: '/business/orders', label: t('orders'), icon: Package, group: 'Commerce' },
    { href: '/business/quotations', label: t('quotations'), icon: FileText, group: 'Commerce' },
    { href: '/business/payments', label: t('payments'), icon: CreditCard, group: 'Commerce' },
    { href: '/business/campaigns', label: t('campaigns'), icon: Megaphone, group: 'Campaigns' },
    { href: '/business/messages', label: t('messages'), icon: MessageSquare, group: 'Campaigns' },
    { href: '/business/reviews', label: t('reviews'), icon: Star, group: 'Campaigns' },
    { href: '/business/notifications', label: t('notifications'), icon: Bell, group: 'Account' },
    { href: '/business/profile', label: t('profile'), icon: Building2, group: 'Account' },
    { href: '/business/settings', label: t('settings'), icon: Settings, group: 'Account' },
  ];
  return (
    <PortalShell type="BUSINESS" nav={nav}>
      {children}
    </PortalShell>
  );
}
