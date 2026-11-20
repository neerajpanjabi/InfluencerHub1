'use client';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, LogOut, Menu, X } from 'lucide-react';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-me';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/layout/logo';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { Avatar, Skeleton } from '@/components/ui/misc';
import { Alert } from '@/components/ui/misc';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group?: string;
}

export function PortalShell({ type, nav, children }: { type: 'BUSINESS' | 'INFLUENCER' | 'ADMIN'; nav: NavItem[]; children: React.ReactNode }) {
  const t = useTranslations();
  const locale = useLocale();
  const { data: me, isLoading } = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const unread = useQuery({ queryKey: ['unread'], queryFn: () => api<{ unread: number }>('/notifications/unread-count'), enabled: !!me && me.type !== 'ADMIN', refetchInterval: 30_000 });

  useEffect(() => {
    if (isLoading) return;
    if (!me) router.replace(type === 'ADMIN' ? '/admin/login' : `/login?next=${encodeURIComponent(pathname)}`);
    else if (me.type !== type) router.replace(me.type === 'BUSINESS' ? '/business' : me.type === 'INFLUENCER' ? '/influencer' : '/admin');
    else if (type === 'ADMIN' && !me.twoFactorPassed) router.replace('/admin/login?setup=1');
  }, [me, isLoading, type, router, pathname]);
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (isLoading || !me || me.type !== type) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-10 w-48" />
      </div>
    );
  }
  const base = type === 'BUSINESS' ? '/business' : type === 'INFLUENCER' ? '/influencer' : '/admin';
  const displayName = me.businessProfile?.businessName ?? me.influencerProfile?.displayName ?? me.email;
  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    qc.clear();
    router.replace('/');
  };
  const groups = Array.from(new Set(nav.map((n) => n.group ?? '')));

  const sidebar = (
    <nav className="flex h-full flex-col" aria-label="Portal">
      <div className="flex h-16 items-center px-5">
        <Logo onDark />
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-6">
        {groups.map((g) => (
          <div key={g} className="mt-4">
            {g && <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-ivory/40">{g}</p>}
            {nav
              .filter((n) => (n.group ?? '') === g)
              .map((n) => {
                const active = n.href === base ? pathname === base : pathname.startsWith(n.href);
                return (
                  <Link key={n.href} href={n.href} className={cn('flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors', active ? 'bg-white/10 text-ivory' : 'text-ivory/65 hover:bg-white/5 hover:text-ivory')} aria-current={active ? 'page' : undefined}>
                    <n.icon className={cn('h-4 w-4', active && 'text-gold-400')} />
                    {n.label}
                  </Link>
                );
              })}
          </div>
        ))}
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-stone-50 lg:grid lg:grid-cols-[256px_1fr]">
      <aside className="hidden bg-navy-900 lg:block lg:sticky lg:top-0 lg:h-screen">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-72 bg-navy-900">{sidebar}</aside>
        </div>
      )}
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-stone-200 bg-white/95 px-4 backdrop-blur md:px-8">
          <button className="rounded p-2 hover:bg-stone-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link href="/" className="hidden text-sm text-stone-500 hover:text-navy-900 md:block">
            {t('nav.home')}
          </Link>
          <div className="ms-auto flex items-center gap-1">
            <LanguageSwitcher />
            {type !== 'ADMIN' && (
              <Link href={`${base}/notifications`} className="relative rounded p-2 hover:bg-stone-100" aria-label={t('nav.notifications')}>
                <Bell className="h-5 w-5" />
                {!!unread.data?.unread && <span className="absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] font-bold text-navy-950">{unread.data.unread}</span>}
              </Link>
            )}
            <div className="ms-2 flex items-center gap-2 border-s border-stone-200 ps-3">
              <Avatar name={displayName} src={me.influencerProfile?.profileImageUrl ?? me.businessProfile?.logoUrl} size={32} />
              <span className="hidden max-w-[160px] truncate text-sm font-medium md:block">{displayName}</span>
              <button onClick={logout} className="rounded p-2 text-stone-500 hover:bg-stone-100 hover:text-navy-900" aria-label={t('nav.logout')} title={t('nav.logout')}>
                <LogOut className="flip-rtl h-4 w-4" />
              </button>
            </div>
          </div>
        </header>
        <main id="main" className="flex-1 px-4 py-6 md:px-8 md:py-8" lang={locale}>
          {type !== 'ADMIN' && !me.emailVerifiedAt && !me.email.endsWith('.invalid') && (
            <Alert tone="warning" className="mb-6">
              <span className="flex flex-wrap items-center gap-2">
                {t('notifications.EMAIL_VERIFY.body')}
                <button className="underline" onClick={() => api('/auth/verify-email/resend', { method: 'POST' }).catch(() => undefined)}>
                  {t('common.submit')}
                </button>
              </span>
            </Alert>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
