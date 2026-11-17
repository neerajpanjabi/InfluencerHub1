'use client';
import { useTranslations } from 'next-intl';
import { ApiError } from '@/lib/api';

/** Maps API error codes to localised messages. */
export function useErrorMessage() {
  const t = useTranslations();
  return (e: unknown) => {
    if (e instanceof ApiError) {
      for (const ns of ['errors', 'auth.errors', 'influencer.accounts.errors']) {
        const key = `${ns}.${e.code}`;
        if (t.has(key)) return t(key);
      }
      if (e.code === 'VALIDATION_FAILED') return t('validation.invalid');
    }
    return t('common.error');
  };
}
