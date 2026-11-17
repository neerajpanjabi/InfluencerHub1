import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowRight, CheckCircle2, Quote, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { serverApi } from '@/lib/server-api';
import { buttonVariants } from '@/components/ui/button';
import { HeroSearch } from '@/components/marketplace/hero-search';
import { CreatorCard, type CreatorCardData } from '@/components/marketplace/creator-card';
import { CategoryIcon } from '@/components/marketplace/category-icon';
import { cn } from '@/lib/utils';

interface Home {
  featured: CreatorCardData[];
  topRated: CreatorCardData[];
  trending: CreatorCardData[];
  popularServices: Array<{ key: string; nameEn: string; nameAr: string; platform: string; offerCount: number }>;
  stats: { creators: number; categories: number };
}
interface Cat { slug: string; nameEn: string; nameAr: string; icon: string | null; influencerCount: number }

function Section({ eyebrow, title, href, viewAll, children, className }: { eyebrow?: string; title: string; href?: string; viewAll?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('container py-14', className)}>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
          <h2 className="font-display text-3xl text-navy-900">{title}</h2>
        </div>
        {href && (
          <Link href={href} className="flex items-center gap-1 text-sm text-navy-700 hover:text-navy-950">
            {viewAll}
            <ArrowRight className="flip-rtl h-4 w-4" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const [home, cats] = await Promise.all([serverApi<Home>('/influencers/home'), serverApi<Cat[]>('/categories')]);
  const categories = cats ?? [];
  const l = await getLocale();
  const name = (c: { nameEn: string; nameAr: string }) => (l === 'ar' ? c.nameAr : c.nameEn);
  const faqs = t.raw('faq.items') as Array<{ q: string; a: string }>;
  const testimonials = t.raw('home.testimonials') as Array<{ quote: string; author: string }>;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy-sheen text-ivory">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gold-line" />
        <div className="container relative py-20 md:py-28">
          <p className="eyebrow text-gold-400">{t('common.positioning')}</p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl leading-tight md:text-6xl">{t('home.heroTitle')}</h1>
          <p className="mt-5 max-w-2xl text-lg text-ivory/75">{t('home.heroSubtitle')}</p>
          {home && (
            <p className="mt-6 text-sm text-ivory/60">
              {t('home.statsCreators', { count: home.stats.creators })} · {t('home.statsCategories', { count: home.stats.categories })} · {t('common.aed')}
            </p>
          )}
          <div className="mt-10 max-w-5xl text-navy-900">
            <HeroSearch categories={categories} />
          </div>
        </div>
      </section>

      {/* AI CTA */}
      <section className="container -mt-px py-14">
        <div className="grid items-center gap-8 rounded-xl border border-gold-200 bg-gradient-to-br from-gold-100/60 to-white p-8 md:grid-cols-[1.4fr_1fr] md:p-12">
          <div>
            <p className="eyebrow mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> {t('nav.aiDiscovery')}
            </p>
            <h2 className="font-display text-3xl text-navy-900">{t('home.aiCtaTitle')}</h2>
            <p className="mt-3 text-stone-600">{t('home.aiCtaBody')}</p>
          </div>
          <div className="md:text-end">
            <Link href="/discover" className={buttonVariants({ size: 'lg' })}>
              {t('home.aiCtaButton')}
              <ArrowRight className="flip-rtl h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Categories */}
      <Section eyebrow={t('nav.categories')} title={t('home.categoriesTitle')} href="/categories" viewAll={t('common.viewAll')}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {categories.slice(0, 20).map((c) => (
            <Link key={c.slug} href={`/creators?category=${c.slug}`} className="group flex items-center gap-3 rounded-lg border border-stone-200 bg-white p-4 transition hover:border-gold-400 hover:shadow-soft">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-navy-50 text-navy-800 group-hover:bg-navy-900 group-hover:text-gold-400">
                <CategoryIcon name={c.icon} className="h-5 w-5" />
              </span>
              <span className="text-sm leading-snug text-navy-900">{name(c)}</span>
            </Link>
          ))}
        </div>
      </Section>

      {home?.featured.length ? (
        <Section eyebrow={t('nav.browse')} title={t('home.featuredTitle')} href="/creators" viewAll={t('common.viewAll')}>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {home.featured.slice(0, 8).map((c) => (
              <CreatorCard key={c.id} c={c} />
            ))}
          </div>
        </Section>
      ) : null}

      {home?.topRated.length ? (
        <Section title={t('home.topRatedTitle')} href="/creators?sort=grade" viewAll={t('common.viewAll')} className="pt-0">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {home.topRated.slice(0, 4).map((c) => (
              <CreatorCard key={c.id} c={c} />
            ))}
          </div>
        </Section>
      ) : null}

      {home?.trending.length ? (
        <Section title={t('home.trendingTitle')} href="/creators?sort=engagement" viewAll={t('common.viewAll')} className="pt-0">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {home.trending.slice(0, 4).map((c) => (
              <CreatorCard key={c.id} c={c} />
            ))}
          </div>
        </Section>
      ) : null}

      {/* Popular services */}
      {home?.popularServices.length ? (
        <Section title={t('home.popularServicesTitle')}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {home.popularServices.map((s) => (
              <Link key={s.key} href={`/creators?serviceType=${s.key}`} className="rounded-lg border border-stone-200 bg-white p-4 hover:border-gold-400">
                <p className="text-xs text-stone-500">{t(`enums.platform.${s.platform}` as any)}</p>
                <p className="mt-1 font-medium text-navy-900">{name(s)}</p>
                <p className="mt-2 text-xs text-gold-700">{t('home.offers', { count: s.offerCount })}</p>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}

      {/* How it works */}
      <section className="bg-white py-16">
        <div className="container">
          <h2 className="font-display text-3xl text-navy-900">{t('home.howTitle')}</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n}>
                <span className="font-display text-4xl text-gold-500">0{n}</span>
                <div className="gold-rule my-4" />
                <h3 className="font-display text-xl text-navy-900">{t(`home.how${n}Title` as any)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{t(`home.how${n}Body` as any)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="container grid gap-6 py-16 md:grid-cols-2">
        {(['business', 'influencer'] as const).map((k) => (
          <div key={k} className={cn('rounded-xl p-8 md:p-10', k === 'business' ? 'bg-navy-900 text-ivory' : 'border border-stone-200 bg-white')}>
            <h3 className={cn('font-display text-2xl', k === 'business' ? 'text-ivory' : 'text-navy-900')}>{t(`home.${k}BenefitsTitle`)}</h3>
            <ul className="mt-6 space-y-3">
              {(t.raw(`home.${k}Benefits`) as string[]).map((b) => (
                <li key={b} className="flex gap-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                  {b}
                </li>
              ))}
            </ul>
            <Link href={k === 'business' ? '/register/business' : '/register/influencer'} className={cn(buttonVariants({ variant: k === 'business' ? 'gold' : 'primary' }), 'mt-8')}>
              {k === 'business' ? t('home.ctaBusiness') : t('home.ctaCreator')}
            </Link>
          </div>
        ))}
      </section>

      {/* Trust */}
      <section className="border-y border-stone-200 bg-ivory-100 py-16">
        <div className="container grid gap-10 md:grid-cols-[1fr_1.2fr]">
          <div>
            <ShieldCheck className="h-8 w-8 text-gold-600" />
            <h2 className="mt-4 font-display text-3xl text-navy-900">{t('home.trustTitle')}</h2>
            <p className="mt-4 text-sm leading-relaxed text-stone-600">{t('home.trustBody')}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="rounded-lg bg-white p-5 shadow-soft">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <p className="mt-3 text-sm text-navy-900">{t(`home.trust${n}` as any)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <Section title={t('home.testimonialsTitle')}>
        <div className="grid gap-5 md:grid-cols-3">
          {testimonials.map((x) => (
            <figure key={x.author} className="rounded-lg border border-stone-200 bg-white p-6">
              <Quote className="flip-rtl h-6 w-6 text-gold-500" />
              <blockquote className="mt-3 font-display text-lg leading-snug text-navy-900">{x.quote}</blockquote>
              <figcaption className="mt-4 text-xs text-stone-500">{x.author}</figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-4 text-xs text-stone-400">{t('home.testimonialsNote')}</p>
      </Section>

      {/* FAQ */}
      <Section title={t('home.faqTitle')} href="/faq" viewAll={t('common.viewAll')} className="pt-0">
        <div className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
          {faqs.slice(0, 4).map((f) => (
            <details key={f.q} className="group px-6 py-4">
              <summary className="cursor-pointer list-none font-medium text-navy-900 marker:hidden">{f.q}</summary>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* Final CTA */}
      <section className="container">
        <div className="rounded-xl bg-navy-sheen px-8 py-14 text-center text-ivory">
          <h2 className="font-display text-3xl">{t('home.ctaTitle')}</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/register/business" className={buttonVariants({ variant: 'gold', size: 'lg' })}>
              {t('home.ctaBusiness')}
            </Link>
            <Link href="/register/influencer" className={buttonVariants({ variant: 'onDark', size: 'lg' })}>
              {t('home.ctaCreator')}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
