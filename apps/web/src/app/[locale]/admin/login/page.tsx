'use client';
import { Suspense, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { useRouter } from '@/i18n/routing';
import { api } from '@/lib/api';
import { useMe } from '@/hooks/use-me';
import { useErrorMessage } from '@/hooks/use-error';
import { Logo } from '@/components/layout/logo';
import { LoginForm } from '@/components/auth/login-form';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/misc';

function TwoFactorSetup() {
  const t = useTranslations('auth');
  const router = useRouter();
  const qc = useQueryClient();
  const err = useErrorMessage();
  const [secret, setSecret] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api('/auth/2fa/setup', { method: 'POST' }).then(setSecret, (e) => setError(err(e)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <ShieldCheck className="h-8 w-8 text-gold-600" />
      <h1 className="mt-3 font-display text-2xl">{t('twoFactorSetupTitle')}</h1>
      <p className="mt-2 text-sm text-stone-500">{t('twoFactorSetupBody')}</p>
      {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
      {secret && (
        <form
          className="mt-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api('/auth/2fa/enable', { body: { code } });
              await qc.invalidateQueries({ queryKey: ['me'] });
              router.replace('/admin');
            } catch (e2) {
              setError(err(e2));
            }
          }}
        >
          <Field label={t('secretKey')}>
            <code className="block break-all rounded bg-stone-100 p-3 text-sm" dir="ltr">{secret.secret}</code>
          </Field>
          <p className="break-all text-xs text-stone-400" dir="ltr">{secret.otpauthUrl}</p>
          <Field label={t('totp')}>
            <Input inputMode="numeric" pattern="\d{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full">{t('enable2fa')}</Button>
        </form>
      )}
    </div>
  );
}

function AdminLogin() {
  const setup = useSearchParams().get('setup');
  const { data: me } = useMe();
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-sheen px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lift">
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <span className="eyebrow">Admin</span>
        </div>
        {setup && me?.type === 'ADMIN' ? <TwoFactorSetup /> : <LoginForm admin />}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <AdminLogin />
    </Suspense>
  );
}
