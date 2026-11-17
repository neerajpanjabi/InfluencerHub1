'use client';
import { useLocale } from 'next-intl';
import { Globe } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/routing';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

/** Switches locale (and direction), and persists the preference for signed-in users. */
export function LanguageSwitcher({ onDark }: { onDark?: boolean }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const next = locale === 'en' ? 'ar' : 'en';
  return (
    <button
      type="button"
      onClick={() => {
        if (document.cookie.includes('ih_csrf=')) void api('/auth/locale', { body: { locale: next } }).catch(() => undefined);
        router.replace(pathname + window.location.search, { locale: next });
      }}
      className={cn('flex items-center gap-1.5 rounded px-2 py-1.5 text-sm transition-colors', onDark ? 'text-ivory/80 hover:text-ivory' : 'text-navy-800 hover:bg-stone-100')}
      aria-label={next === 'ar' ? 'التبديل إلى العربية' : 'Switch to English'}
      lang={next}
    >
      <Globe className="h-4 w-4" />
      {next === 'ar' ? 'العربية' : 'English'}
    </button>
  );
}
