import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { ResetPassword } from '@/components/auth/token-pages';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return (
    <Suspense>
      <ResetPassword />
    </Suspense>
  );
}
