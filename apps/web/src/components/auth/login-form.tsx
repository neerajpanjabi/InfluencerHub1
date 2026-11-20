'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Instagram, Music2 } from '@/components/ui/platform-icons';
import { Link, useRouter } from '@/i18n/routing';
import { api, ApiError } from '@/lib/api';
import { useErrorMessage } from '@/hooks/use-error';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/misc';
import { portalHome } from '@/components/layout/site-header';
import { legalLinks } from './legal-links';

export function LoginForm({ admin }: { admin?: boolean }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const qc = useQueryClient();
  const err = useErrorMessage();
  const sp = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [needTotp, setNeedTotp] = useState(false);
  const qErr = sp.get('error');
  const [error, setError] = useState<string | null>(qErr ? (t.has(`errors.${qErr}`) ? t(`errors.${qErr}` as any) : t('errors.oauth_failed')) : null);
  const [busy, setBusy] = useState(false);
  const providers = useQuery({ queryKey: ['providers'], queryFn: () => api('/auth/providers'), enabled: !admin });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await api('/auth/login', { body: { email, password, ...(needTotp ? { totp } : {}) } });
      qc.setQueryData(['me'], me);
      if (me.type === 'ADMIN' && me.requiresTwoFactorSetup) return router.replace('/admin/login?setup=1');
      const next = sp.get('next');
      router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next.replace(/^\/(en|ar)(?=\/|$)/, '') || '/' : portalHome(me.type));
    } catch (e2) {
      if (e2 instanceof ApiError && e2.code === 'TOTP_REQUIRED') setNeedTotp(true);
      setError(err(e2));
    } finally {
      setBusy(false);
    }
  };

  const social = (path: string, live: boolean, icon: React.ReactNode, label: string) => (
    <a href={`/api/v1/social/${path}/login${live ? '' : '?mode=sandbox'}`} className="flex h-11 w-full items-center justify-center gap-2 rounded border border-stone-300 bg-white text-sm hover:border-navy-900">
      {icon} {label} {!live && <span className="text-xs text-amber-700">({t('sandboxLogin')})</span>}
    </a>
  );

  return (
    <div>
      <h1 className="font-display text-3xl text-navy-900">{t('loginTitle')}</h1>
      <p className="mt-2 text-sm text-stone-500">{t('loginSubtitle')}</p>
      {error && (
        <Alert tone="danger" className="mt-6">
          {error}
        </Alert>
      )}
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label={t('email')} htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={t('password')} htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {needTotp && (
          <Field label={t('totp')} hint={t('totpHint')} htmlFor="totp">
            <Input id="totp" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required value={totp} onChange={(e) => setTotp(e.target.value)} />
          </Field>
        )}
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm text-navy-700 hover:underline">
            {t('forgot')}
          </Link>
        </div>
        <Button type="submit" className="w-full" size="lg" loading={busy}>
          {t('loginButton')}
        </Button>
      </form>
      {!admin && (
        <>
          <div className="my-6 flex items-center gap-3 text-xs text-stone-400">
            <span className="h-px flex-1 bg-stone-200" />
            {t('or')}
            <span className="h-px flex-1 bg-stone-200" />
          </div>
          <div className="space-y-2">
            {providers.data?.google && (
              <a href="/api/v1/auth/google/start" className="flex h-11 w-full items-center justify-center gap-2 rounded border border-stone-300 bg-white text-sm hover:border-navy-900">
                <span className="font-bold text-[#4285F4]">G</span> {t('continueGoogle')}
              </a>
            )}
            {(providers.data?.instagram || providers.data?.socialSandbox) && social('instagram', !!providers.data?.instagram, <Instagram className="h-4 w-4" />, t('continueInstagram'))}
            {(providers.data?.tiktok || providers.data?.socialSandbox) && social('tiktok', !!providers.data?.tiktok, <Music2 className="h-4 w-4" />, t('continueTiktok'))}
          </div>
          <div className="mt-3 space-y-1 text-xs leading-relaxed text-stone-500">
            {providers.data?.google && <p>{t.rich('googleTermsNotice', legalLinks)}</p>}
            {(providers.data?.instagram || providers.data?.tiktok || providers.data?.socialSandbox) && <p>{t.rich('socialTermsNotice', legalLinks)}</p>}
          </div>
          <p className="mt-8 text-center text-sm text-stone-500">
            {t('noAccount')}{' '}
            <Link href="/register" className="font-medium text-navy-900 underline">
              {t('createAccount')}
            </Link>
          </p>
          <p className="mt-2 text-center text-xs text-stone-400">{t('neverPasswords')}</p>
        </>
      )}
    </div>
  );
}
