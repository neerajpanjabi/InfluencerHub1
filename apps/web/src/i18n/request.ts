import { getRequestConfig } from 'next-intl/server';
import { messages } from '@influencehub/localization';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as 'en' | 'ar')) locale = routing.defaultLocale;
  return { locale, messages: messages[locale as 'en' | 'ar'], timeZone: 'Asia/Dubai' };
});
