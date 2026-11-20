import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { Inter, Playfair_Display, IBM_Plex_Sans_Arabic } from 'next/font/google';
import { routing, isRtl } from '@/i18n/routing';
import { Providers } from '@/components/providers';
import '../globals.css';

const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const display = Playfair_Display({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const arabic = IBM_Plex_Sans_Arabic({ subsets: ['arabic'], weight: ['400', '500', '600', '700'], variable: '--font-arabic', display: 'swap' });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    title: { default: t('title'), template: `%s · InfluenceHub` },
    description: t('description'),
    alternates: { languages: { en: '/en', ar: '/ar' } },
    icons: { icon: '/favicon.svg' },
  };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as 'en' | 'ar')) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  return (
    <html lang={locale} dir={isRtl(locale) ? 'rtl' : 'ltr'} className={`${sans.variable} ${display.variable} ${arabic.variable}`}>
      <body className="min-h-screen font-sans">
        <NextIntlClientProvider messages={messages} locale={locale} timeZone="Asia/Dubai">
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
