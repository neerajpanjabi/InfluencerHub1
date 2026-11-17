import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({ locales: ['en', 'ar'], defaultLocale: 'en', localePrefix: 'always' });
export type AppLocale = (typeof routing.locales)[number];
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
export const isRtl = (l: string) => l === 'ar';
