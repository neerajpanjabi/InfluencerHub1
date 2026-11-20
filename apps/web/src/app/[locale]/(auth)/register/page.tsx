import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Building2, Sparkles } from 'lucide-react';
import { Link } from '@/i18n/routing';

export default async function Register({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const t = await getTranslations('auth');
  const opts = [
    { href: '/register/business', icon: Building2, title: t('asBusiness'), body: t('asBusinessBody') },
    { href: '/register/influencer', icon: Sparkles, title: t('asInfluencer'), body: t('asInfluencerBody') },
  ];
  return (
    <div>
      <h1 className="font-display text-3xl text-navy-900">{t('registerTitle')}</h1>
      <p className="mt-2 text-sm text-stone-500">{t('registerSubtitle')}</p>
      <div className="mt-8 space-y-3">
        {opts.map((o) => (
          <Link key={o.href} href={o.href} className="flex items-center gap-4 rounded-lg border border-stone-200 bg-white p-5 transition hover:border-gold-500 hover:shadow-soft">
            <span className="flex h-12 w-12 items-center justify-center rounded bg-navy-900 text-gold-400">
              <o.icon className="h-6 w-6" />
            </span>
            <span>
              <span className="block font-display text-lg text-navy-900">{o.title}</span>
              <span className="text-sm text-stone-500">{o.body}</span>
            </span>
          </Link>
        ))}
      </div>
      <p className="mt-8 text-center text-sm text-stone-500">
        {t('haveAccount')}{' '}
        <Link href="/login" className="font-medium text-navy-900 underline">
          {t('loginButton')}
        </Link>
      </p>
    </div>
  );
}
