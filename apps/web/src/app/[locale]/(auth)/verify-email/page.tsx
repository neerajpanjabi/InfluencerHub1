import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { VerifyEmail } from '@/components/auth/token-pages';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return (
    <Suspense>
      <VerifyEmail />
    </Suspense>
  );
}
