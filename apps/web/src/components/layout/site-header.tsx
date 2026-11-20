'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Menu, ShoppingBag, Sparkles, X } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { useMe } from '@/hooks/use-me';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Logo } from './logo';
import { LanguageSwitcher } from './language-switcher';

export function portalHome(type?: string) {
  return type === 'BUSINESS' ? '/business' : type === 'INFLUENCER' ? '/influencer' : type === 'ADMIN' ? '/admin' : '/login';
}

export function SiteHeader() {
  const t = useTranslations('nav');
  const { data: me } = useMe();
  const [open, setOpen] = useState(false);
  const links = [
    { href: '/creators', label: t('browse') },
    { href: '/categories', label: t('categories') },
    { href: '/how-it-works', label: t('howItWorks') },
    { href: '/for-businesses', label: t('forBusinesses') },
    { href: '/for-influencers', label: t('forInfluencers') },
    { href: '/pricing', label: t('pricing') },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/70 bg-ivory/90 backdrop-blur">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:bg-white focus:p-2">
        {t('skip')}
      </a>
      <div className="container flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded px-3 py-2 text-sm text-navy-800 hover:text-navy-950 hover:underline hover:decoration-gold-500 hover:underline-offset-8">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <Link href="/discover" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'hidden md:inline-flex')}>
            <Sparkles className="h-4 w-4 text-gold-600" />
            {t('aiDiscovery')}
          </Link>
          <LanguageSwitcher />
          {me?.type === 'BUSINESS' && (
            <Link href="/business/cart" className={buttonVariants({ variant: 'ghost', size: 'icon' })} aria-label={t('cart')}>
              <ShoppingBag className="h-5 w-5" />
            </Link>
          )}
          {me ? (
            <Link href={portalHome(me.type)} className={cn(buttonVariants({ size: 'sm' }), 'hidden sm:inline-flex')}>
              {t('dashboard')}
            </Link>
          ) : (
            <div className="hidden items-center gap-1 sm:flex">
              <Link href="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                {t('login')}
              </Link>
              <Link href="/register" className={buttonVariants({ size: 'sm' })}>
                {t('register')}
              </Link>
            </div>
          )}
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-stone-200 bg-ivory lg:hidden" aria-label="Mobile">
          <div className="container flex flex-col py-3">
            {[...links, { href: '/discover', label: t('aiDiscovery') }].map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="py-2.5 text-navy-900">
                {l.label}
              </Link>
            ))}
            <div className="mt-3 flex gap-2 border-t border-stone-200 pt-3">
              {me ? (
                <Link href={portalHome(me.type)} className={buttonVariants({ size: 'sm' })}>
                  {t('dashboard')}
                </Link>
              ) : (
                <>
                  <Link href="/login" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                    {t('login')}
                  </Link>
                  <Link href="/register" className={buttonVariants({ size: 'sm' })}>
                    {t('register')}
                  </Link>
                </>
              )}
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
