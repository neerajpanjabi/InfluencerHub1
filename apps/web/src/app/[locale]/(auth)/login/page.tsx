import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LoginForm } from '@/components/auth/login-form';

export async function generateMetadata() {
  return { title: (await getTranslations('nav'))('login') };
}
export default async function Login({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
