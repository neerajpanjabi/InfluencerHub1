'use client';
import { useTranslations } from 'next-intl';
import { Activity, BadgeCheck, Bot, Building, ClipboardList, CreditCard, FileSearch, Gauge, Globe2, LayoutGrid, Megaphone, Package, Percent, Plug, Receipt, RotateCcw, Scale, Settings, Shield, ShieldAlert, Tags, Users, Wallet } from 'lucide-react';
import { PortalShell, NavItem } from '@/components/portal/shell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('admin.nav');
  const tg = useTranslations('portal.groups');
  const nav: NavItem[] = [
    { href: '/admin', label: t('dashboard'), icon: Gauge },
    { href: '/admin/users', label: t('users'), icon: Users, group: tg('users') },
    { href: '/admin/verifications', label: t('verifications'), icon: BadgeCheck, group: tg('users') },
    { href: '/admin/moderation', label: t('moderation'), icon: ShieldAlert, group: tg('users') },
    { href: '/admin/privacy', label: t('privacy'), icon: Shield, group: tg('users') },
    { href: '/admin/categories', label: t('categories'), icon: LayoutGrid, group: tg('catalogue') },
    { href: '/admin/catalog', label: t('catalog'), icon: Package, group: tg('catalogue') },
    { href: '/admin/benchmarks', label: t('benchmarks'), icon: Tags, group: tg('catalogue') },
    { href: '/admin/grading', label: t('grading'), icon: Activity, group: tg('catalogue') },
    { href: '/admin/orders', label: t('orders'), icon: ClipboardList, group: tg('operations') },
    { href: '/admin/campaigns', label: t('campaigns'), icon: Megaphone, group: tg('operations') },
    { href: '/admin/disputes', label: t('disputes'), icon: Scale, group: tg('operations') },
    { href: '/admin/fees', label: t('fees'), icon: Percent, group: tg('finance') },
    { href: '/admin/payments', label: t('payments'), icon: CreditCard, group: tg('finance') },
    { href: '/admin/refunds', label: t('refunds'), icon: RotateCcw, group: tg('finance') },
    { href: '/admin/payouts', label: t('payouts'), icon: Wallet, group: tg('finance') },
    { href: '/admin/reports', label: t('reports'), icon: Receipt, group: tg('finance') },
    { href: '/admin/ai', label: t('ai'), icon: Bot, group: tg('system') },
    { href: '/admin/integrations', label: t('integrations'), icon: Plug, group: tg('system') },
    { href: '/admin/localization', label: t('localization'), icon: Globe2, group: tg('system') },
    { href: '/admin/audit', label: t('audit'), icon: FileSearch, group: tg('system') },
    { href: '/admin/settings', label: t('settings'), icon: Settings, group: tg('system') },
  ];
  void Building;
  return (
    <PortalShell type="ADMIN" nav={nav}>
      {children}
    </PortalShell>
  );
}
